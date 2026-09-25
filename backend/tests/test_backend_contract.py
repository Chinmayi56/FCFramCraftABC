from app.main import app
from app.schemas.auth import AdminLoginRequest, VerifyOtpRequest
from app.schemas.product import ProductCreate

def test_expected_routes_exist():
    paths={r.path for r in app.routes}
    for path in ["/api/health","/api/auth/admin/login","/api/auth/customer/send-otp",
                 "/api/auth/customer/verify-otp","/api/products","/api/cart","/api/orders"]:
        assert path in paths

def test_customer_identity_contract():
    payload=VerifyOtpRequest(name="Test Customer",mobile="9876543210",otp="1234")
    assert payload.name=="Test Customer"
    assert payload.mobile=="9876543210"

def test_product_price_is_optional():
    p=ProductCreate(name="Test",category="Equipment",sku="TEST-001",price=None,stock=0)
    assert p.price is None
