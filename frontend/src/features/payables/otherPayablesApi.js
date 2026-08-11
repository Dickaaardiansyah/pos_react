// src/features/payables/otherPayablesApi.js
import { httpClient } from "../../lib/httpClient";

export const otherPayablesApi = {
  getAll: (params) => httpClient.get("/other-payables", params),
  getById: (id) => httpClient.get(`/other-payables/${id}`),
  create: (payload) => httpClient.post("/other-payables", payload),
  remove: (id) => httpClient.delete(`/other-payables/${id}`),
  recordPayment: (id, payload) =>
    httpClient.post(`/other-payables/${id}/payments`, payload),
  getSummary: () => httpClient.get("/other-payables/summary"),
};
