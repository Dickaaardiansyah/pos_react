// src/features/reorderPoint/hooks.js
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { productsApi } from "../products/api";
import { queryKeys } from "../../lib/queryClient";

// `days = null` berarti mode OTOMATIS — sistem yang memilih periode
// terbaik (lihat productService.pickReorderWindow di backend), bukan
// dropdown manual. Ini default supaya user tidak perlu pilih-pilih.
export function useReorderPoint() {
  const [days, setDays] = useState(null);
  const [search, setSearch] = useState("");
  const [onlyNeedsReorder, setOnlyNeedsReorder] = useState(false);
  const queryClient = useQueryClient();

  const queryKeyDays = days ?? "auto";
  const query = useQuery({
    queryKey: queryKeys.reorderPoints(queryKeyDays),
    queryFn: () => productsApi.getReorderPoints({ days }),
  });
  const items = query.data?.data ?? [];
  // meta.period_mode: "auto" (sistem yang pilih) atau "manual" (user pilih
  // lewat "Ubah periode"). meta.window_days = periode yang benar-benar
  // dipakai untuk hitung rata-rata; meta.available_days = berapa hari
  // histori penjualan yang sebenarnya ada di toko ini.
  const meta = query.data?.meta ?? {
    window_days: 30,
    period_mode: "auto",
    available_days: 0,
  };

  // "Salin ROP ke Stok Minimum" — sekali klik, tidak menggabung otomatis
  // (min_stock & ROP tetap dua angka independen; ini alat bantu manual).
  const copyMutation = useMutation({
    mutationFn: (product) => {
      const newMinStock = Math.ceil(Number(product.reorder_point) || 0);
      return productsApi
        .update(product.id, { min_stock: newMinStock })
        .then(() => ({
          product,
          newMinStock,
        }));
    },
    onSuccess: ({ product, newMinStock }) => {
      toast.success(
        `Stok minimum "${product.name}" disamakan dengan ROP (${newMinStock})`,
      );
      queryClient.setQueryData(queryKeys.reorderPoints(queryKeyDays), (old) =>
        old
          ? {
              ...old,
              data: old.data.map((p) =>
                p.id === product.id ? { ...p, min_stock: newMinStock } : p,
              ),
            }
          : old,
      );
    },
    onError: () => toast.error("Gagal menyalin ROP ke stok minimum"),
  });

  const filtered = items.filter((p) => {
    if (onlyNeedsReorder && !p.needs_reorder) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()))
      return false;
    return true;
  });

  return {
    items: filtered,
    total: items.length,
    needsReorderCount: items.filter((p) => p.needs_reorder).length,
    loading: query.isLoading,
    days,
    setDays,
    meta,
    isAuto: meta.period_mode === "auto",
    search,
    setSearch,
    onlyNeedsReorder,
    setOnlyNeedsReorder,
    reload: query.refetch,
    copyRopToMinStock: copyMutation.mutate,
    copyingId: copyMutation.isPending ? copyMutation.variables?.id : null,
  };
}
