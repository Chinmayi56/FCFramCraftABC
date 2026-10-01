from datetime import datetime, timedelta, timezone
from pymongo.database import Database
from uuid import uuid4
import secrets
import smtplib
from email.message import EmailMessage

from app.config import settings
from app.models.user import UserRole
from app.utils.security import hash_secret, verify_secret


class AuthError(Exception):
    pass


# ============================================================
# Common helpers
# ============================================================

def normalize_mobile(mobile: str) -> str:
    digits = "".join(ch for ch in str(mobile) if ch.isdigit())

    if digits.startswith("91") and len(digits) == 12:
        digits = digits[2:]

    if len(digits) != 10 or digits[0] not in "6789":
        raise AuthError("Enter a valid 10-digit Indian mobile number")

    return digits


def get_user_by_email(db: Database, email: str) -> dict | None:
    return db.users.find_one(
        {
            "email": email.strip().lower()
        }
    )


# ============================================================
# ADMIN LOGIN
# ============================================================

def authenticate_admin(
    db: Database,
    email: str,
    password: str,
) -> dict:
    """
    Authenticate an existing admin account.

    Uses the real MongoDB users collection and the existing
    password hashing system.

    No demo credentials are created or accepted here.
    """

    user = get_user_by_email(db, email)

    if (
        not user
        or user.get("role") != UserRole.ADMIN.value
        or not user.get("password_hash")
    ):
        raise AuthError("Invalid email or password")

    if not verify_secret(password, user["password_hash"]):
        raise AuthError("Invalid email or password")

    if not user.get("is_active", True):
        raise AuthError("Invalid email or password")

    return user


# ============================================================
# CUSTOMER LOGIN
# ============================================================

def authenticate_customer(
    db: Database,
    name: str,
    mobile: str,
) -> dict:
    """
    Customer login using name + mobile.

    A customer does not need a pre-existing account.
    If the mobile number is new, create a CUSTOMER record.
    """

    mobile = normalize_mobile(mobile)
    name = name.strip()

    if not name:
        raise AuthError("Full name is required")

    now = datetime.now(timezone.utc)

    user = db.users.find_one(
        {
            "mobile": mobile
        }
    )

    # New customer
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

    # Existing account must be customer
    if user.get("role") != UserRole.CUSTOMER.value:
        raise AuthError(
            "This mobile number is registered as an Admin account"
        )

    if not user.get("is_active", True):
        raise AuthError("This account has been disabled")

    # Update display name if changed
    if user.get("name") != name:
        db.users.update_one(
            {"_id": user["_id"]},
            {
                "$set": {
                    "name": name,
                    "updated_at": now,
                }
            },
        )

        user["name"] = name
        user["updated_at"] = now

    return user


# ============================================================
# ADMIN PROFILE
# ============================================================

