import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  ListChecks,
  Package,
  Pencil,
  Sprout,
  Tag,
  Trash2,
} from "lucide-react";

import { Card, CardHeader } from "../components/ui/Card";
import StatusBadge from "../components/ui/StatusBadge";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import Toast, { type ToastState } from "../components/ui/Toast";
import { loadRawOrders, type ApiOrder } from "../data/orderStorage";
import type { Product } from "../types";
import { fetchProduct, deleteProduct, productStatusLabel } from "../data/productApi";
import { ApiError } from "../lib/apiClient";

interface ProductOrderRow {
  key: string;
  orderId: string;
  customer: string;
  quantity: number;
  status: ApiOrder["status"];
}

const SPEC_ROWS: { key: keyof Product; label: string }[] = [
  { key: "motor", label: "Motor" },
  { key: "capacity", label: "Capacity" },
  { key: "length", label: "Length" },
  { key: "height", label: "Height" },
  { key: "pipeMaterial", label: "Pipe Material" },
  { key: "screwMaterial", label: "Screw Material" },
  { key: "usage", label: "Usage" },
];

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [activeImage, setActiveImage] = useState(0);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const [rawOrders, setRawOrders] = useState<ApiOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  /*
   * Keep the order history calculation lightweight.
   * Only order items belonging to the currently viewed product are converted
   * into rows.
   */
  const relatedOrders = useMemo<ProductOrderRow[]>(() => {
    if (!product || rawOrders.length === 0) {
      return [];
    }

    const rows: ProductOrderRow[] = [];

    for (const order of rawOrders) {
      const customer = order.customer_snapshot || {};

      for (const item of order.items || []) {
        if (item.product_id !== product.id) {
          continue;
        }

        rows.push({
          key: `${order.id}-${item.id}`,
          orderId: order.order_number || order.id,
          customer: customer.name || customer.email || "Customer",
          quantity: item.quantity,
          status: order.status,
        });
      }
    }

    return rows;
  }, [product, rawOrders]);

  /*
   * Load the product immediately.
   * This is the most important data for the page, so it is never delayed.
   */
  useEffect(() => {
    if (!id) {
      setNotFound(true);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    setIsLoading(true);
    setNotFound(false);
    setActiveImage(0);

    fetchProduct(id)
      .then((data) => {
        if (cancelled) return;

        setProduct(data);
      })
      .catch(() => {
        if (cancelled) return;

        setProduct(null);
        setNotFound(true);
      })
      .finally(() => {
        if (cancelled) return;

        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  /*
   * Order history is intentionally loaded after the product page becomes
   * interactive. This prevents the potentially large order request from
   * blocking the initial Product Detail experience.
   */
  useEffect(() => {
    let cancelled = false;

    setRawOrders([]);
    setOrdersError(null);
    setOrdersLoading(false);

    if (!id) {
      return;
    }

    let idleId: number | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const loadOrders = () => {
      if (cancelled) return;

      setOrdersLoading(true);

      loadRawOrders()
        .then((data) => {
          if (!cancelled) {
            setRawOrders(data);
          }
        })
        .catch((err) => {
          if (!cancelled) {
            setOrdersError(
              err instanceof ApiError
                ? err.message
                : "Could not load order history."
            );
          }
        })
        .finally(() => {
          if (!cancelled) {
            setOrdersLoading(false);
          }
        });
    };

    /*
     * requestIdleCallback lets the browser render the Product Detail first.
     * Fallback timeout keeps compatibility with browsers without it.
     */
    if ("requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(loadOrders, {
        timeout: 1200,
      });
    } else {
      timeoutId = setTimeout(loadOrders, 250);
    }

    return () => {
      cancelled = true;

      if (idleId !== null && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }

      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    };
  }, [id]);

  /*
   * Handle toast messages returned through navigation state.
   */
  useEffect(() => {
    const state = location.state as { toast?: string } | null;

    if (!state?.toast) {
      return;
    }

    setToast({
      message: state.toast,
      variant: "success",
    });

    navigate(location.pathname, {
      replace: true,
      state: {},
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  if (isLoading) {
    return (
      <div className="h-40 animate-pulse rounded-xl2 bg-farm-mist" />
    );
  }

  if (notFound || !product) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-farm-charcoal/60">
          Product not found.
        </p>

        <Link
          to="/admin/products"
          className="mt-3 inline-block text-sm font-medium text-farm-green-700"
        >
          Back to Products
        </Link>
      </div>
    );
  }

  const gallery =
    product.images && product.images.length > 0
      ? product.images
      : [product.image];

  const specs = SPEC_ROWS.filter((row) => Boolean(product[row.key]));

  const handleDelete = async () => {
    try {
      await deleteProduct(product.id);

      setConfirmOpen(false);

      navigate("/admin/products", {
        state: {
          toast: `"${product.name}" was deleted`,
        },
      });
    } catch (err) {
      setConfirmOpen(false);

      const message =
        err instanceof ApiError
          ? err.message
          : "Could not delete product.";

      setToast({
        message,
        variant: "error",
      });
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <button
        onClick={() => navigate("/admin/products")}
        className="flex items-center gap-1.5 text-sm font-medium text-farm-charcoal/60 hover:text-farm-charcoal-deep"
      >
        <ArrowLeft size={15} />
        Back to Products
      </button>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <div className="space-y-3 lg:col-span-2">
          <Card className="overflow-hidden">
            <div className="aspect-square w-full bg-farm-mist">
              <img
                src={gallery[activeImage]}
                alt={product.name}
                className="h-full w-full object-cover"
                loading="eager"
                decoding="async"
              />
            </div>
          </Card>

          {gallery.length > 1 && (
            <div className="flex gap-2">
              {gallery.map((src, index) => (
                <button
                  key={`${src}-${index}`}
                  type="button"
                  onClick={() => setActiveImage(index)}
                  className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 ${
                    activeImage === index
                      ? "border-farm-green-600"
                      : "border-transparent"
                  }`}
                >
                  <img
                    src={src}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-5 lg:col-span-3">
          <Card className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-farm-green-700">
                  {product.category}
                </p>

                <h2 className="mt-1 font-display text-xl font-bold text-farm-charcoal-deep">
                  {product.name}
                </h2>

                <p className="mt-1 text-xs text-farm-charcoal/50">
                  SKU: {product.sku}
                </p>
              </div>

              <StatusBadge
                status={productStatusLabel(product.status)}
              />
            </div>

            <p className="mt-4 text-sm leading-relaxed text-farm-charcoal/70">
              {product.description}
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-black/5 pt-5 sm:grid-cols-2">
              <div>
                <p className="text-xs text-farm-charcoal/50">
                  Stock
                </p>

                <p className="mt-0.5 font-display text-lg font-bold text-farm-charcoal-deep">
                  {product.stock} units
                </p>
              </div>

              <div>
                <p className="text-xs text-farm-charcoal/50">
                  Low-stock alert
                </p>

                <p className="mt-0.5 font-display text-lg font-bold text-farm-charcoal-deep">
                  ≤ {product.threshold}
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2 border-t border-black/5 pt-5 sm:flex-row">
              <Link
                to={`/admin/products/${product.id}/edit`}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-farm-green-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-farm-green-800"
              >
                <Pencil size={15} />
                Edit Product
              </Link>

              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
              >
                <Trash2 size={15} />
                Remove Product
              </button>
            </div>
          </Card>

          {specs.length > 0 && (
            <Card>
              <CardHeader
                title="Specifications"
                action={
                  <ListChecks
                    size={16}
                    className="text-farm-charcoal/30"
                  />
                }
              />

              <div className="grid grid-cols-1 gap-x-6 gap-y-3 p-5 sm:grid-cols-2">
                {specs.map((row) => (
                  <div
                    key={row.key}
                    className="flex items-start justify-between gap-3 text-sm"
                  >
                    <span className="text-farm-charcoal/50">
                      {row.label}
                    </span>

                    <span className="text-right font-medium text-farm-charcoal-deep">
                      {String(product[row.key])}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {Boolean(
            product.features?.length ||
              product.applications?.length
          ) && (
            <Card className="p-5">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {product.features &&
                  product.features.length > 0 && (
                    <div>
                      <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-farm-charcoal-deep">
                        <CheckCircle2
                          size={15}
                          className="text-farm-green-700"
                        />
                        Features
                      </h4>

                      <ul className="space-y-1.5 text-sm text-farm-charcoal/70">
                        {product.features.map((feature) => (
                          <li
                            key={feature}
                            className="flex items-start gap-1.5"
                          >
                            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-farm-green-600" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                {product.applications &&
                  product.applications.length > 0 && (
                    <div>
                      <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-farm-charcoal-deep">
                        <Sprout
                          size={15}
                          className="text-farm-green-700"
                        />
                        Applications
                      </h4>

                      <div className="flex flex-wrap gap-1.5">
                        {product.applications.map((application) => (
                          <span
                            key={application}
                            className="rounded-full bg-farm-green-50 px-2.5 py-1 text-xs font-medium text-farm-green-700"
                          >
                            {application}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            </Card>
          )}

          <Card className="p-5">
            <div className="flex items-center gap-4">
              <div className="rounded-xl bg-farm-green-50 p-2.5 text-farm-green-700">
                <Package size={18} />
              </div>

              <div>
                <p className="text-sm font-semibold text-farm-charcoal-deep">
                  Added{" "}
                  {new Date(product.createdAt).toLocaleDateString(
                    "en-IN",
                    {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    }
                  )}
                </p>

                <p className="text-xs text-farm-charcoal/50">
                  Listed by Farm Craft Admin
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader
          title="Order History"
          subtitle={`${relatedOrders.length} order(s) for this product`}
          action={
            <Tag
              size={16}
              className="text-farm-charcoal/30"
            />
          }
        />

        {ordersLoading ? (
          <p className="px-5 py-8 text-center text-sm text-farm-charcoal/50">
            Loading order history…
          </p>
        ) : ordersError ? (
          <p className="px-5 py-8 text-center text-sm text-red-600">
            {ordersError}
          </p>
        ) : relatedOrders.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-farm-charcoal/50">
            No orders yet for this product.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead>
                <tr className="border-b border-black/5 text-xs uppercase tracking-wide text-farm-charcoal/45">
                  <th className="px-5 py-3 font-medium">
                    Order ID
                  </th>

                  <th className="px-5 py-3 font-medium">
                    Customer
                  </th>

                  <th className="px-5 py-3 font-medium">
                    Qty
                  </th>

                  <th className="px-5 py-3 font-medium">
                    Status
                  </th>
                </tr>
              </thead>

              <tbody>
                {relatedOrders.map((order) => (
                  <tr
                    key={order.key}
                    className="border-b border-black/5 last:border-0 hover:bg-farm-mist/40"
                  >
                    <td className="px-5 py-3 font-medium text-farm-charcoal-deep">
                      {order.orderId}
                    </td>

                    <td className="px-5 py-3 text-farm-charcoal/70">
                      {order.customer}
                    </td>

                    <td className="px-5 py-3 text-farm-charcoal/70">
                      {order.quantity}
                    </td>

                    <td className="px-5 py-3">
                      <StatusBadge status={order.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete product"
        message={`Are you sure you want to delete "${product.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmOpen(false)}
      />

      {toast && (
        <Toast
          {...toast}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

