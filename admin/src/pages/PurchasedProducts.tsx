import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, FileText, RefreshCcw, Search, ShoppingCart } from "lucide-react";
import { Card, CardHeader } from "../components/ui/Card";
import StatusBadge from "../components/ui/StatusBadge";
import Toast, { type ToastState } from "../components/ui/Toast";
import { loadRawOrders, updateOrderStatus, type ApiOrder } from "../data/orderStorage";
import type { OrderStatus } from "../types";

const STATUS_FILTERS: (OrderStatus | "All")[] = ["All", "Pending", "Confirmed", "Processing", "Dispatched", "Delivered", "Cancelled"];
const STATUS_OPTIONS: OrderStatus[] = ["Pending", "Confirmed", "Processing", "Dispatched", "Delivered", "Cancelled"];

export default function PurchasedProducts() {
  const location = useLocation();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<OrderStatus | "All">("All");
  const [statusEditingId, setStatusEditingId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      setOrders(await loadRawOrders());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load purchased products.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, []);

  useEffect(() => {
    const state = location.state as { toast?: string } | null;
    if (state?.toast) {
      setToast({ message: state.toast, variant: "success" });
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.flatMap((order) => (order.items || []).map((item) => ({ order, item }))).filter(({ order, item }) => {
      const c = order.customer_snapshot || {};
      const matchesQuery = !q ||
        order.id.toLowerCase().includes(q) ||
        order.order_number.toLowerCase().includes(q) ||
        order.purchase_code.toLowerCase().includes(q) ||
        String(c.name || "").toLowerCase().includes(q) ||
        String(c.email || "").toLowerCase().includes(q) ||
        item.product_name.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q);
      return matchesQuery && (status === "All" || order.status === status);
    });
  }, [orders, query, status]);

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    try {
      await updateOrderStatus([], orderId, newStatus);
      setStatusEditingId(null);
      setToast({ message: "Order status updated", variant: "success" });
      await fetchOrders();
    } catch (e) {
      setToast({ message: e instanceof Error ? e.message : "Could not update order", variant: "error" });
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h2 className="font-display text-lg font-bold text-farm-charcoal-deep">Purchased Products</h2>
        <p className="text-sm text-farm-charcoal/55">Real customer purchases loaded from the backend</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-farm-charcoal/40" />
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by order, customer, product or SKU..."
            className="w-full rounded-xl border border-black/10 bg-white py-2.5 pl-10 pr-3 text-sm focus:border-farm-green-600 focus:outline-none focus:ring-2 focus:ring-farm-green-100" />
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((s) => (
            <button key={s} onClick={() => setStatus(s)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${status === s ? "bg-farm-green-700 text-white" : "border border-black/10 text-farm-charcoal/60 hover:bg-farm-mist"}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader title="Purchased Products"
          subtitle={loading ? "Loading real purchases…" : `${filtered.length} product rows from ${orders.length} orders`}
          action={<button onClick={fetchOrders} disabled={loading} className="rounded-lg border border-black/10 px-3 py-1.5 text-xs font-medium hover:bg-farm-mist disabled:opacity-50">Refresh</button>} />

        {error ? (
          <div className="p-8 text-center">
            <p className="text-sm font-semibold text-red-700">Unable to load purchased products.</p>
            <p className="mt-1 text-xs text-farm-charcoal/55">{error}</p>
            <button onClick={fetchOrders} className="mt-4 rounded-lg bg-farm-green-700 px-4 py-2 text-xs font-semibold text-white">Try again</button>
          </div>
        ) : loading ? (
          <div className="p-10 text-center text-sm text-farm-charcoal/55">Loading purchases from the backend…</div>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[1450px] text-left text-sm">
              <thead>
                <tr className="border-b border-black/5 text-xs uppercase tracking-wide text-farm-charcoal/45">
                  <th className="px-5 py-3 font-medium">Product</th>
                  <th className="px-5 py-3 font-medium">SKU</th>
                  <th className="px-5 py-3 font-medium">Category</th>
                  <th className="px-5 py-3 font-medium">Customer</th>
                  <th className="px-5 py-3 font-medium">Email / Mobile</th>
                  <th className="px-5 py-3 font-medium">Qty</th>
                  <th className="px-5 py-3 font-medium">Payment</th>
                  <th className="px-5 py-3 font-medium">Order</th>
                  <th className="px-5 py-3 font-medium">Purchase Date</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(({ order, item }) => {
                  const c = order.customer_snapshot || {};
                  const customerName = c.name || c.email || "Customer";
                  const routeId = order.order_number || order.id;
                  return (
                    <tr key={`${order.id}-${item.id}`} className="border-b border-black/5 last:border-0 hover:bg-farm-mist/40">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          {item.image ? <img src={item.image} alt="" className="h-10 w-10 rounded-lg object-cover" /> : <div className="h-10 w-10 rounded-lg bg-farm-mist" />}
                          <div className="max-w-[240px]">
                            <p className="font-medium text-farm-charcoal-deep">{item.product_name}</p>
                            <p className="text-xs text-farm-charcoal/45">{order.order_number}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-farm-charcoal/70">{item.sku}</td>
                      <td className="px-5 py-3 text-farm-charcoal/65">{item.category || "—"}</td>
                      <td className="px-5 py-3"><p className="font-medium text-farm-charcoal-deep">{customerName}</p><p className="text-xs text-farm-charcoal/45">{order.customer_id}</p></td>
                      <td className="px-5 py-3 text-xs text-farm-charcoal/60"><div>{c.email || "—"}</div><div>{c.mobile || c.phone || "—"}</div></td>
                      <td className="px-5 py-3 font-medium">{item.quantity}</td>
                      <td className="px-5 py-3"><div>{order.payment_method}</div><div className="text-xs text-farm-charcoal/50">{order.payment_status}</div></td>
                      <td className="px-5 py-3">
                        <div className="font-mono text-xs">{order.purchase_code}</div>
                        {statusEditingId === order.id ? (
                          <select autoFocus defaultValue={order.status} onBlur={() => setStatusEditingId(null)}
                            onChange={(e) => handleStatusChange(order.id, e.target.value as OrderStatus)}
                            className="mt-1 rounded-lg border border-black/10 bg-white px-2 py-1 text-xs">
                            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        ) : <StatusBadge status={order.status} />}
                      </td>
                      <td className="px-5 py-3 text-farm-charcoal/60">{new Date(order.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link to={`/admin/purchased-products/${routeId}`} className="rounded-lg p-1.5 text-farm-charcoal/50 hover:bg-farm-mist hover:text-farm-charcoal-deep" aria-label="View order" title="View"><Eye size={16} /></Link>
                          <button onClick={() => setStatusEditingId(order.id)} className="rounded-lg p-1.5 text-farm-charcoal/50 hover:bg-farm-mist hover:text-farm-charcoal-deep" aria-label="Update status" title="Update Status"><RefreshCcw size={16} /></button>
                          <Link to={`/admin/purchased-products/${routeId}/invoice`} className="rounded-lg p-1.5 text-farm-charcoal/50 hover:bg-farm-mist hover:text-farm-charcoal-deep" aria-label="View invoice" title="Invoice"><FileText size={16} /></Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={10} className="px-5 py-14 text-center">
                    <ShoppingCart size={28} className="mx-auto mb-2 text-farm-charcoal/25" />
                    <p className="text-sm font-medium text-farm-charcoal/60">{orders.length === 0 ? "No purchases found." : "No purchased products match your search or filter."}</p>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  );
}