def update_admin_profile(
    db: Database,
    user_id: str,
    name: str | None,
    email: str | None,
) -> dict:
    """
    Update the signed-in admin's own name/email.
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

        existing = db.users.find_one(
            {
                "email": email
            }
        )

        if existing and existing.get("id") != user_id:
            raise AuthError(
                "This email is already in use by another account"
            )

        updates["email"] = email

    if not updates:
        user = db.users.find_one(
            {
                "id": user_id
            }
        )

        if user is None:
            raise AuthError("Account not found")

        return user

    updates["updated_at"] = datetime.now(timezone.utc)

    result = db.users.update_one(
        {
            "id": user_id
        },
        {
            "$set": updates
        },
    )

    if result.matched_count == 0:
        raise AuthError("Account not found")

    return db.users.find_one(
        {
            "id": user_id
        }
    )


# ============================================================
# CUSTOMER OTP
# ============================================================

def send_customer_otp(
    db: Database,
    mobile: str,
) -> None:
    mobile = normalize_mobile(mobile)

    now = datetime.now(timezone.utc)

    db.otps.insert_one(
        {
            "id": str(uuid4()),
            "mobile": mobile,
            "otp_hash": hash_secret(
                settings.otp_demo_code
            ),
            "attempts": 0,
            "is_used": False,
            "expires_at": now
            + timedelta(
                minutes=settings.otp_expire_minutes
            ),
            "created_at": now,
        }
    )


def verify_customer_otp(
    db: Database,
    name: str,
    mobile: str,
    otp_code: str,
) -> dict:
    mobile = normalize_mobile(mobile)
    name = name.strip()

    if not name:
        raise AuthError("Full name is required")

    otp = db.otps.find_one(
        {
            "mobile": mobile,
            "is_used": False,
        },
        sort=[
            ("created_at", -1)
        ],
    )

    if not otp:
        raise AuthError(
            "No OTP request found for this mobile number. "
            "Please request a new OTP."
        )

    if otp.get("attempts", 0) >= settings.otp_max_attempts:
        raise AuthError(
            "Too many incorrect attempts. "
            "Please request a new OTP."
        )

    expires_at = otp["expires_at"]

    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(
            tzinfo=timezone.utc
        )

    if expires_at < datetime.now(timezone.utc):
        raise AuthError(
            "OTP has expired. Please request a new one."
        )

    if not verify_secret(
        otp_code,
        otp["otp_hash"],
    ):
        db.otps.update_one(
            {
                "_id": otp["_id"]
            },
            {
                "$inc": {
                    "attempts": 1
                }
            },
        )

        raise AuthError("Incorrect OTP")

    db.otps.update_one(
        {
            "_id": otp["_id"]
        },
        {
            "$set": {
                "is_used": True
            }
        },
    )

    user = db.users.find_one(
        {
            "mobile": mobile
        }
    )

    now = datetime.now(timezone.utc)

    # New customer
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
        raise AuthError(
            "This mobile number is registered as an Admin account"
        )

    elif not user.get("is_active", True):
        raise AuthError(
            "This account has been disabled"
        )

    return user


# ============================================================
# ADMIN PASSWORD RESET
# ============================================================

def validate_admin_password(password: str) -> None:
    """
    Validate the new admin password.

    Requirements:
    - Minimum 8 characters
    - Uppercase
    - Lowercase
    - Number
    """

    if len(password) < 8:
        raise AuthError(
            "Password must contain at least 8 characters."
        )

    if not any(
        char.isupper()
        for char in password
    ):
        raise AuthError(
            "Password must contain at least one uppercase letter."
        )

    if not any(
        char.islower()
        for char in password
    ):
        raise AuthError(
            "Password must contain at least one lowercase letter."
        )

    if not any(
        char.isdigit()
        for char in password
    ):
        raise AuthError(
            "Password must contain at least one number."
        )


def _send_admin_reset_email(
    email: str,
    code: str,
) -> None:
    """
    Send the admin password reset code through SMTP.

    SMTP credentials are read only from backend settings.
    They are never exposed to the frontend.
    """

    if not settings.smtp_host:
        raise AuthError(
            "Password reset email service is not configured."
        )

    message = EmailMessage()

    message["Subject"] = (
        "Farm Craft Admin Password Reset"
    )

    message["From"] = (
        settings.smtp_from
        or settings.smtp_username
    )

    message["To"] = email

    message.set_content(
        f"""Farm Craft Admin Password Reset

Your password reset code is:

{code}

This code will expire in {
    settings.password_reset_expire_minutes
} minutes.

If you did not request this password reset,
please ignore this email.

