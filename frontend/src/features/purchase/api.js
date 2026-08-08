// src/features/purchase/api.js
import { httpClient } from "../../lib/httpClient";

export const purchaseApi = {
  listSuppliers: () => httpClient.get("/suppliers"),
  createSupplier: (payload) => httpClient.post("/suppliers", payload),
  updateSupplier: (id, payload) => httpClient.put(`/suppliers/${id}`, payload),
  removeSupplier: (id) => httpClient.delete(`/suppliers/${id}`),

  create: (payload) => httpClient.post("/purchases", payload),
  createWithNota: ({ items, supplier_id, supplier_name, purchase_date, notes, notaFile, payment_method, due_date }) => {
    const fd = new FormData();
    fd.append("items", JSON.stringify(items));
    fd.append("supplier_id", supplier_id || "");
    fd.append("supplier_name", supplier_name || "");
    fd.append("purchase_date", purchase_date || "");
    fd.append("notes", notes || "");
    fd.append("payment_method", payment_method || "tunai");
    if (payment_method === "kredit") fd.append("due_date", due_date || "");
    if (notaFile) fd.append("nota", notaFile);
    return httpClient.postFormData("/purchases", fd);
  },
  list: (params) => httpClient.get("/purchases", params),
  getById: (id) => httpClient.get(`/purchases/${id}`),
  getReport: (params) => httpClient.get("/purchases/report", params),
  getExpiredReport: (params) => httpClient.get("/purchases/report/expired", params),
  getDashboard: () => httpClient.get("/purchases/dashboard"),
};
