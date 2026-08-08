// src/features/auth/api.js — panggilan REST untuk autentikasi
import { httpClient } from "../../lib/httpClient";

export const authApi = {
  login: (username, password) =>
    httpClient.post("/auth/login", { username, password }),
  me: () => httpClient.get("/auth/me"),
};
