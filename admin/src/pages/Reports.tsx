import { useEffect, useMemo, useState } from "react";
import {
  ClipboardList,
  Download,
  FileSpreadsheet,
  FileText,
  Package,
  RefreshCcw,
  Users,
} from "lucide-react";

import { Card, CardHeader } from "../components/ui/Card";
import StatusBadge from "../components/ui/StatusBadge";
import Toast, { type ToastState } from "../components/ui/Toast";
import { apiRequest, ApiError } from "../lib/apiClient";
import { fetchProducts } from "../data/productApi";
import { loadRawOrders, type ApiOrder } from "../data/orderStorage";
import { fetchCustomers } from "../data/customerApi";
import type { Product, Customer } from "../types";
import logoAsset from "../assets/farmcraft-logo-full.png";
import {
  exportReportCsv,
  exportReportPdf,
  exportReportXlsx,
  loadLogoDataUrl,
  type ReportColumn,
} from "../utils/reportExport";

type ReportTab = "products" | "orders" | "customers";

const TABS: { id: ReportTab; label: string; icon: typeof Package }[] = [
  { id: "products", label: "Product Report", icon: Package },
  { id: "orders", label: "Purchased / Order Report", icon: ClipboardList },
  { id: "customers", label: "Customer Report", icon: Users },
];

// Flattened, one row per order — matches what the on-screen table and every
// export format show for the Purchased/Order report.
interface OrderReportRow {
  orderId: string;
  orderNumber: string;
  customer: string;
  products: string;
  quantity: number;
  status: ApiOrder["status"];
  paymentStatus: ApiOrder["payment_status"];
  amount: number;
  date: string;
}

function toOrderRow(o: ApiOrder): OrderReportRow {
  const c = o.customer_snapshot || {};
  return {
    orderId: o.id,
    orderNumber: o.order_number || o.id,
    customer: c.name || c.email || "Customer",
    products: (o.items || []).map((i) => `${i.product_name} x${i.quantity}`).join(", "),
    quantity: (o.items || []).reduce((n, i) => n + i.quantity, 0),
    status: o.status,
    paymentStatus: o.payment_status,
    amount: Number(o.total_amount) || 0,
    date: o.created_at,
  };
}

const PRODUCT_COLUMNS: ReportColumn<Product>[] = [
  { header: "Product Name", get: (p) => p.name },
  { header: "SKU", get: (p) => p.sku },
  { header: "Category", get: (p) => p.category },
  { header: "Price", get: (p) => (p.price !== null ? `₹${p.price}` : "—") },
  { header: "Stock", get: (p) => p.stock },
  { header: "Status", get: (p) => p.status },
];

const ORDER_COLUMNS: ReportColumn<OrderReportRow>[] = [
  { header: "Order Number", get: (o) => o.orderNumber },
  { header: "Customer", get: (o) => o.customer },
  { header: "Products", get: (o) => o.products },
  { header: "Quantity", get: (o) => o.quantity },
  { header: "Status", get: (o) => o.status },
  { header: "Payment Status", get: (o) => o.paymentStatus },
  { header: "Amount", get: (o) => o.amount },
  { header: "Order Date", get: (o) => new Date(o.date).toLocaleDateString("en-IN") },
];

const CUSTOMER_COLUMNS: ReportColumn<Customer>[] = [
  { header: "Customer ID", get: (c) => c.id },
  { header: "Name", get: (c) => c.name },
  { header: "Email", get: (c) => c.email || "—" },
  { header: "Mobile", get: (c) => c.mobile || c.phone || "—" },
  { header: "Location", get: (c) => c.location || "—" },
  { header: "Total Orders", get: (c) => c.totalOrders },
  { header: "Total Spent", get: (c) => c.totalSpent },
  { header: "Status", get: (c) => c.status },
];

interface CompanyInfo {
  company_name: string;
}

