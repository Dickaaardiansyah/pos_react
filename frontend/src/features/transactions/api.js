// src/features/transactions/api.js
import { httpClient } from "../../lib/httpClient";

export const transactionsApi = {
  checkout: (payload) => httpClient.post("/transactions", payload),
  list: (params) => httpClient.get("/transactions", params),
  getById: (id) => httpClient.get(`/transactions/${id}`),
  // Void LANGSUNG — admin saja (backend menolak role lain). Kasir memakai
  // requestVoid di bawah, yang butuh persetujuan admin.
  void: (id, reason) => httpClient.post(`/transactions/${id}/void`, { reason }),
  // Alur pengajuan void (kasir mengajukan, admin menyetujui/menolak).
  requestVoid: (id, reason) =>
    httpClient.post(`/transactions/${id}/void-requests`, { reason }),
  listVoidRequests: (status) =>
    httpClient.get("/void-requests", status ? { status } : undefined),
  approveVoidRequest: (id, note) =>
    httpClient.post(`/void-requests/${id}/approve`, { note }),
  rejectVoidRequest: (id, note) =>
    httpClient.post(`/void-requests/${id}/reject`, { note }),
  getDailySalesReport: (params) =>
    httpClient.get("/reports/sales-daily", params),
  getSalesReport: (params) => httpClient.get("/reports/sales", params),
  getSalesByCustomerReport: (params) =>
    httpClient.get("/reports/sales-by-customer", params),
  getProductProfitReport: (params) =>
    httpClient.get("/reports/product-profit", params),
  getDashboardSummary: () => httpClient.get("/dashboard/summary"),
  getDashboardRevenueHistory: (days) =>
    httpClient.get("/dashboard/revenue-history", { days }),
  getDashboardPeriodSummary: (params) =>
    httpClient.get("/dashboard/period-summary", params),
  getPaymentMethodReport: (params) =>
    httpClient.get("/reports/payment-method", params),
  getVoidReport: (params) => httpClient.get("/reports/void", params),
  listCashiers: () => httpClient.get("/cashiers"),
};
