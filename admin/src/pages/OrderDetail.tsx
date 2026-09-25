import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileText, Mail, MapPin, Phone } from "lucide-react";
import { Card, CardHeader } from "../components/ui/Card";
import StatusBadge from "../components/ui/StatusBadge";
import Toast, { type ToastState } from "../components/ui/Toast";
import { loadRawOrders, updateOrderStatus, type ApiOrder } from "../data/orderStorage";
import type { OrderStatus } from "../types";

const STATUS_OPTIONS: OrderStatus[] = ["Pending", "Confirmed", "Processing", "Dispatched", "Delivered", "Cancelled"];

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = async () => {
    setLoading(true); setError(null);
    try { setOrders(await loadRawOrders()); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to load order."); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetchOrders(); }, []);

  if (loading) return <div className="py-16 text-center text-sm text-farm-charcoal/55">Loading purchase details…</div>;
  if (error) return <div className="py-16 text-center"><p className="text-sm font-semibold text-red-700">Unable to load purchase details.</p><p className="mt-1 text-xs text-farm-charcoal/55">{error}</p><button onClick={fetchOrders} className="mt-4 rounded-lg bg-farm-green-700 px-4 py-2 text-xs font-semibold text-white">Try again</button></div>;

  const order = orders.find((o) => o.id === id || o.order_number === id);
  if (!order) return <div className="py-16 text-center"><p className="text-sm text-farm-charcoal/60">Order not found.</p><Link to="/admin/purchased-products" className="mt-3 inline-block text-sm font-medium text-farm-green-700">Back to Purchased Products</Link></div>;

  const c = order.customer_snapshot || {};
  const a = order.shipping_address || {};
  const handleStatusChange = async (newStatus: OrderStatus) => {
    try {
      await updateOrderStatus([], order.id, newStatus);
      setToast({ message: "Order status updated successfully.", variant: "success" });
      await fetchOrders();
    } catch (e) { setToast({ message: e instanceof Error ? e.message : "Could not update order", variant: "error" }); }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button onClick={() => navigate("/admin/purchased-products")} className="flex items-center gap-1.5 text-sm font-medium text-farm-charcoal/60 hover:text-farm-charcoal-deep"><ArrowLeft size={15} /> Back to Purchased Products</button>
        <Link to={`/admin/purchased-products/${order.order_number || order.id}/invoice`} className="flex items-center justify-center gap-2 rounded-xl bg-farm-green-700 px-4 py-2.5 text-sm font-semibold text-white shadow-card hover:bg-farm-green-800"><FileText size={16} /> View Invoice</Link>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader title={order.order_number} subtitle={`Purchase Code: ${order.purchase_code}`} action={<StatusBadge status={order.status} />} />
            <div className="grid grid-cols-1 gap-4 p-5 text-sm sm:grid-cols-4">
              <div><p className="text-xs text-farm-charcoal/50">Order Date</p><p className="mt-1 font-medium">{new Date(order.created_at).toLocaleString("en-IN")}</p></div>
              <div><p className="text-xs text-farm-charcoal/50">Order Method</p><p className="mt-1 font-medium">{order.order_method === "visit_company" ? "Visit Company" : "Cash on Delivery"}</p></div>
              <div><p className="text-xs text-farm-charcoal/50">Payment</p><p className="mt-1 font-medium">{order.payment_method} · {order.payment_status}</p></div>
              <div><p className="text-xs text-farm-charcoal/50">Status</p><select value={order.status} onChange={(e) => handleStatusChange(e.target.value as OrderStatus)} className="mt-1.5 rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-xs">{STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Purchased Products" subtitle={`${order.items.length} product${order.items.length === 1 ? "" : "s"} in this order`} />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
  <tr className="border-b border-black/5 text-xs uppercase tracking-wide text-farm-charcoal/45">
    <th className="px-5 py-3">Product</th>
    <th className="px-5 py-3">SKU</th>
    <th className="px-5 py-3">Category</th>
    <th className="px-5 py-3">Qty</th>
    <th className="px-5 py-3 text-right">Unit Price</th>
    <th className="px-5 py-3 text-right">Subtotal</th>
  </tr>
</thead>
                <tbody>{order.items.map((item) => <tr key={item.id} className="border-b border-black/5 last:border-0">
                  <td className="px-5 py-3"><div className="flex items-center gap-3">{item.image ? <img src={item.image} alt="" className="h-10 w-10 rounded-lg object-cover" /> : <div className="h-10 w-10 rounded-lg bg-farm-mist" />}<span className="font-medium">{item.product_name}</span></div></td>
                  <td className="px-5 py-3 font-mono text-xs">{item.sku}</td><td className="px-5 py-3">{item.category || "—"}</td><td className="px-5 py-3">{item.quantity}</td>
                  <td className="px-5 py-3 text-right">₹{Number(item.unit_price).toLocaleString("en-IN")}</td><td className="px-5 py-3 text-right font-medium">₹{Number(item.subtotal).toLocaleString("en-IN")}</td>
                </tr>)}</tbody>
              </table>
            </div>
          </Card>
        </div>

        <Card className="h-fit p-5">
          <h3 className="font-display text-sm font-semibold text-farm-charcoal-deep">Customer Details</h3>
          <div className="mt-4 flex items-center gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-farm-green-700 text-sm font-semibold text-white">{String(c.name || c.email || "C").charAt(0)}</div><div><Link to={`/admin/customers/${order.customer_id}`} className="font-medium hover:text-farm-green-700">{c.name || c.email || "Customer"}</Link><p className="text-xs text-farm-charcoal/45">{order.customer_id}</p></div></div>
          <div className="mt-4 space-y-3 border-t border-black/5 pt-4 text-sm">
            <div className="flex gap-2.5 text-farm-charcoal/70"><Mail size={15} /> {c.email || "—"}</div>
            <div className="flex gap-2.5 text-farm-charcoal/70"><Phone size={15} /> {c.mobile || c.phone || "—"}</div>
            <div className="flex items-start gap-2.5 text-farm-charcoal/70"><MapPin size={15} className="mt-0.5 shrink-0" /><span>{a.line1 || a.address || "—"}, {a.city || "—"}, {a.state || "—"} - {a.pincode || a.postal_code || "—"}</span></div>
          </div>
        </Card>
      </div>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  );
}
