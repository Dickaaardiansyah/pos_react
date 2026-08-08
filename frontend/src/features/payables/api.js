// src/features/payables/api.js
import { httpClient } from "../../lib/httpClient";

export const payablesApi = {
  getAll: (params) => httpClient.get("/payables", params),
  getById: (id) => httpClient.get(`/payables/${id}`),
  create: (payload) => httpClient.post("/payables", payload),
  remove: (id) => httpClient.delete(`/payables/${id}`),
  recordPayment: (id, payload) => httpClient.post(`/payables/${id}/payments`, payload),

  getUnpaid: () => httpClient.get("/payables/unpaid"),
  getUnpaidPerSupplier: () => httpClient.get("/payables/unpaid-per-supplier"),
  getAging: () => httpClient.get("/payables/aging"),
  getHistory: (params) => httpClient.get("/payables/history", params),
  getSummary: () => httpClient.get("/payables/summary"),
};
