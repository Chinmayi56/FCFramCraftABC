from pydantic import BaseModel, EmailStr, Field, HttpUrl

class CompanySettings(BaseModel):
    company_name: str = "Farm Craft"
    address: str = ""
    mobile_numbers: list[str] = Field(default_factory=list)
    whatsapp_numbers: list[str] = Field(default_factory=list)
    website: str = ""
    email: EmailStr | None = None
    gstin: str = ""

class CompanySettingsUpdate(BaseModel):
    company_name: str = "Farm Craft"
    address: str = ""
    mobile_numbers: list[str] = Field(default_factory=list)
    whatsapp_numbers: list[str] = Field(default_factory=list)
    website: str = ""
    email: EmailStr | None = None
    gstin: str = ""
