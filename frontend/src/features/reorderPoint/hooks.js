// src/features/reorderPoint/hooks.js
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { productsApi } from "../products/api";
import { queryKeys } from "../../lib/queryClient";

export function useReorderPoint() {
  const [days, setDays] = useState(30);
  const [search, setSearch] = useState("");
  const [onlyNeedsReorder, setOnlyNeedsReorder] = useState(false);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.reorderPoints(days),
    queryFn: () => productsApi.getReorderPoints({ days }),
  });
  const items = query.data?.data ?? [];

  // "Salin ROP ke Stok Minimum" — sekali klik, tidak menggabung otomatis
  // (min_stock & ROP tetap dua angka independen; ini alat bantu manual).
  const copyMutation = useMutation({
    mutationFn: (product) => {
      const newMinStock = Math.ceil(Number(product.reorder_point) || 0);
      return productsApi.update(product.id, { min_stock: newMinStock }).then(() => ({
        product,
        newMinStock,
      }));
    },
    onSuccess: ({ product, newMinStock }) => {
      toast.success(`Stok minimum "${product.name}" disamakan dengan ROP (${newMinStock})`);
      queryClient.setQueryData(queryKeys.reorderPoints(days), (old) =>
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
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return {
    items: filtered,
    total: items.length,
    needsReorderCount: items.filter((p) => p.needs_reorder).length,
    loading: query.isLoading,
    days,
    setDays,
    search,
    setSearch,
    onlyNeedsReorder,
    setOnlyNeedsReorder,
    reload: query.refetch,
    copyRopToMinStock: copyMutation.mutate,
    copyingId: copyMutation.isPending ? copyMutation.variables?.id : null,
  };
}