export default function Reports() {
  const [tab, setTab] = useState<ReportTab>("products");
  const [companyName, setCompanyName] = useState("Farm Craft");

  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<OrderReportRow[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const loadAll = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetchProducts(),
      loadRawOrders(),
      fetchCustomers(),
      apiRequest<CompanyInfo>("/api/company", { auth: false }).catch(() => null),
    ])
      .then(([p, o, c, company]) => {
        setProducts(p);
        setOrders(o.map(toOrderRow));
        setCustomers(c);
        if (company?.company_name) setCompanyName(company.company_name);
      })
      .catch((e) => {
        setError(e instanceof ApiError ? e.message : "Could not load report data.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(loadAll, []);

  // Columns and rows always belong to the same report (both switch on `tab`
  // together), but their generic types differ per tab — cast the pairing to
  // a single `unknown`-typed shape once here so the rest of the component
  // (rendering, export) can treat all three report kinds uniformly.
  type ActiveConfig = { title: string; rows: unknown[]; columns: ReportColumn<unknown>[]; empty: string };

  const activeConfig = useMemo<ActiveConfig>(() => {
    if (tab === "products") {
      return { title: "FarmCraft Product Report", rows: products, columns: PRODUCT_COLUMNS, empty: "No products found." } as unknown as ActiveConfig;
    }
    if (tab === "orders") {
      return { title: "FarmCraft Order Report", rows: orders, columns: ORDER_COLUMNS, empty: "No orders found." } as unknown as ActiveConfig;
    }
    return { title: "FarmCraft Customer Report", rows: customers, columns: CUSTOMER_COLUMNS, empty: "No customers found." } as unknown as ActiveConfig;
  }, [tab, products, orders, customers]);

  const handleExport = async (format: "pdf" | "csv" | "xlsx") => {
    const key = `${tab}-${format}`;
    setExporting(key);
    try {
      const logoDataUrl = format === "pdf" ? await loadLogoDataUrl(logoAsset) : null;
      const branding = {
        companyName,
        reportTitle: activeConfig.title,
        logoDataUrl,
        generatedAt: new Date(),
      };
      const filenameBase = `FarmCraft-${tab}-report-${new Date().toISOString().slice(0, 10)}`;

      if (format === "pdf") {
        exportReportPdf(branding, activeConfig.columns, activeConfig.rows, `${filenameBase}.pdf`);
      } else if (format === "csv") {
        exportReportCsv(branding, activeConfig.columns, activeConfig.rows, `${filenameBase}.csv`);
      } else {
        exportReportXlsx(branding, activeConfig.columns, activeConfig.rows, `${filenameBase}.xlsx`);
      }
      setToast({ message: `${format.toUpperCase()} report downloaded.`, variant: "success" });
    } catch (e) {
      setToast({ message: e instanceof Error ? e.message : "Could not generate the report file.", variant: "error" });
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-farm-charcoal-deep">Reports</h1>
          <p className="mt-0.5 text-sm text-farm-charcoal/55">Download product, order and customer reports from live data.</p>
        </div>
        <button
          onClick={loadAll}
          className="flex w-fit items-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-semibold text-farm-charcoal-deep hover:bg-farm-mist"
        >
          <RefreshCcw size={15} /> Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === id ? "bg-farm-green-700 text-white shadow-card" : "bg-white text-farm-charcoal/65 hover:bg-farm-mist border border-black/5"
            }`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader
          title={activeConfig.title}
          subtitle={loading ? "Loading…" : `${activeConfig.rows.length} record(s)`}
          action={
            <div className="flex flex-wrap gap-2">
              <button
                disabled={loading || Boolean(error) || exporting !== null}
                onClick={() => void handleExport("pdf")}
                className="flex items-center gap-1.5 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-farm-charcoal-deep hover:bg-farm-mist disabled:opacity-50"
              >
                <FileText size={14} /> {exporting === `${tab}-pdf` ? "Preparing…" : "PDF"}
              </button>
              <button
                disabled={loading || Boolean(error) || exporting !== null}
                onClick={() => void handleExport("csv")}
                className="flex items-center gap-1.5 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-farm-charcoal-deep hover:bg-farm-mist disabled:opacity-50"
              >
                <Download size={14} /> {exporting === `${tab}-csv` ? "Preparing…" : "CSV"}
              </button>
              <button
                disabled={loading || Boolean(error) || exporting !== null}
                onClick={() => void handleExport("xlsx")}
                className="flex items-center gap-1.5 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-farm-charcoal-deep hover:bg-farm-mist disabled:opacity-50"
              >
                <FileSpreadsheet size={14} /> {exporting === `${tab}-xlsx` ? "Preparing…" : "Excel"}
              </button>
            </div>
          }
        />

        {loading ? (
          <p className="px-5 py-10 text-center text-sm text-farm-charcoal/50">Loading report data…</p>
        ) : error ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm font-semibold text-red-700">Unable to load report data.</p>
            <p className="mt-1 text-xs text-farm-charcoal/55">{error}</p>
            <button onClick={loadAll} className="mt-4 rounded-lg bg-farm-green-700 px-4 py-2 text-xs font-semibold text-white">
              Try again
            </button>
          </div>
        ) : activeConfig.rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-farm-charcoal/50">{activeConfig.empty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-black/5 text-xs uppercase tracking-wide text-farm-charcoal/45">
                  {activeConfig.columns.map((c) => (
                    <th key={c.header} className="whitespace-nowrap px-5 py-3 font-medium">
                      {c.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeConfig.rows.slice(0, 200).map((row, i) => (
                  <tr key={i} className="border-b border-black/5 last:border-0 hover:bg-farm-mist/40">
                    {activeConfig.columns.map((c) => {
                      const value = c.get(row);
                      const isStatus = c.header === "Status";
                      return (
                        <td key={c.header} className="whitespace-nowrap px-5 py-3 text-farm-charcoal/75">
                          {isStatus ? <StatusBadge status={String(value)} /> : value}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {activeConfig.rows.length > 200 && (
              <p className="px-5 py-3 text-xs text-farm-charcoal/45">
                Showing the first 200 of {activeConfig.rows.length} records on screen — exported files include every record.
              </p>
            )}
          </div>
        )}
      </Card>

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  );
}
