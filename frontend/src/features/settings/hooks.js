// src/features/settings/hooks.js
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { settingsApi } from "./api";
import { useAuth } from "../../context/AuthContext";
import { queryKeys } from "../../lib/queryClient";

export function useSettings() {
  const { isAdmin } = useAuth();
  const [localSettings, setLocalSettings] = useState(null);
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({ queryKey: queryKeys.settings(), queryFn: () => settingsApi.get() });
  const usersQuery = useQuery({ queryKey: queryKeys.users(), queryFn: () => settingsApi.listUsers(), enabled: isAdmin });

  // Pengaturan diedit lokal dulu (form terkontrol) sebelum disimpan — begitu
  // data server datang/berubah, sinkronkan sekali kalau belum pernah diedit.
  const settings = localSettings ?? settingsQuery.data?.data ?? {};

  function setField(key, value) {
    setLocalSettings({ ...settings, [key]: value });
  }

  const saveMutation = useMutation({
    mutationFn: () => settingsApi.update(settings),
    onSuccess: () => {
      toast.success("Pengaturan berhasil disimpan");
      queryClient.invalidateQueries({ queryKey: queryKeys.settings() });
    },
  });

  const createUserMutation = useMutation({
    mutationFn: (payload) => settingsApi.createUser(payload),
    onSuccess: () => {
      toast.success("User berhasil dibuat");
      queryClient.invalidateQueries({ queryKey: queryKeys.users() });
    },
  });
  const updateUserMutation = useMutation({
    mutationFn: ({ id, payload }) => settingsApi.updateUser(id, payload),
    onSuccess: () => {
      toast.success("User diperbarui");
      queryClient.invalidateQueries({ queryKey: queryKeys.users() });
    },
  });
  const removeUserMutation = useMutation({
    mutationFn: (user) => settingsApi.removeUser(user.id),
    onSuccess: () => {
      toast.success("User dinonaktifkan");
      queryClient.invalidateQueries({ queryKey: queryKeys.users() });
    },
  });

  async function createUser(payload) {
    try {
      await createUserMutation.mutateAsync(payload);
      return true;
    } catch {
      return false;
    }
  }
  async function updateUser(id, payload) {
    try {
      await updateUserMutation.mutateAsync({ id, payload });
      return true;
    } catch {
      return false;
    }
  }
  function removeUser(user) {
    if (!confirm(`Nonaktifkan user "${user.name}"?`)) return;
    removeUserMutation.mutate(user);
  }

  async function exportTransactions(range) {
    try {
      await settingsApi.exportTransactionsCSV(range);
      toast.success("Data transaksi diunduh");
    } catch (e) {
      toast.error(e.message);
    }
  }
  async function exportProducts() {
    try {
      await settingsApi.exportProductsCSV();
      toast.success("Data produk diunduh");
    } catch (e) {
      toast.error(e.message);
    }
  }

  return {
    settings,
    users: usersQuery.data?.data ?? [],
    loading: settingsQuery.isLoading || (isAdmin && usersQuery.isLoading),
    saving: saveMutation.isPending,
    setField,
    saveSettings: () => saveMutation.mutate(),
    createUser,
    updateUser,
    removeUser,
    exportTransactions,
    exportProducts,
    reload: settingsQuery.refetch,
  };
}
