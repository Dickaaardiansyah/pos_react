// src/features/capital/api.js
import { httpClient } from "../../lib/httpClient";

export const capitalApi = {
  getSummary: (params) => httpClient.get("/capital/summary", params),
  getTransactions: (params) => httpClient.get("/capital/transactions", params),
  createTransaction: (payload) =>
    httpClient.post("/capital/transactions", payload),
};