Farm Craft
"""
    )

    try:

        # SSL SMTP
        if settings.smtp_use_ssl:

            with smtplib.SMTP_SSL(
                settings.smtp_host,
                settings.smtp_port,
                timeout=15,
            ) as server:

                server.login(
                    settings.smtp_username,
                    settings.smtp_password,
                )

                server.send_message(
                    message
                )

        # Normal SMTP / STARTTLS
        else:

            with smtplib.SMTP(
                settings.smtp_host,
                settings.smtp_port,
                timeout=15,
            ) as server:

                server.ehlo()

                if settings.smtp_use_tls:
                    server.starttls()
                    server.ehlo()

                server.login(
                    settings.smtp_username,
                    settings.smtp_password,
                )

                server.send_message(
                    message
                )

    except Exception as exc:

        raise AuthError(
            "Unable to send the password reset email. "
            "Please try again later."
        ) from exc


def request_admin_password_reset(
    db: Database,
    email: str,
) -> None:
    """
    Start an admin password reset.

    Important:
    This function intentionally does not reveal whether
    an email address belongs to an admin account.
    """

    normalized_email = (
        email.strip().lower()
    )

    user = db.users.find_one(
        {
            "email": normalized_email,
            "role": UserRole.ADMIN.value,
            "is_active": True,
        }
    )

    # Do not reveal whether the account exists.
    if user is None:
        return

    now = datetime.now(timezone.utc)

    # Invalidate previous reset requests.
    db.password_resets.update_many(
        {
            "email": normalized_email,
            "used": False,
        },
        {
            "$set": {
                "used": True,
                "invalidated_at": now,
            }
        },
    )

    # Generate a cryptographically secure 6-digit code.
    code = f"{secrets.randbelow(1_000_000):06d}"

    reset_record = {
        "id": str(uuid4()),
        "email": normalized_email,

        # Never store the reset code itself.
        "code_hash": hash_secret(code),

        "attempts": 0,
        "verified": False,
        "used": False,

        "created_at": now,

        "expires_at": now
        + timedelta(
            minutes=settings.password_reset_expire_minutes
        ),
    }

    db.password_resets.insert_one(
        reset_record
    )

    try:

        _send_admin_reset_email(
            normalized_email,
            code,
        )

    except Exception:

        # If email delivery fails, immediately invalidate
        # the reset request.
        db.password_resets.update_one(
            {
                "_id": reset_record["_id"]
            },
            {
                "$set": {
                    "used": True
                }
            },
        )

        raise


def verify_admin_password_reset(
    db: Database,
    email: str,
    code: str,
) -> None:
    """
    Verify the 6-digit admin password reset code.
    """

    normalized_email = (
        email.strip().lower()
    )

    reset = db.password_resets.find_one(
        {
            "email": normalized_email,
            "used": False,
        },
        sort=[
            ("created_at", -1)
        ],
    )

    if not reset:
        raise AuthError(
            "Invalid or expired reset code."
        )

    expires_at = reset["expires_at"]

    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(
            tzinfo=timezone.utc
        )

    if expires_at < datetime.now(timezone.utc):
        raise AuthError(
            "Invalid or expired reset code."
        )

    # Prevent unlimited guessing.
    if (
        reset.get("attempts", 0)
        >= settings.password_reset_max_attempts
    ):
        raise AuthError(
            "Too many incorrect attempts. "
            "Please request a new code."
        )

    if not verify_secret(
        code,
        reset["code_hash"],
    ):

        db.password_resets.update_one(
            {
                "_id": reset["_id"]
            },
            {
                "$inc": {
                    "attempts": 1
                }
            },
        )

        raise AuthError(
            "Invalid or expired reset code."
        )

    # Code is valid.
    db.password_resets.update_one(
        {
            "_id": reset["_id"]
        },
        {
            "$set": {
                "verified": True,
                "verified_at": datetime.now(
                    timezone.utc
                ),
            }
        },
    )


def reset_admin_password(
    db: Database,
    email: str,
    new_password: str,
) -> None:
    """
    Update the existing admin account's password.

    The password is hashed using the project's existing
    hash_secret() implementation.
    """

    validate_admin_password(
        new_password
    )

    normalized_email = (
        email.strip().lower()
    )

    reset = db.password_resets.find_one(
        {
            "email": normalized_email,
            "used": False,
            "verified": True,
        },
        sort=[
            ("created_at", -1)
        ],
    )

    if not reset:
        raise AuthError(
            "Password reset request is invalid or expired."
        )

    expires_at = reset["expires_at"]

    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(
            tzinfo=timezone.utc
        )

    if expires_at < datetime.now(timezone.utc):
        raise AuthError(
            "Password reset request is invalid or expired."
        )

    # Find the existing admin.
    user = db.users.find_one(
        {
            "email": normalized_email,
            "role": UserRole.ADMIN.value,
            "is_active": True,
        }
    )

    if not user:
        raise AuthError(
            "Password reset request is invalid or expired."
        )

    now = datetime.now(timezone.utc)

    # Update ONLY the existing admin password.
    db.users.update_one(
        {
            "_id": user["_id"]
        },
        {
            "$set": {
                "password_hash": hash_secret(
                    new_password
                ),
                "updated_at": now,
            }
        },
    )

    # Make reset request one-time use.
    db.password_resets.update_one(
        {
            "_id": reset["_id"]
        },
        {
            "$set": {
                "used": True,
                "used_at": now,
            }
        },
    )

