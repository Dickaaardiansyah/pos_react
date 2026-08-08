// src/features/notifications/api.js
import { httpClient } from "../../lib/httpClient";

export const notificationsApi = {
  list: (params) => httpClient.get("/notifications", params),
  unreadCount: () => httpClient.get("/notifications/unread-count"),
  markRead: (id) => httpClient.put(`/notifications/${id}/read`),
  markAllRead: () => httpClient.put("/notifications/read-all"),
};
