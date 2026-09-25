import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { loadRawOrders, type ApiOrder } from "../data/orderStorage";
import logo from "../assets/farmcraft-logo-full.png";

const GSTIN = "37AQXPV3001H1ZG";

export default function Invoice() {
  const { id } = useParams();
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRawOrders().then(setOrders).catch((e) => setError(e instanceof Error ? e.message : "Unable to load invoice.")).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="py-16 text-center text-sm text-farm-charcoal/55">Loading invoice…</div>;
  if (error) return <div className="py-16 text-center text-sm text-red-700">Unable to load invoice. {error}</div>;

  const order = orders.find((o) => o.id === id || o.order_number === id);
  if (!order) return <div className="py-16 text-center"><p className="text-sm text-farm-charcoal/60">Order not found.</p><Link to="/admin/purchased-products" className="mt-3 inline-block text-sm font-medium text-farm-green-700">Back to Purchased Products</Link></div>;

  const c = order.customer_snapshot || {};
  const a = order.shipping_address || {};
  const handlePrint = () => window.print();
  const handleDownload = () => {
    const html = document.getElementById("invoice-printable")?.outerHTML ?? "";
    const doc = `<!DOCTYPE html><html><head><meta charset="utf-8" /><title>Invoice ${order.order_number}</title><style>body{font-family:Arial;color:#1f2a24;padding:24px}table{width:100%;border-collapse:collapse}th,td{padding:8px 10px;text-align:left;border-bottom:1px solid #e7ebe6;font-size:13px}</style></head><body>${html}</body></html>`;
    const url = URL.createObjectURL(new Blob([doc], { type: "text/html" }));
    const link = document.createElement("a"); link.href = url; link.download = `Invoice-${order.order_number}.html`; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col gap-3 print:hidden sm:flex-row sm:items-center sm:justify-between">
        <Link to={`/admin/purchased-products/${order.order_number}`} className="flex items-center gap-1.5 text-sm font-medium text-farm-charcoal/60"><ArrowLeft size={15} /> Back to Order</Link>
        <div className="flex gap-2"><button onClick={handleDownload} className="flex items-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-semibold"><Download size={16} /> Download Invoice</button><button onClick={handlePrint} className="flex items-center gap-2 rounded-xl bg-farm-green-700 px-4 py-2.5 text-sm font-semibold text-white"><Printer size={16} /> Print Invoice</button></div>
      </div>

      <div id="invoice-printable" className="mx-auto max-w-3xl rounded-xl2 border border-black/5 bg-white p-8 shadow-card print:rounded-none print:border-0 print:shadow-none">
        <div className="flex items-start justify-between border-b-2 border-farm-green-700 pb-5">
          <div className="flex items-center gap-3"><img src={logo} alt="Farm Craft" className="h-14 w-24 rounded-lg object-contain p-1" /><div><h1 className="font-display text-2xl font-extrabold text-farm-green-700">FARM CRAFT</h1><p className="text-xs text-farm-charcoal/55">GSTIN: {GSTIN}</p></div></div>
          <div className="text-right"><h2 className="font-display text-lg font-bold">TAX INVOICE</h2><p className="mt-1 text-xs text-farm-charcoal/55">Order ID: {order.order_number}</p><p className="text-xs text-farm-charcoal/55">Purchase Code: {order.purchase_code}</p><p className="text-xs text-farm-charcoal/55">Order Date: {new Date(order.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</p></div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-6">
          <div><p className="text-xs font-semibold uppercase tracking-wide text-farm-charcoal/45">Billed To</p><p className="mt-2 text-sm font-semibold">{c.name || "Customer"}</p><p className="text-xs text-farm-charcoal/60">{c.email || "—"}</p><p className="text-xs text-farm-charcoal/60">{c.mobile || c.phone || "—"}</p><p className="mt-1 text-xs text-farm-charcoal/60">{a.line1 || a.address || "—"}, {a.city || "—"}, {a.state || "—"} - {a.pincode || a.postal_code || "—"}</p></div>
          <div><p className="text-xs font-semibold uppercase tracking-wide text-farm-charcoal/45">Payment</p><p className="mt-2 text-sm">Method: {order.payment_method}</p><p className="text-sm">Payment Status: {order.payment_status}</p><p className="text-sm">Order Status: {order.status}</p></div>
        </div>

        <table className="mt-7 w-full text-left text-sm">
  <thead>
    <tr className="border-b border-black/10 text-xs uppercase tracking-wide text-farm-charcoal/45">
      <th className="py-2.5">Product</th>
      <th className="py-2.5">SKU</th>
      <th className="py-2.5 text-right">Qty</th>
    </tr>
  </thead>

  <tbody>
    {order.items.map((item) => (
      <tr key={item.id} className="border-b border-black/5">
        <td className="py-3 font-medium">{item.product_name}</td>
        <td className="py-3">{item.sku}</td>
        <td className="py-3 text-right">{item.quantity}</td>
      </tr>
    ))}
  </tbody>
</table>
        <div className="mt-10 border-t border-black/10 pt-4 text-center text-xs text-farm-charcoal/45">This is a system-generated invoice from Farm Craft. Thank you for your business.</div>
      </div>
    </div>
  );
}
