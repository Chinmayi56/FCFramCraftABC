import uuid
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field
from app.models.order import OrderStatus, OrderMethod, PaymentMethod, PaymentStatus

class CartItemAdd(BaseModel):
    product_id: uuid.UUID
    quantity: int = Field(ge=1)

class CartItemUpdate(BaseModel):
    quantity: int = Field(ge=1)

class CartProductOut(BaseModel):
    id: uuid.UUID
    name: str
    sku: str
    price: Decimal | None = None
    discount_price: Decimal | None = None
    stock: int
    image: str | None = None

class CartItemOut(BaseModel):
    id: uuid.UUID
    quantity: int
    product: CartProductOut

class CartOut(BaseModel):
    id: uuid.UUID
    items: list[CartItemOut]
    total: Decimal

class OrderCreate(BaseModel):
    address: dict
    mobile: str | None = None
    configuration: str | None = None
    order_method: str | None = None

class OrderItemOut(BaseModel):
    # Orders already stored in MongoDB may have IDs from older data/imports.
    # Admin history must be able to display those records without response
    # validation turning the whole /admin/orders endpoint into HTTP 500.
    id: str
    product_id: str
    product_name: str
    sku: str
    image: str | None = None
    category: str | None = None
    quantity: int
    unit_price: Decimal
    subtotal: Decimal
    configuration: str | None = None

class OrderOut(BaseModel):
    id: str
    order_number: str
    purchase_code: str
    customer_id: str
    status: OrderStatus
    order_method: OrderMethod
    payment_method: PaymentMethod
    payment_status: PaymentStatus
    total_amount: Decimal
    shipping_address: dict
    customer_snapshot: dict
    created_at: datetime
    updated_at: datetime
    items: list[OrderItemOut]
    model_config = {'from_attributes': True}

class OrderStatusUpdate(BaseModel):
    status: OrderStatus

class StockAdjust(BaseModel):
    quantity_change: int
    reason: str = Field(min_length=1, max_length=100)

class StockOut(BaseModel):
    product_id: uuid.UUID
    stock: int

class ReportSummary(BaseModel):
    total_orders: int
    total_sales: Decimal
    pending_orders: int
    customers: int
    products: int
    low_stock_products: int
