from datetime import datetime, timedelta, timezone
from pymongo.database import Database
from uuid import uuid4
from app.config import settings
from app.models.user import UserRole
from app.utils.security import hash_secret, verify_secret

class AuthError(Exception): pass

def normalize_mobile(mobile: str) -> str:
    digits = "".join(ch for ch in str(mobile) if ch.isdigit())
    if digits.startswith("91") and len(digits) == 12:
        digits = digits[2:]
    if len(digits) != 10 or digits[0] not in "6789":
        raise AuthError("Enter a valid 10-digit Indian mobile number")
    return digits

def get_user_by_email(db: Database, email: str) -> dict | None:
    return db.users.find_one({"email": email.strip().lower()})

def authenticate_admin(db: Database, email: str, password: str) -> dict:
    user = get_user_by_email(db, email)
    if not user or user.get("role") != UserRole.ADMIN.value or not user.get("password_hash"):
        raise AuthError("Invalid email or password")
    if not verify_secret(password, user["password_hash"]):
        raise AuthError("Invalid email or password")
    if not user.get("is_active", True):
        raise AuthError("This account has been disabled")
    return user

def authenticate_customer(db: Database, name: str, mobile: str) -> dict:
    """Demo customer login: name + mobile only.

    A customer does not need a pre-existing account. If the mobile number is
    new, create a real CUSTOMER record automatically. If it already exists,
    reuse that customer and update the display name. This function never
    rejects a normal customer login because the mobile number is unknown.
    """
    mobile = normalize_mobile(mobile)
    name = name.strip()

    if not name:
        raise AuthError("Full name is required")

    now = datetime.now(timezone.utc)
    user = db.users.find_one({"mobile": mobile})

    # New customer: automatically create the account behind the scenes.
    if user is None:
        user = {
            "id": str(uuid4()),
            "name": name,
            "email": None,
            "mobile": mobile,
            "password_hash": None,
            "role": UserRole.CUSTOMER.value,
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        }
        db.users.insert_one(user)
        return user

    # Existing customer: reuse the same identity.
    if user.get("role") != UserRole.CUSTOMER.value:
        raise AuthError("This mobile number is registered as an Admin account")

    if not user.get("is_active", True):
        raise AuthError("This account has been disabled")

    if user.get("name") != name:
        db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"name": name, "updated_at": now}},
        )
        user["name"] = name
        user["updated_at"] = now

    return user

def update_admin_profile(db: Database, user_id: str, name: str | None, email: str | None) -> dict:
    """Update the signed-in admin's own name/email.

    Traces the full flow the Admin Profile screen relies on: validate the
    new email isn't already used by a different account, persist it on the
    real `users` record (the same collection `authenticate_admin` reads
    from), and return the fresh record so the UI reflects exactly what was
    saved — including after a page refresh, since the frontend re-stores
    whatever this endpoint returns.
    """
    updates: dict = {}

    if name is not None:
        name = name.strip()
        if not name:
            raise AuthError("Name cannot be empty")
        updates["name"] = name

    if email is not None:
        email = email.strip().lower()
        if not email:
            raise AuthError("Email cannot be empty")
        existing = db.users.find_one({"email": email})
        if existing and existing.get("id") != user_id:
            raise AuthError("This email is already in use by another account")
        updates["email"] = email

    if not updates:
        user = db.users.find_one({"id": user_id})
        if user is None:
            raise AuthError("Account not found")
        return user

    updates["updated_at"] = datetime.now(timezone.utc)
    result = db.users.update_one({"id": user_id}, {"$set": updates})
    if result.matched_count == 0:
        raise AuthError("Account not found")

    return db.users.find_one({"id": user_id})


def send_customer_otp(db: Database, mobile: str) -> None:
    from uuid import uuid4
    mobile = normalize_mobile(mobile)
    now = datetime.now(timezone.utc)
    db.otps.insert_one({
        "id": str(uuid4()),
        "mobile": mobile,
        "otp_hash": hash_secret(settings.otp_demo_code),
        "attempts": 0,
        "is_used": False,
        "expires_at": now + timedelta(minutes=settings.otp_expire_minutes),
        "created_at": now,
    })

def verify_customer_otp(db: Database, name: str, mobile: str, otp_code: str) -> dict:
    mobile = normalize_mobile(mobile)
    name = name.strip()
    if not name:
        raise AuthError("Full name is required")
    otp = db.otps.find_one({"mobile": mobile, "is_used": False},
                           sort=[("created_at", -1)])
    if not otp:
        raise AuthError("No OTP request found for this mobile number. Please request a new OTP.")
    if otp.get("attempts", 0) >= settings.otp_max_attempts:
        raise AuthError("Too many incorrect attempts. Please request a new OTP.")
    expires_at = otp["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise AuthError("OTP has expired. Please request a new one.")
    if not verify_secret(otp_code, otp["otp_hash"]):
        db.otps.update_one({"_id": otp["_id"]}, {"$inc": {"attempts": 1}})
        raise AuthError("Incorrect OTP")
    db.otps.update_one({"_id": otp["_id"]}, {"$set": {"is_used": True}})
    user = db.users.find_one({"mobile": mobile})
    now = datetime.now(timezone.utc)
    if user is None:
        user = {
            "id": str(uuid4()),
            "name": name,
            "email": None,
            "mobile": mobile,
            "password_hash": None,
            "role": UserRole.CUSTOMER.value,
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        }
        db.users.insert_one(user)
    elif user.get("role") != UserRole.CUSTOMER.value:
        raise AuthError("This mobile number is registered as an Admin account")
    elif not user.get("is_active", True):
        raise AuthError("This account has been disabled")
    return user
