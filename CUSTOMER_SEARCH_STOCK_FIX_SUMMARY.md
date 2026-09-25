# Farm Craft Customer Site — Search, Stock Notice & Audit (this pass)

This pass audited the customer site against the full 20-point requirements
list (product data from Admin/backend, Products page, Home, category
navigation, search, product detail scroll, site-wide scroll-to-top, cart
count, wishlist/cart customer isolation, "Get a Quote" wording, stock sync,
images, loading states, responsiveness, performance, API audit) and the
backend cart/order/product routes.

## Finding: most of the list was already implemented correctly

Earlier passes (see `FIX_NOTES.md`, `IMPLEMENTATION_STATUS.md`,
`MODIFICATION_SUMMARY.md`, `REPORTS_UPDATE_SUMMARY.md`,
`PURCHASED_PRODUCTS_FIX_SUMMARY.md`, `FARM_CRAFT_DEMO_LOGIN_FIX.md`) had
already correctly implemented, and this pass verified by reading the code
rather than re-implementing:

- Product data flow Admin → MongoDB → `/api/products` → customer catalog
  (`productService.load()` in `customer/src/services.js`), with real
  pagination (loops `skip`/`limit=200` until `total` is reached) and a
  distinct loading / error / empty state (`main.js`, `pages.js`).
- Central scroll-to-top on every route change (`main.js` `render()`, before
  any async load), with in-place re-renders (wishlist toggle, cart badge
  refresh) explicitly passing `resetScroll: false` so normal UI updates
  don't jump the page.
- "Explore Products" / "View all" → `#/shop` at the top of the page.
- Category → Products filtering with alias-based matching
  (`productService.search()`'s `categorySlug()`/`aliases` map) tolerant of
  `Grain Transferring` / `grain-transferring` / `grain-transfer` style
  differences.
- Cart badge computed from the real backend cart (`GET /cart`) after every
  render, not from localStorage.
- Wishlist and saved addresses are namespaced per signed-in customer
  (`customerStorageKey()`), so Customer B never sees Customer A's data.
- Cart is fully backend-scoped: every cart/order route in
  `backend/app/routers/orders.py` resolves the cart via
  `user["id"]` from the JWT (`require_customer`), never a shared/global
  store — verified this stays true for add/update/remove/clear.
- "Get a Code" already reads "Get a Quote" everywhere in the customer UI,
  and the modal already reads "Get Your Farm Craft Purchase Quote"
  (`getCodeModal.js`, `pages.js`, `components.js`).
- Out-of-stock disables Add to Cart / Get a Quote and shows a stock badge
  driven by real backend `stock` (`normalizeProduct()`'s `stockStatus`).
- `/api/products` pagination (`skip`/`limit`, max `limit=200`) matches what
  the customer catalog loader expects.
- Product images are stored as embedded data URLs from the Admin upload
  form (`admin/src/components/products/ProductForm.tsx`), so there is no
  relative/absolute/backend-hosted URL mismatch to handle on the customer
  side; `imgWithFallback()` already degrades to a placeholder on a broken
  image.

No changes were made to any of the above — they were verified, not
re-implemented, to avoid touching working functionality.

## Actual gaps found and fixed in this pass

1. **Header search only matched products, not pages/modules** (requirement
   5). Search now also matches customer-site pages/modules — Home,
   Products, About Us, Services, Contact, Wishlist, Cart, My Profile, My
   Orders — by name or a small keyword-alias list, and opens that page
   directly. A submitted search that's an exact/near-exact match for a
   single page (e.g. "cart", "my orders") now opens that page instead of
   running as a product search.
   - `customer/src/data.js` — new `SITE_PAGES` list.
   - `customer/src/components.js` — `matchPages()`, `pageResultRow()`, and
     the header search dropdown/submit handler now merge page results with
     product results.

2. **Search could show "No products found" while the catalog was still
   loading**, instead of the catalog-not-loaded case the requirements call
   out explicitly ("must not fail simply because the product catalog has
   not finished loading... wait for `productService.load()`"). The search
   dropdown now shows a "Searching products…" state (with any matching
   pages still shown immediately), awaits `productService.load()`, and
   re-renders once it resolves — only if the customer hasn't changed the
   search term in the meantime. If the catalog genuinely failed to load, an
   explicit message is shown instead of a bare "no results".
   - `customer/src/components.js`.

3. **No customer-facing out-of-stock/low-stock notification** existed
   (requirement 14) — only an inline disabled-button state on the page
   itself. Added a toast notice ("...is currently out of stock. Please
   contact us for availability." / "...is booking fast — limited stock
   remaining.") on the product detail page, driven by the real backend
   stock status, shown once per product+status per browser session
   (`sessionStorage`-keyed) so it never repeats on every render or
   navigation back to the same page, and never fires for in-stock products.
   - `customer/src/pages.js` — `attachProductDetailPage()`.

## Testing performed

- `node --check` (as real ESM, via `.mjs`) on every modified customer
  file (`data.js`, `components.js`, `pages.js`) plus every other customer
  source file — all pass with no syntax errors.
- Read-through of the backend cart/order/product routers and services to
  confirm cart/order scoping and pagination limits, and of the Admin
  product form to confirm image handling — no backend or Admin changes were
  needed for the items covered in this pass.

## Not done / could not be verified in this environment

- This sandbox has no outbound network access and no running MongoDB, so
  `npm install`, a production Vite build, and a live end-to-end run (Admin
  creates a product → customer sees it; stock → 0 → customer sees Out of
  Stock; a real login → cart → checkout → My Orders flow) could not be
  executed here, consistent with every prior pass on this project. Please
  run the flows in `RUN_COMMANDS.txt` / `README_LOCAL.md` in your normal
  dev environment to confirm end-to-end.
- No responsiveness changes were made in this pass; the existing Tailwind
  responsive patterns noted in `REPORTS_UPDATE_SUMMARY.md` were not
  re-audited beyond a read-through of the pages touched.
- No performance changes were made — `productService.load()`'s
  dedupe-in-flight-request behavior (`loadingPromise`) was verified but not
  modified.
