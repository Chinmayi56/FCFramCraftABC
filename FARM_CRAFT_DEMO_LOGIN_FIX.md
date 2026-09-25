# Farm Craft — Customer Demo Login Fix

## What changed

Only the customer login backend logic was changed. Everything else (Customer
UI, Admin UI, Products, Cart, Orders, Admin Purchased Products, Admin login)
is untouched.

The **Customer frontend already matched the requested design** — the login
page at `customer/src/pages.js` only asks for **Full Name** + **Mobile
Number** and has a single **Login** button, with no signup, OTP, or password
UI. No frontend changes were needed or made.

The one real gap was on the backend: `POST /api/auth/customer/login`
required a customer to already exist and returned `404 Customer not found`
otherwise, forcing new customers through the (separate, still-present but
now unused by the login page) OTP flow.

### Backend change

**File:** `backend/app/services/auth_service.py` — `authenticate_customer()`

- No longer requires an existing account.
- On first login for a mobile number: creates a lightweight demo customer
  record automatically (`role: CUSTOMER`, no password) and logs the person
  in immediately.
- On a later login with the same mobile number: reuses the same customer
  record (no duplicate created) and updates its display name to whatever
  was just typed, so "Welcome, <name>" always reflects the current session.
- Still blocks the two genuine edge cases: a mobile number already
  registered as an Admin account, or a deactivated account.

**File:** `backend/app/routers/auth.py`

- `POST /api/auth/customer/login` now returns `400` (a validation-style
  error) instead of `404` for the (now rare) blocked cases above, since the
  demo flow must never say "customer not found".

Route, request/response shape, and JWT/session mechanism
(`fc_auth_token` / `fc_auth_session`, handled entirely in the existing
`customer/src/services.js`) are all unchanged. Admin login
(`POST /api/auth/admin/login`) was not touched.

## How the flow works now

```
Customer Name + Mobile Number
            ↓
POST /api/auth/customer/login
            ↓
Existing demo customer (same mobile)? → reuse record, sync name
No existing record?                   → create demo customer automatically
            ↓
JWT issued
            ↓
Customer Session (fc_auth_token / fc_auth_session)
            ↓
Customer Dashboard — name/mobile shown come from the session/token
```

Products, Cart, Checkout and Order creation are unchanged; orders already
stored `customer_id`, `customer_name`, and `mobile` from the logged-in user
object, so Admin → Purchased Products continues to show the real entered
name and mobile for every order.

## Tests performed

- Backend Python source compiles (`ast.parse` / `python -m py_compile`) —
  no syntax errors.
- Logic-level test of `authenticate_customer()` against an in-memory fake
  Mongo collection, run in this sandbox (pymongo/pydantic aren't installable
  here, offline):
  - New customer ("Rahul Kumar", "9876543210") → creates a record, logs in,
    no error.
  - Same mobile, different name ("Rahul K.") → same customer id reused,
    display name updated.
  - Second new customer ("Suresh Kumar", "9123456789") → creates a second,
    independent record.
  - Empty name → rejected with a validation message (not a 404/signup
    prompt).
  - Malformed mobile number → rejected with a validation message.
- Could not run the live FastAPI app or the Customer frontend build in this
  environment (no network access to install `pymongo`/`pydantic`/npm
  packages, and no running MongoDB instance). Please run the existing test
  suite (`backend/tests/test_backend_contract.py`) and do a manual
  end-to-end pass — login with a brand-new name/mobile, confirm the
  dashboard loads, add a product to cart, checkout, and confirm the order
  and the correct customer name/mobile appear under Admin → Purchased
  Products.

## Remaining issues / notes

- The OTP endpoints (`/api/auth/customer/send-otp`,
  `/api/auth/customer/verify-otp`) and their schemas/models still exist in
  the backend but are no longer called by the Customer Login page. They
  were left in place rather than deleted, since removing them wasn't asked
  for and isn't needed to satisfy the requirement (only the login page and
  its request flow needed to stop requiring OTP/signup) — let me know if
  you'd like them removed entirely.
- No database migrations were needed (MongoDB is schema-less here; the
  `users` collection already has a unique partial index on `mobile`, which
  the demo signup path relies on).
- No new environment variables were introduced.

## Backend run command

```
cd backend
python -m venv venv
venv\Scripts\activate        # or: source venv/bin/activate on macOS/Linux
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

MongoDB must be running locally at `mongodb://127.0.0.1:27017` (database
`farmcraft_db`), or `MONGO_URL` / `MONGO_DB_NAME` set to point elsewhere.

## Required environment variables (unchanged — see `backend/.env.example`)

```
APP_NAME, APP_ENV, APP_DEBUG, API_PREFIX
MONGO_URL, MONGO_DB_NAME
CORS_ORIGINS
JWT_SECRET_KEY, JWT_ALGORITHM, JWT_ACCESS_TOKEN_EXPIRE_MINUTES
OTP_EXPIRE_MINUTES, OTP_DEMO_CODE, OTP_MAX_ATTEMPTS   (kept, endpoints unused by the login page)
DEMO_ADMIN_EMAIL, DEMO_ADMIN_PASSWORD
```

## Files changed

- `backend/app/services/auth_service.py`
- `backend/app/routers/auth.py`

## Models changed

- None (no schema/model files edited — `users` documents already support
  demo customer records; no new fields introduced).

## APIs added/updated

- `POST /api/auth/customer/login` — behavior updated (auto-creates/reuses a
  demo customer instead of `404`ing); request/response shape unchanged.
  No routes added or removed.

## Security changes

- None beyond the above. Admin login, JWT issuance/verification, and
  role-based access (`require_admin` / `require_customer`) are unchanged.
