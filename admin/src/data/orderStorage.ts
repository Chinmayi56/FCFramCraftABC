import type { Order, OrderStatus, PaymentStatus } from "../types";
import { apiRequest } from "../lib/apiClient";
import { addNotification } from "./notificationStorage";

export interface ApiOrderItem {
  id: string;
  product_id: string;
  product_name: string;
  sku: string;
  image?: string | null;
  category?: string | null;
  quantity: number;
  unit_price: number | string;
  subtotal: number | string;
  configuration?: string | null;
}

export interface ApiOrder {
  id: string;
  order_number: string;
  purchase_code: string;
  customer_id: string;
  status: OrderStatus;
  order_method: "delivery" | "visit_company";
  payment_method: "Cash on Delivery";
  payment_status: "Pending" | "Paid" | "Refunded";
  total_amount: number | string;
  shipping_address: Record<string, string>;
  customer_snapshot: Record<string, string>;
  created_at: string;
  updated_at: string;
  items: ApiOrderItem[];
}

function mapOrder(o: ApiOrder): Order {
  const i = o.items?.[0];
  const a = o.shipping_address || {};
  const c = o.customer_snapshot || {};

  const isVisitCompany = o.order_method === "visit_company";

  return {
    id: o.order_number || o.id,
    purchaseCode: o.purchase_code,
    customer: c.name || c.email || "Customer",
    customerId: o.customer_id,
    email: c.email || "",
    mobile: c.mobile || c.phone || "",
    address: a.line1 || a.address || "",
    city: a.city || "",
    state: a.state || "",
    pincode: a.pincode || "",
    product: i?.product_name || "Order",
    sku: i?.sku || "",
    quantity: o.items?.reduce((n, x) => n + x.quantity, 0) || 0,
    orderMethod: isVisitCompany ? "Visit Company" : "Cash on Delivery",
    payment: isVisitCompany ? "Pay at Company" : o.payment_method,
    paymentStatus: (
      o.payment_status === "Pending"
        ? "Unpaid"
        : o.payment_status === "Paid"
          ? "Paid"
          : "Refunded"
    ) as PaymentStatus,
    price: i ? Number(i.unit_price) : null,
    amount: Number(o.total_amount),
    date: o.created_at,
    status: o.status,
  };
}

let cache: Order[] = [];

export async function loadOrders(): Promise<Order[]> {
  const data = await apiRequest<ApiOrder[]>("/api/admin/orders");
  cache = data.map(mapOrder);
  return cache;
}

export function getCachedOrders(): Order[] {
  return cache;
}

// Raw admin orders, including the full per-item list (with product_id).
// Used by screens that need to relate orders to specific products.
export async function loadRawOrders(): Promise<ApiOrder[]> {
  return apiRequest<ApiOrder[]>("/api/admin/orders");
}

export async function updateOrderStatus(
  _list: Order[],
  orderId: string,
  status: OrderStatus
): Promise<Order[]> {
  await apiRequest(
    `/api/admin/orders/${encodeURIComponent(orderId)}`,
    {
      method: "PATCH",
      body: { status },
    }
  );

  const next = await loadOrders();

  addNotification({
    type: "order",
    title: `Order ${status.toLowerCase()}`,
    message: `Order ${orderId} was marked "${status}".`,
    orderId,
  });

  return next;
}

export function getSeenOrderIds(): Set<string> {
  try {
    return new Set(
      JSON.parse(
        localStorage.getItem("farmcraft_orders_seen_ids") || "[]"
      )
    );
  } catch {
    return new Set();
  }
}

export function markOrderIdsSeen(ids: Iterable<string>): void {
  localStorage.setItem(
    "farmcraft_orders_seen_ids",
    JSON.stringify(Array.from(ids))
  );
}