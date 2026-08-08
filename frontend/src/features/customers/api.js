// src/features/customers/api.js
import { httpClient } from "../../lib/httpClient";

export const customersApi = {
  getAll: (params) => httpClient.get("/customers", params),
  getById: (id) => httpClient.get(`/customers/${id}`),
  create: (payload) => httpClient.post("/customers", payload),
  update: (id, payload) => httpClient.put(`/customers/${id}`, payload),
  remove: (id) => httpClient.delete(`/customers/${id}`),
};
