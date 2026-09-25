# Farm Craft Customer Update — September 2026

Implemented in the supplied FarmCraft project:

1. Customer footer social circles removed.
2. Customer footer now shows only `© 2026 Farm Craft.`
3. Cart line totals and checkout total are hidden from the customer UI.
4. Products without a listed price can still be added to the cart and submitted as a purchase request; no enquiry-only block is shown.
5. Backend cart schema now accepts nullable product prices and order creation supports unpriced products with an internal zero calculation.
6. Home-page category cards use robust category matching so category clicks continue to find related products even when backend category labels use a display-name/slug variation.
7. Customer order list no longer displays the total amount.
8. Downloaded customer invoices no longer display unit price, amount, subtotal, tax, or total; they retain product, configuration, quantity, order, customer, and payment/order details.
9. Existing Farm Craft admin/backend/customer architecture and existing pages were preserved.

Customer frontend remains configured to use:
`VITE_API_BASE_URL=https://farmcarft-5.onrender.com/api`
