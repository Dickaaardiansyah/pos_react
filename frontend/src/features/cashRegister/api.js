// src/features/cashRegister/api.js
import { httpClient } from "../../lib/httpClient";

export const cashRegisterApi = {
  getCashOutCategories: () =>
    httpClient.get("/cash-register/cash-out-categories"),
  getCashInCategories: () =>
    httpClient.get("/cash-register/cash-in-categories"),

  getActive: () => httpClient.get("/cash-register/active"),
  open: (payload) => httpClient.post("/cash-register/open", payload),
  close: (id, payload) =>
    httpClient.post(`/cash-register/${id}/close`, payload),

  createMovement: (payload) =>
    httpClient.post("/cash-register/movements", payload),
  deleteMovement: (id) => httpClient.delete(`/cash-register/movements/${id}`),

  history: (params) => httpClient.get("/cash-register/history", params),
  getById: (id) => httpClient.get(`/cash-register/${id}`),
  getReport: (params) => httpClient.get("/cash-register/report", params),
};
