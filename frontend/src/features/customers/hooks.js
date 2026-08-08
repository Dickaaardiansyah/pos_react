// src/features/customers/hooks.js
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { customersApi } from "./api";
import { useDebounce } from "../../hooks";
import { queryKeys } from "../../lib/queryClient";

export function useCustomers() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.customers({ search: debouncedSearch }),
    queryFn: () => customersApi.getAll({ search: debouncedSearch }),
  });

  const removeMutation = useMutation({
    mutationFn: (id) => customersApi.remove(id),
    onSuccess: () => {
      toast.success("Pelanggan berhasil dihapus");
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (e) => toast.error(e.message || "Gagal menghapus pelanggan"),
  });

  function removeCustomer(customer) {
    if (!window.confirm(`Hapus pelanggan "${customer.name}"?`)) return;
    removeMutation.mutate(customer.id);
  }

  return {
    customers: query.data?.data ?? [],
    loading: query.isLoading,
    search,
    setSearch,
    reload: query.refetch,
    removeCustomer,
  };
}

export function useCustomerForm({ editCustomer, onSuccess, onClose }) {
  const [form, setForm] = useState({
    name: editCustomer?.name || "",
    phone: editCustomer?.phone || "",
    email: editCustomer?.email || "",
    address: editCustomer?.address || "",
    notes: editCustomer?.notes || "",
  });
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      editCustomer
        ? customersApi.update(editCustomer.id, form)
        : customersApi.create(form),
    onSuccess: () => {
      toast.success(
        editCustomer ? "Pelanggan berhasil diperbarui" : "Pelanggan berhasil ditambahkan",
      );
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      onSuccess();
      onClose();
    },
    onError: (e) => toast.error(e.message || "Gagal menyimpan pelanggan"),
  });

  function setField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function submit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Nama pelanggan wajib diisi");
      return;
    }
    mutation.mutate();
  }

  return { form, setField, saving: mutation.isPending, submit };
}
