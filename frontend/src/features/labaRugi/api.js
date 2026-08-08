// src/features/labaRugi/api.js — biaya operasional & Laba Rugi
import { httpClient } from "../../lib/httpClient";

export const accountingApi = {
  getExpenseCategories: () => httpClient.get("/accounting/expense-categories"),
  listExpenses: (params) => httpClient.get("/accounting/expenses", params),
  createExpense: (payload) => httpClient.post("/accounting/expenses", payload),
  updateExpense: (id, payload) => httpClient.put(`/accounting/expenses/${id}`, payload),
  removeExpense: (id) => httpClient.delete(`/accounting/expenses/${id}`),

  getIncomeStatement: (params) => httpClient.get("/accounting/income-statement", params),
  getMultiYearIncomeStatement: (params) => httpClient.get("/accounting/income-statement/multi-year", params),
  getQuarterlyIncomeStatement: (params) => httpClient.get("/accounting/income-statement/quarterly", params),
  getMultiPeriodIncomeStatement: (params) => httpClient.get("/accounting/income-statement/multi-period", params),
  getComparisonIncomeStatement: (params) => httpClient.get("/accounting/income-statement/comparison", params),
  getMonthlyTrend: () => httpClient.get("/accounting/monthly-trend"),
};
