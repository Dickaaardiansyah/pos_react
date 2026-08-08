// src/features/products/api.js
import { httpClient } from "../../lib/httpClient";

export const productsApi = {
  list: (params) => httpClient.get("/products", params),
  getByBarcode: (barcode) => httpClient.get(`/products/barcode/${barcode}`),
  getById: (id) => httpClient.get(`/products/${id}`),
  create: (payload) => httpClient.post("/products", payload),
  update: (id, payload) => httpClient.put(`/products/${id}`, payload),
  remove: (id) => httpClient.delete(`/products/${id}`),
  updateStock: (id, payload) => httpClient.put(`/products/${id}/stock`, payload),
  getStockHistory: (id) => httpClient.get(`/products/${id}/stock-history`),
  getReorderPoints: (params) => httpClient.get("/products/reorder-point", params),

  listCategories: () => httpClient.get("/categories"),
  createCategory: (payload) => httpClient.post("/categories", payload),
  removeCategory: (id) => httpClient.delete(`/categories/${id}`),

  listUnits: () => httpClient.get("/units"),
  createUnit: (payload) => httpClient.post("/units", payload),
  removeUnit: (id) => httpClient.delete(`/units/${id}`),
};
