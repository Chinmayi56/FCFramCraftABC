"""Pydantic request/response schemas for authentication endpoints."""

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models.user import UserRole


# ============================================================
# ADMIN LOGIN
# ============================================================

class AdminLoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


# ============================================================
# ADMIN PASSWORD RESET
# ============================================================

class AdminForgotPasswordRequest(BaseModel):
    email: EmailStr


class AdminVerifyResetRequest(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6)


class AdminResetPasswordRequest(BaseModel):
    email: EmailStr
    new_password: str = Field(min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if not any(char.isupper() for char in value):
            raise ValueError(
                "Password must contain at least one uppercase letter."
            )

        if not any(char.islower() for char in value):
            raise ValueError(
                "Password must contain at least one lowercase letter."
            )

        if not any(char.isdigit() for char in value):
            raise ValueError(
                "Password must contain at least one number."
            )

        return value


# ============================================================
# CUSTOMER MOBILE / OTP
# ============================================================

class MobileRequestMixin(BaseModel):
    mobile: str = Field(min_length=10, max_length=15)

    @field_validator("mobile")
    @classmethod
    def validate_mobile(cls, value: str) -> str:
        digits = "".join(
            ch for ch in value
            if ch.isdigit()
        )

        if digits.startswith("91") and len(digits) == 12:
            digits = digits[2:]

        if len(digits) != 10 or digits[0] not in "6789":
            raise ValueError(
                "Enter a valid 10-digit Indian mobile number"
            )

        return digits


class SendOtpRequest(MobileRequestMixin):
    pass


class VerifyOtpRequest(MobileRequestMixin):
    name: str = Field(
        min_length=1,
        max_length=150,
    )

    otp: str = Field(
        min_length=4,
        max_length=4,
    )


class CustomerLoginRequest(MobileRequestMixin):
    name: str = Field(
        min_length=1,
        max_length=150,
    )


# ============================================================
# USER RESPONSE
# ============================================================

class UserOut(BaseModel):
    id: uuid.UUID
    name: str | None = None
    email: EmailStr | None = None
    mobile: str | None = None
    role: UserRole
    is_active: bool
    created_at: datetime

    model_config = {
        "from_attributes": True
    }


# ============================================================
# ADMIN PROFILE
# ============================================================

class AdminProfileUpdate(BaseModel):
    name: str | None = Field(
        default=None,
        max_length=150,
    )

    email: EmailStr | None = None


# ============================================================
# AUTH RESPONSES
# ============================================================

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class MessageResponse(BaseModel):
    message: str