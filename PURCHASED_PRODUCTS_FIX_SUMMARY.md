# FarmCraft Purchased Products Fix

## What was changed
1. Backend order items now preserve purchase-time product image and category, in addition to product name, SKU, quantity, unit price and subtotal.
2. Backend customer snapshot now preserves customer phone/mobile and the checkout address snapshot.
3. Admin Purchased Products now reads the raw `/api/admin/orders` response and renders EVERY order item as a separate purchased-product row.
4. Admin Purchased Products no longer silently treats API failures as an empty list; it shows a backend/API error and retry action.
5. Admin Order Detail now loads the real order by database ID/order number and displays every purchased product plus customer/order/payment details.
6. Admin Invoice now lists every purchased product instead of only the first item.
7. Historical purchase price continues to come from `order_items.unit_price`, not the product's current price.
8. No dummy purchase records, hardcoded purchases, second order system, or authentication bypass was added.

## Files changed
- `backend/app/schemas/order.py`
- `backend/app/services/order_service.py`
- `admin/src/data/orderStorage.ts`
- `admin/src/pages/PurchasedProducts.tsx`
- `admin/src/pages/OrderDetail.tsx`
- `admin/src/pages/Invoice.tsx`

## Validation
- Python backend source compilation: passed.
- Existing backend pytest suite could not start in this sandbox because `pymongo` is not installed in the execution environment.
- Admin production build could not be completed because the supplied Admin project has no installed dependencies; a dependency install was attempted but could not complete in the sandbox. No partial `node_modules` directory is included in the deliverable.

## Run commands
Backend:
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Admin:
```bash
cd admin
npm install
npm run dev
```

Customer:
```bash
cd customer
npm install
npm run dev
```

## Database note
MongoDB does not require a relational migration for these new optional snapshot fields. New purchases automatically store the additional purchase-time fields. Existing historical orders created before this fix may not contain the newly added image/category snapshot fields; the implementation does not overwrite historical prices or fabricate missing historical data.
