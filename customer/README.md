# Farm Craft — Customer Storefront

Customer-facing Farm Craft storefront connected to the FastAPI backend.

## Run locally

```bash
npm install
npm run dev
```

The customer Vite app runs on `http://127.0.0.1:5174` and proxies `/api` to `http://127.0.0.1:8000` during local development.

For production, `.env.production` points the frontend to the deployed Farm Craft API through `VITE_API_BASE_URL`.

## Customer features

- Customer OTP login/authentication
- Live product catalog from the backend
- Product categories, search, filters and product details
- Working authenticated cart
- Add, increase, decrease and remove cart items
- Checkout with delivery address
- Cash on Delivery / Visit Company order method
- Purchase request and purchase code
- My Orders and order details
- Downloadable invoice
- Wishlist and customer profile

### Cart and pricing behavior

Products can be added to the cart even when the backend product does not have a public price. The customer-facing cart and checkout intentionally do not display a total amount. The backend keeps the order calculation internally so the purchase request can still be submitted.

## Customer API

Set `VITE_API_BASE_URL` to the FastAPI `/api` base URL. The included production environment currently uses:

`https://farmcarft-5.onrender.com/api`
