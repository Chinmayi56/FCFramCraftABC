"""MongoDB connection and request dependency for Farm-Craft."""

import logging
from contextlib import contextmanager
from typing import Generator

from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.database import Database

from app.config import settings

logger = logging.getLogger("app.database")

_client: MongoClient | None = None


# Collections used by the Farm-Craft application.
COLLECTIONS = (
    "users",
    "products",
    "carts",
    "cart_items",
    "orders",
    "order_items",
    "otps",
    "password_resets",
    "stock_movements",
    "contact_messages",
    "company_settings",
)


def get_client() -> MongoClient:
    """Return the shared MongoDB client."""
    global _client

    if _client is None:
        _client = MongoClient(
            settings.mongo_url,
            serverSelectionTimeoutMS=3000,
        )

    return _client


def get_database() -> Database:
    """Return the configured Farm-Craft MongoDB database."""
    return get_client()[settings.mongo_db_name]


def get_db() -> Generator[Database, None, None]:
    """FastAPI dependency that provides a MongoDB database."""
    yield get_database()


@contextmanager
def get_db_context() -> Generator[Database, None, None]:
    """Provide a MongoDB database for non-FastAPI code."""
    yield get_database()


def connection_target_description() -> str:
    """Return a safe description of the current MongoDB target."""
    return (
        f"mongodb host={settings.mongo_url} "
        f"database={settings.mongo_db_name}"
    )


def check_database_connection() -> bool:
    """Check whether MongoDB is reachable."""
    try:
        get_client().admin.command("ping")
        return True

    except Exception as exc:
        logger.error(
            "MongoDB connection failed (%s). Target: %s",
            type(exc).__name__,
            connection_target_description(),
        )
        return False


def ensure_indexes_and_seed() -> None:
    """
    Create useful MongoDB indexes.

    This function intentionally does NOT create a demo/admin account.
    Existing admin accounts are preserved exactly as they are.
    """
    db = get_database()

    # ---------------------------------------------------------
    # Users
    # ---------------------------------------------------------
    db.users.create_index(
        [("email", ASCENDING)],
        unique=True,
        partialFilterExpression={
            "email": {"$type": "string"}
        },
    )

    db.users.create_index(
        [("mobile", ASCENDING)],
        unique=True,
        partialFilterExpression={
            "mobile": {"$type": "string"}
        },
    )

    # ---------------------------------------------------------
    # Products
    # ---------------------------------------------------------
    db.products.create_index(
        [("sku", ASCENDING)],
        unique=True,
    )

    db.products.create_index(
        [("created_at", DESCENDING)]
    )

    db.products.create_index(
        [("category", ASCENDING)]
    )

    db.products.create_index(
        [("status", ASCENDING)]
    )

    # ---------------------------------------------------------
    # Cart
    # ---------------------------------------------------------
    db.carts.create_index(
        [("customer_id", ASCENDING)],
        unique=True,
    )

    db.cart_items.create_index(
        [("cart_id", ASCENDING)]
    )

    db.cart_items.create_index(
        [("product_id", ASCENDING)]
    )

    # ---------------------------------------------------------
    # Orders
    # ---------------------------------------------------------
    db.orders.create_index(
        [
            ("customer_id", ASCENDING),
            ("created_at", DESCENDING),
        ]
    )

    db.orders.create_index(
        [("order_number", ASCENDING)],
        unique=True,
    )

    db.orders.create_index(
        [("purchase_code", ASCENDING)],
        unique=True,
    )

    db.order_items.create_index(
        [("order_id", ASCENDING)]
    )

    # ---------------------------------------------------------
    # Stock movements
    # ---------------------------------------------------------
    db.stock_movements.create_index(
        [
            ("product_id", ASCENDING),
            ("created_at", DESCENDING),
        ]
    )

    # ---------------------------------------------------------
    # Customer OTP
    # ---------------------------------------------------------
    db.otps.create_index(
        [
            ("mobile", ASCENDING),
            ("created_at", DESCENDING),
        ]
    )

    # ---------------------------------------------------------
    # Admin password reset
    # ---------------------------------------------------------
    db.password_resets.create_index(
        [
            ("email", ASCENDING),
            ("created_at", DESCENDING),
        ]
    )

    # Automatically remove expired password-reset records.
    db.password_resets.create_index(
        [("expires_at", ASCENDING)],
        expireAfterSeconds=0,
    )

    # ---------------------------------------------------------
    # Contact messages
    # ---------------------------------------------------------
    db.contact_messages.create_index(
        [("created_at", DESCENDING)]
    )

    logger.info(
        "MongoDB indexes ensured successfully for database '%s'.",
        settings.mongo_db_name,
    )


def close_client() -> None:
    """Close the shared MongoDB client."""
    global _client

    if _client is not None:
        _client.close()
        _client = None