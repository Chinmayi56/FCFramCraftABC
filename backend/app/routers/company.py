from fastapi import APIRouter, Depends, HTTPException
from pymongo.database import Database
from app.database.connection import get_db
from app.schemas.company import CompanySettings, CompanySettingsUpdate
from app.utils.dependencies import require_admin

router = APIRouter(tags=["Company Settings"])

DEFAULTS = {
    "company_name": "Farm Craft",
    "address": "",
    "mobile_numbers": [],
    "whatsapp_numbers": [],
    "website": "",
    "email": None,
    "gstin": "",
}

def _clean(data):
    data = dict(data)
    data.pop("_id", None)
    for key in ("mobile_numbers", "whatsapp_numbers"):
        data[key] = [str(x).strip() for x in data.get(key, []) if str(x).strip()]
    return data

@router.get("/company", response_model=CompanySettings)
def get_company(db: Database = Depends(get_db)):
    doc = db.company_settings.find_one({"key": "default"})
    return _clean({**DEFAULTS, **(doc or {})})

@router.put("/company", response_model=CompanySettings)
@router.put("/admin/company", response_model=CompanySettings, include_in_schema=False)
def save_company(payload: CompanySettingsUpdate, db: Database = Depends(get_db), _: dict = Depends(require_admin)):
    data = payload.model_dump()
    if data.get("website") and not (data["website"].startswith("http://") or data["website"].startswith("https://")):
        raise HTTPException(422, "Website must be a valid URL starting with http:// or https://")
    data = _clean(data)
    db.company_settings.update_one({"key": "default"}, {"$set": {**data, "key": "default"}}, upsert=True)
    return _clean({**DEFAULTS, **data})
