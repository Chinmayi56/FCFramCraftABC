import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  AlertTriangle,
  Tag,
  BarChart3,
  Settings as SettingsIcon,
  Search,
  Loader2,
} from "lucide-react";
import { fetchProducts } from "../../data/productApi";
import { fetchCustomers } from "../../data/customerApi";
import { loadRawOrders, type ApiOrder } from "../../data/orderStorage";
import type { Product, Customer } from "../../types";

// Existing Admin modules/pages — kept in sync with the routes already
// defined in App.tsx. No new routes are introduced here.
const MODULES: { label: string; path: string; Icon: typeof LayoutDashboard }[] = [
  { label: "Dashboard", path: "/admin/dashboard", Icon: LayoutDashboard },
  { label: "Products", path: "/admin/products", Icon: Package },
  { label: "Purchased Products", path: "/admin/purchased-products", Icon: ShoppingCart },
  { label: "Customers", path: "/admin/customers", Icon: Users },
  { label: "Out of Stock", path: "/admin/out-of-stock", Icon: AlertTriangle },
  { label: "Offers", path: "/admin/offers", Icon: Tag },
  { label: "Reports", path: "/admin/reports", Icon: BarChart3 },
  { label: "Settings", path: "/admin/settings", Icon: SettingsIcon },
];

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;
const RESULT_LIMIT = 5;

interface SearchState {
  products: Product[];
  customers: Customer[];
  orders: ApiOrder[];
  loading: boolean;
}

const EMPTY_RESULTS: SearchState = { products: [], customers: [], orders: [], loading: false };

export default function GlobalSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SearchState>(EMPTY_RESULTS);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<number | null>(null);
  const requestIdRef = useRef(0);

  const matchedModules = query.trim().length
    ? MODULES.filter((m) => m.label.toLowerCase().includes(query.trim().toLowerCase()))
    : [];

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults(EMPTY_RESULTS);
      return;
    }

    setResults((r) => ({ ...r, loading: true }));

    debounceRef.current = window.setTimeout(async () => {
      const requestId = ++requestIdRef.current;
      const lower = trimmed.toLowerCase();

      try {
        const [products, customers, orders] = await Promise.all([
          fetchProducts({ search: trimmed }).catch(() => []),
          fetchCustomers().catch(() => []),
          loadRawOrders().catch(() => []),
        ]);

        // A newer keystroke already triggered another request — ignore this
        // stale response so results never flicker out of order.
        if (requestId !== requestIdRef.current) return;

        const matchedCustomers = customers
          .filter(
            (c) =>
              c.name.toLowerCase().includes(lower) ||
              (c.email ?? "").toLowerCase().includes(lower) ||
              (c.mobile ?? c.phone ?? "").toLowerCase().includes(lower) ||
              c.id.toLowerCase().includes(lower)
          )
          .slice(0, RESULT_LIMIT);

        const matchedOrders = orders
          .filter(
            (o) =>
              o.order_number?.toLowerCase().includes(lower) ||
              o.id.toLowerCase().includes(lower) ||
              o.purchase_code?.toLowerCase().includes(lower) ||
              (o.customer_snapshot?.name ?? "").toLowerCase().includes(lower) ||
              o.items?.some((it) => it.product_name?.toLowerCase().includes(lower))
          )
          .slice(0, RESULT_LIMIT);

        setResults({
          products: products.slice(0, RESULT_LIMIT),
          customers: matchedCustomers,
          orders: matchedOrders,
          loading: false,
        });
      } catch {
        if (requestId === requestIdRef.current) {
          setResults(EMPTY_RESULTS);
        }
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query]);

  const go = (path: string) => {
    navigate(path);
    setOpen(false);
    setQuery("");
  };

  const trimmed = query.trim();
  const hasAnyResults =
    matchedModules.length > 0 || results.products.length > 0 || results.customers.length > 0 || results.orders.length > 0;

  return (
    <div className="relative hidden sm:block" ref={containerRef}>
      <Search
        size={16}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-farm-charcoal/40"
      />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder="Search products, customers, orders..."
        className="w-40 rounded-full border border-black/10 bg-farm-mist/60 py-2 pl-9 pr-3 text-sm text-farm-charcoal-deep placeholder:text-farm-charcoal/40 focus:w-72 focus:border-farm-green-600 focus:bg-white focus:outline-none transition-all"
      />

      {open && trimmed.length >= MIN_QUERY_LENGTH && (
        <div className="absolute right-0 z-40 mt-2 w-[min(24rem,90vw)] max-h-[70vh] overflow-y-auto scrollbar-thin animate-fade-in rounded-xl border border-black/5 bg-white shadow-card-hover">
          {results.loading && !hasAnyResults && (
            <div className="flex items-center gap-2 px-4 py-6 text-sm text-farm-charcoal/50">
              <Loader2 size={15} className="animate-spin" /> Searching...
            </div>
          )}

          {!results.loading && !hasAnyResults && (
            <div className="px-4 py-6 text-center text-sm text-farm-charcoal/50">
              No results for "{trimmed}"
            </div>
          )}

          {matchedModules.length > 0 && (
            <div className="border-b border-black/5 py-1.5">
              <p className="px-4 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-farm-charcoal/40">
                Modules
              </p>
              {matchedModules.map(({ label, path, Icon }) => (
                <button
                  key={path}
                  onClick={() => go(path)}
                  className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm text-farm-charcoal-deep hover:bg-farm-mist"
                >
                  <Icon size={15} className="text-farm-charcoal/50" /> {label}
                </button>
              ))}
            </div>
          )}

          {results.products.length > 0 && (
            <div className="border-b border-black/5 py-1.5">
              <p className="px-4 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-farm-charcoal/40">
                Products
              </p>
              {results.products.map((p) => (
                <button
                  key={p.id}
                  onClick={() => go(`/admin/products/${p.id}`)}
                  className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm hover:bg-farm-mist"
                >
                  <img src={p.image} alt="" className="h-7 w-7 shrink-0 rounded-md object-cover" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-farm-charcoal-deep">{p.name}</span>
                    <span className="block truncate text-xs text-farm-charcoal/45">
                      {p.sku} · {p.category}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {results.customers.length > 0 && (
            <div className="border-b border-black/5 py-1.5">
              <p className="px-4 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-farm-charcoal/40">
                Customers
              </p>
              {results.customers.map((c) => (
                <button
                  key={c.id}
                  onClick={() => go(`/admin/customers/${c.id}`)}
                  className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm hover:bg-farm-mist"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-farm-green-700 text-xs font-semibold text-white">
                    {c.name.charAt(0)}
                  </div>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-farm-charcoal-deep">{c.name}</span>
                    <span className="block truncate text-xs text-farm-charcoal/45">{c.email || c.mobile || "—"}</span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {results.orders.length > 0 && (
            <div className="py-1.5">
              <p className="px-4 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-farm-charcoal/40">
                Orders
              </p>
              {results.orders.map((o) => (
                <button
                  key={o.id}
                  onClick={() => go(`/admin/purchased-products/${o.order_number || o.id}`)}
                  className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm hover:bg-farm-mist"
                >
                  <ShoppingCart size={15} className="shrink-0 text-farm-charcoal/50" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-farm-charcoal-deep">{o.order_number}</span>
                    <span className="block truncate text-xs text-farm-charcoal/45">
                      {o.customer_snapshot?.name || o.customer_snapshot?.email || "Customer"}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
