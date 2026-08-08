// src/features/stockMutation/api.js
import { httpClient } from "../../lib/httpClient";

export const stockMutationApi = {
  listJenis: () => httpClient.get("/stock-mutations/jenis"),
  list: (params) => httpClient.get("/stock-mutations", params),
  getSummary: (params) => httpClient.get("/stock-mutations/summary", params),
};
