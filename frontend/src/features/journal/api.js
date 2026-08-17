// src/features/journal/api.js
import { httpClient } from "../../lib/httpClient";

export const journalApi = {
  getAccounts: (params) => httpClient.get("/journal/accounts", params),
  createAccount: (payload) => httpClient.post("/journal/accounts", payload),
  updateAccount: (id, payload) =>
    httpClient.put(`/journal/accounts/${id}`, payload),

  getEntries: (params) => httpClient.get("/journal/entries", params),
  getEntryDetail: (id) => httpClient.get(`/journal/entries/${id}`),
  createManualEntry: (payload) => httpClient.post("/journal/entries", payload),
  deleteEntry: (id) => httpClient.delete(`/journal/entries/${id}`),
  reverseEntry: (id, payload) =>
    httpClient.post(`/journal/entries/${id}/reverse`, payload),

  getAdjustmentTemplates: () => httpClient.get("/journal/adjustment-templates"),
  createAdjustingEntry: (payload) =>
    httpClient.post("/journal/adjustments", payload),

  getLedger: (params) => httpClient.get("/journal/ledger", params),
  getTrialBalance: (params) => httpClient.get("/journal/trial-balance", params),
  getCashFlow: (params) => httpClient.get("/journal/cash-flow", params),
};
