// src/features/stockOpname/api.js
import { httpClient } from "../../lib/httpClient";

export const stockOpnameApi = {
  listProducts: (params) => httpClient.get("/stock-opname/products", params),
  create: (payload) => httpClient.post("/stock-opname", payload),
  list: (params) => httpClient.get("/stock-opname", params),
  getById: (id) => httpClient.get(`/stock-opname/${id}`),
};
