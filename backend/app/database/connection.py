"""MongoDB connection and request dependency for Farm-Craft."""
import logging
from contextlib import contextmanager
from typing import Generator
from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.database import Database

from app.config import settings
from app.utils.security import hash_secret

logger = logging.getLogger("app.database")
_client: MongoClient | None = None

COLLECTIONS = (
    "users", "products", "carts", "cart_items", "orders",
    "order_items", "otps", "stock_movements", "contact_messages", "company_settings",
)

def get_client() -> MongoClient:
    global _client
    if _client is None:
        _client = MongoClient(settings.mongo_url, serverSelectionTimeoutMS=3000)
    return _client

def get_database() -> Database:
    return get_client()[settings.mongo_db_name]

def get_db() -> Generator[Database, None, None]:
    yield get_database()

@contextmanager
def get_db_context() -> Generator[Database, None, None]:
    yield get_database()

def connection_target_description() -> str:
    return f"mongodb host={settings.mongo_url} database={settings.mongo_db_name}"

def check_database_connection() -> bool:
    try:
        get_client().admin.command("ping")
        return True
    except Exception as exc:
        logger.error("MongoDB connection failed (%s). Target: %s",
                     type(exc).__name__, connection_target_description())
        return False

def ensure_indexes_and_seed() -> None:
    """Create useful indexes and idempotently seed the demo admin."""
    db = get_database()
    db.users.create_index([("email", ASCENDING)], unique=True,
                          partialFilterExpression={"email": {"$type": "string"}})
    db.users.create_index([("mobile", ASCENDING)], unique=True,
                          partialFilterExpression={"mobile": {"$type": "string"}})
    db.products.create_index([("sku", ASCENDING)], unique=True)
    db.products.create_index([("created_at", DESCENDING)])
    db.products.create_index([("category", ASCENDING)])
    db.products.create_index([("status", ASCENDING)])
    db.carts.create_index([("customer_id", ASCENDING)], unique=True)
    db.cart_items.create_index([("cart_id", ASCENDING)])
    db.cart_items.create_index([("product_id", ASCENDING)])
    db.orders.create_index([("customer_id", ASCENDING), ("created_at", DESCENDING)])
    db.orders.create_index([("order_number", ASCENDING)], unique=True)
    db.orders.create_index([("purchase_code", ASCENDING)], unique=True)
    db.order_items.create_index([("order_id", ASCENDING)])
    db.stock_movements.create_index([("product_id", ASCENDING), ("created_at", DESCENDING)])
    db.otps.create_index([("mobile", ASCENDING), ("created_at", DESCENDING)])
    db.contact_messages.create_index([("created_at", DESCENDING)])

    email = settings.demo_admin_email.strip().lower()
    existing = db.users.find_one({"email": email})
    if existing is None:
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc)
        db.users.insert_one({
            "id": str(__import__("uuid").uuid4()),
            "name": "Farm Craft Admin",
            "email": email,
            "mobile": None,
            "password_hash": hash_secret(settings.demo_admin_password),
            "role": "ADMIN",
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        })
    elif existing.get("role") != "ADMIN":
        logger.warning("Demo admin email exists but is not an ADMIN; no duplicate was created.")

def close_client() -> None:
    global _client
    if _client is not None:
        _client.close()
        _client = None
