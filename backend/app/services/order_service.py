import secrets,string,uuid
from datetime import datetime, timezone
from decimal import Decimal
from pymongo.database import Database
from app.models.order import OrderMethod,OrderStatus,PaymentMethod,PaymentStatus
from app.models.product import ProductStatus

def _code(prefix,n=8): return prefix+''.join(secrets.choice(string.ascii_uppercase+string.digits) for _ in range(n))
_ORDER_METHOD_VALUES={x.value for x in OrderMethod}

def _resolve_order_method(value):
    if value is None or value=="": return OrderMethod.DELIVERY.value
    v=str(value).strip().lower()
    if v not in _ORDER_METHOD_VALUES: raise ValueError("Invalid order method")
    return v

def _product(db,pid):
    return db.products.find_one({"id":str(pid)})

def get_or_create_cart(db,user_id):
    user_id=str(user_id)
    cart=db.carts.find_one({"customer_id":user_id})
    if not cart:
        now=datetime.now(timezone.utc); cart={"id":str(uuid.uuid4()),"customer_id":user_id,"created_at":now,"updated_at":now}
        db.carts.insert_one(cart)
    return cart

def cart_out(db,cart):
    items=[]; total=Decimal("0")
    rows=list(db.cart_items.find({"cart_id":cart["id"]}))
    for i in rows:
        p=_product(db,i["product_id"])
        if not p: continue
        price=p.get("price")
        discount=p.get("discount_price")
        effective=discount if discount is not None else price
        if effective is not None: total += Decimal(str(effective))*i["quantity"]
        items.append({"id":i["id"],"quantity":i["quantity"],"product":{
            "id":p["id"],"name":p["name"],"sku":p["sku"],"price":price,
            "discount_price":discount,"stock":p.get("stock",0),"image":p.get("image")
        }})
    return {"id":cart["id"],"items":items,"total":total}

def add_item(db,user_id,product_id,quantity):
    if quantity<=0: raise ValueError("Quantity must be greater than zero")
    cart=get_or_create_cart(db,user_id); p=_product(db,product_id)
    if not p: raise ValueError("Product not found")
    if p.get("status")!=ProductStatus.ACTIVE.value: raise ValueError("Product is not available for purchase")
    # Products without a listed price can still be added to the cart.
    # The customer can submit the purchase request without a displayed total.
    item=db.cart_items.find_one({"cart_id":cart["id"],"product_id":str(product_id)})
    newq=(item["quantity"] if item else 0)+quantity
    if newq>p.get("stock",0): raise ValueError("Requested quantity exceeds available stock")
    now=datetime.now(timezone.utc)
    if item: db.cart_items.update_one({"id":item["id"]},{"$set":{"quantity":newq}})
    else: db.cart_items.insert_one({"id":str(uuid.uuid4()),"cart_id":cart["id"],"product_id":str(product_id),"quantity":quantity,"created_at":now})
    db.carts.update_one({"id":cart["id"]},{"$set":{"updated_at":now}})
    return get_or_create_cart(db,user_id)

def update_item(db,user_id,item_id,quantity):
    if quantity<=0: raise ValueError("Quantity must be greater than zero")
    cart=get_or_create_cart(db,user_id); item=db.cart_items.find_one({"id":str(item_id),"cart_id":cart["id"]})
    if not item: raise ValueError("Cart item not found")
    p=_product(db,item["product_id"])
    if not p: raise ValueError("Product not found")
    if p.get("status")!=ProductStatus.ACTIVE.value: raise ValueError("Product is not available for purchase")
    if quantity>p.get("stock",0): raise ValueError("Requested quantity exceeds available stock")
    db.cart_items.update_one({"id":item["id"]},{"$set":{"quantity":quantity}})
    db.carts.update_one({"id":cart["id"]},{"$set":{"updated_at":datetime.now(timezone.utc)}})
    return get_or_create_cart(db,user_id)

def remove_item(db,user_id,item_id):
    cart=get_or_create_cart(db,user_id)
    if db.cart_items.delete_one({"id":str(item_id),"cart_id":cart["id"]}).deleted_count==0: raise ValueError("Cart item not found")
    db.carts.update_one({"id":cart["id"]},{"$set":{"updated_at":datetime.now(timezone.utc)}})
    return get_or_create_cart(db,user_id)

def clear_cart(db,user_id):
    cart=get_or_create_cart(db,user_id); db.cart_items.delete_many({"cart_id":cart["id"]})
    db.carts.update_one({"id":cart["id"]},{"$set":{"updated_at":datetime.now(timezone.utc)}})
    return get_or_create_cart(db,user_id)

