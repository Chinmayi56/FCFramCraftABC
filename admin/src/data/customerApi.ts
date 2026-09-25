// Admin Customers data layer.
//
// Talks to the real FastAPI Admin Customer endpoints:
//   GET /api/admin/customers
//   GET /api/admin/customers/{id}
//
// The backend returns objects matching the `Customer` type,
// so no additional field mapping is required.

import { apiRequest } from "../lib/apiClient";
import type { Customer } from "../types";

export async function fetchCustomers(): Promise<Customer[]> {
  return apiRequest<Customer[]>("/api/admin/customers");
}

export async function fetchCustomer(id: string): Promise<Customer> {
  return apiRequest<Customer>(
    `/api/admin/customers/${encodeURIComponent(id)}`
  );
}