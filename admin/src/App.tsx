import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import ProtectedRoute from "./routes/ProtectedRoute";
import AdminLayout from "./components/layout/AdminLayout";
import { NotificationProvider } from "./context/NotificationContext";
import Login from "./pages/Login";

// Lazy-load Admin pages.
// Each page is downloaded only when the user opens that route.
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Products = lazy(() => import("./pages/Products"));
const AddProduct = lazy(() => import("./pages/AddProduct"));
const EditProduct = lazy(() => import("./pages/EditProduct"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const PurchasedProducts = lazy(() => import("./pages/PurchasedProducts"));
const OrderDetail = lazy(() => import("./pages/OrderDetail"));
const Invoice = lazy(() => import("./pages/Invoice"));
const Customers = lazy(() => import("./pages/Customers"));
const CustomerDetail = lazy(() => import("./pages/CustomerDetail"));
const OutOfStock = lazy(() => import("./pages/OutOfStock"));
const Offers = lazy(() => import("./pages/Offers"));
const Reports = lazy(() => import("./pages/Reports"));
const Settings = lazy(() => import("./pages/Settings"));

function PageLoading() {
  return (
    <div className="flex min-h-[260px] items-center justify-center">
      <div className="flex items-center gap-3 text-sm text-farm-charcoal/55">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-farm-green-700/20 border-t-farm-green-700" />
        <span>Loading...</span>
      </div>
    </div>
  );
}

function LazyPage({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<PageLoading />}>
      {children}
    </Suspense>
  );
}

export default function App() {
  return (
    <Routes>
      {/* Default route */}
      <Route
        path="/"
        element={<Navigate to="/admin/login" replace />}
      />

      {/* Login should remain loaded immediately */}
      <Route
        path="/admin/login"
        element={<Login />}
      />

      {/* Protected Admin area */}
      <Route
        element={
          <ProtectedRoute>
            <NotificationProvider>
              <AdminLayout />
            </NotificationProvider>
          </ProtectedRoute>
        }
      >
        <Route
          path="/admin/dashboard"
          element={
            <LazyPage>
              <Dashboard />
            </LazyPage>
          }
        />

        <Route
          path="/admin/products"
          element={
            <LazyPage>
              <Products />
            </LazyPage>
          }
        />

        <Route
          path="/admin/products/add"
          element={
            <LazyPage>
              <AddProduct />
            </LazyPage>
          }
        />

        <Route
          path="/admin/products/:id/edit"
          element={
            <LazyPage>
              <EditProduct />
            </LazyPage>
          }
        />

        <Route
          path="/admin/products/:id"
          element={
            <LazyPage>
              <ProductDetail />
            </LazyPage>
          }
        />

        <Route
          path="/admin/purchased-products"
          element={
            <LazyPage>
              <PurchasedProducts />
            </LazyPage>
          }
        />

        <Route
          path="/admin/purchased-products/:id"
          element={
            <LazyPage>
              <OrderDetail />
            </LazyPage>
          }
        />

        <Route
          path="/admin/purchased-products/:id/invoice"
          element={
            <LazyPage>
              <Invoice />
            </LazyPage>
          }
        />

        <Route
          path="/admin/customers"
          element={
            <LazyPage>
              <Customers />
            </LazyPage>
          }
        />

        <Route
          path="/admin/customers/:id"
          element={
            <LazyPage>
              <CustomerDetail />
            </LazyPage>
          }
        />

        <Route
          path="/admin/out-of-stock"
          element={
            <LazyPage>
              <OutOfStock />
            </LazyPage>
          }
        />

        <Route
          path="/admin/offers"
          element={
            <LazyPage>
              <Offers />
            </LazyPage>
          }
        />

        <Route
          path="/admin/reports"
          element={
            <LazyPage>
              <Reports />
            </LazyPage>
          }
        />

        <Route
          path="/admin/settings"
          element={
            <LazyPage>
              <Settings />
            </LazyPage>
          }
        />
      </Route>

      {/* Unknown route */}
      <Route
        path="*"
        element={<Navigate to="/admin/login" replace />}
      />
    </Routes>
  );
}