def create_order(db,user,payload):
    order_method=_resolve_order_method(getattr(payload,"order_method",None))
    cart=get_or_create_cart(db,user["id"]); items=list(db.cart_items.find({"cart_id":cart["id"]}))
    if not items: raise ValueError("Cart is empty")
    rows=[]; total=Decimal("0")
    for item in items:
        p=_product(db,item["product_id"])
        if not p: raise ValueError("A product in your cart no longer exists")
        if p.get("status")!=ProductStatus.ACTIVE.value: raise ValueError(f'{p["name"]} is no longer available for purchase')
        qty=item["quantity"]
        if qty<=0: raise ValueError(f'Invalid quantity for {p["name"]}')
        if p.get("stock",0)<qty: raise ValueError(f'Insufficient stock for {p["name"]}')
        effective_price = p.get("discount_price") if p.get("discount_price") is not None else p.get("price")
        # A product may intentionally have no public price. Keep it in the
        # cart/order and use zero internally only for the hidden calculation;
        # the customer UI does not display a total amount.
        price=Decimal(str(effective_price)) if effective_price is not None else Decimal("0")
        subtotal=price*qty; total+=subtotal
        rows.append((item,p,price,subtotal))
    now=datetime.now(timezone.utc)
    oid=str(uuid.uuid4())
    order={"id":oid,"order_number":"FC-"+str(uuid.uuid4())[:10].upper(),
           "purchase_code":_code("FC-"),"customer_id":str(user["id"]),
           "status":OrderStatus.PENDING.value,"order_method":order_method,
           "payment_method":PaymentMethod.CASH_ON_DELIVERY.value,
           "payment_status":PaymentStatus.PENDING.value,"total_amount":float(total),
           "shipping_address":payload.address,
           "customer_snapshot":{
             "id":str(user["id"]),
             "name":user.get("name"),
             "email":user.get("email"),
             "mobile":payload.mobile or user.get("mobile"),
             "phone":user.get("phone") or user.get("mobile"),
             "address":payload.address,
           },
           "created_at":now,"updated_at":now}
    db.orders.insert_one(order)
    for item,p,price,subtotal in rows:
        db.order_items.insert_one({"id":str(uuid.uuid4()),"order_id":oid,"product_id":p["id"],
          # Preserve purchase-time product information so later product edits/deletions
          # cannot change historical Purchased Products records.
          "product_name":p["name"],"sku":p["sku"],"image":p.get("image"),
          "category":p.get("category"),"quantity":item["quantity"],
          "unit_price":float(price),"subtotal":float(subtotal),"configuration":payload.configuration})
        db.products.update_one({"id":p["id"],"stock":{"$gte":item["quantity"]}},
                               {"$inc":{"stock":-item["quantity"]},"$set":{"updated_at":now}})
        db.stock_movements.insert_one({"id":str(uuid.uuid4()),"product_id":p["id"],
          "quantity_change":-item["quantity"],"reason":"Order","reference_id":order["order_number"],"created_at":now})
    db.cart_items.delete_many({"cart_id":cart["id"]})
    db.carts.update_one({"id":cart["id"]},{"$set":{"updated_at":now}})
    return get_order(db,oid)

def _enum_value(value, allowed, default):
    if value is None:
        return default
    raw = getattr(value, "value", value)
    text = str(raw).strip()
    for item in allowed:
        if text.lower() == item.lower():
            return item
    return default


def _order_out(db, o):
    """Return a stable, JSON/Pydantic-safe order DTO from MongoDB.

    Purchased history must remain readable even when older/imported MongoDB
    records are missing optional fields or use slightly different enum casing.
    One malformed legacy field must not make the entire admin orders endpoint
    return HTTP 500.
    """
    if not o:
        return None

    o = dict(o)
    o.pop("_id", None)
    now = datetime.now(timezone.utc)

    o["id"] = str(o.get("id") or o.get("_id") or uuid.uuid4())
    o["order_number"] = str(o.get("order_number") or o["id"])
    o["purchase_code"] = str(o.get("purchase_code") or o["order_number"])
    o["customer_id"] = str(o.get("customer_id") or "")
    o["status"] = _enum_value(o.get("status"), [x.value for x in OrderStatus], OrderStatus.PENDING.value)
    o["order_method"] = _enum_value(o.get("order_method"), [x.value for x in OrderMethod], OrderMethod.DELIVERY.value)
    o["payment_method"] = _enum_value(o.get("payment_method"), [x.value for x in PaymentMethod], PaymentMethod.CASH_ON_DELIVERY.value)
    o["payment_status"] = _enum_value(o.get("payment_status"), [x.value for x in PaymentStatus], PaymentStatus.PENDING.value)
    o["total_amount"] = Decimal(str(o.get("total_amount") or 0))
    o["shipping_address"] = o.get("shipping_address") if isinstance(o.get("shipping_address"), dict) else {}
    o["customer_snapshot"] = o.get("customer_snapshot") if isinstance(o.get("customer_snapshot"), dict) else {}
    o["created_at"] = o.get("created_at") or now
    o["updated_at"] = o.get("updated_at") or o["created_at"]

    its = []
    for x in db.order_items.find({"order_id": o["id"]}):
        x = dict(x)
        x.pop("_id", None)
        x["id"] = str(x.get("id") or uuid.uuid4())
        x["product_id"] = str(x.get("product_id") or "")
        x["product_name"] = str(x.get("product_name") or "Unknown Product")
        x["sku"] = str(x.get("sku") or "")
        x["quantity"] = int(x.get("quantity") or 0)
        x["unit_price"] = Decimal(str(x.get("unit_price") or 0))
        x["subtotal"] = Decimal(str(x.get("subtotal") or 0))
        x.setdefault("image", None)
        x.setdefault("category", None)
        x.setdefault("configuration", None)
        its.append(x)
    o["items"] = its
    return o

def list_orders(db,user=None):
    q={"customer_id":str(user["id"])} if user else {}
    return [_order_out(db,x) for x in db.orders.find(q).sort("created_at",-1)]

def get_order(db,oid,user=None):
    q={"id":str(oid)}
    if user:q["customer_id"]=str(user["id"])
    return _order_out(db,db.orders.find_one(q))

def update_order_status(db,order_ref,status_value):
    o=db.orders.find_one({"id":str(order_ref)}) or db.orders.find_one({"order_number":str(order_ref)})
    if not o:return None
    db.orders.update_one({"id":o["id"]},{"$set":{"status":getattr(status_value,"value",status_value),"updated_at":datetime.now(timezone.utc)}})
    return get_order(db,o["id"])
