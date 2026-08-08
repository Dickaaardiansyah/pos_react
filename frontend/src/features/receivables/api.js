// src/features/receivables/api.js
import { httpClient } from "../../lib/httpClient";

export const receivablesApi = {
  getAll: (params) => httpClient.get("/receivables", params),
  getById: (id) => httpClient.get(`/receivables/${id}`),
  create: (payload) => httpClient.post("/receivables", payload),
  remove: (id) => httpClient.delete(`/receivables/${id}`),
  recordPayment: (id, payload) => httpClient.post(`/receivables/${id}/payments`, payload),

  getUnpaid: (params) => httpClient.get("/receivables/unpaid", params),
  getUnpaidPerCustomer: () => httpClient.get("/receivables/unpaid-per-customer"),
  getAging: () => httpClient.get("/receivables/aging"),
  getHistory: (params) => httpClient.get("/receivables/history", params),
  getSummary: () => httpClient.get("/receivables/summary"),
};
