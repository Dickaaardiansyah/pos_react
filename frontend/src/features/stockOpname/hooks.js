// src/features/stockOpname/hooks.js
import { useEffect, useState } from "react";
import {
  useQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import toast from "react-hot-toast";
import { stockOpnameApi } from "./api";
import { useAuth } from "../../context/AuthContext";
import { queryKeys } from "../../lib/queryClient";

function today() {
  return new Date().toISOString().split("T")[0];
}

export function useStockOpname() {
  const [tab, setTab] = useState("list"); // list | new
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selected, setSelected] = useState(null);

  // Debounce kata kunci pencarian supaya tidak fetch di setiap ketikan huruf
  // (yang sebelumnya membuat seluruh list ter-remount / terasa "refresh").
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const query = useQuery({
    queryKey: queryKeys.stockOpnames({ page, search: debouncedSearch }),
    queryFn: () =>
      stockOpnameApi.list({
        page,
        limit: 20,
        search: debouncedSearch || undefined,
      }),
    placeholderData: keepPreviousData, // tetap tampilkan data lama saat query baru sedang fetch
  });

  function updateSearch(value) {
    setSearch(value);
    setPage(1); // reset ke halaman pertama tiap kali kata kunci berubah
  }

  async function viewDetail(id) {
    try {
      const res = await stockOpnameApi.getById(id);
      setSelected(res.data);
    } catch {
      toast.error("Gagal memuat detail stock opname");
    }
  }

  return {
    tab,
    setTab,
    sessions: query.data?.data ?? [],
    total: query.data?.total ?? 0,
    page,
    setPage,
    search,
    setSearch: updateSearch,
    loading: query.isLoading, // hanya true di initial load (belum ada data sama sekali)
    fetching: query.isFetching, // true tiap kali fetch, termasuk saat mencari — dipakai untuk indikator halus, bukan swap seluruh list
    selected,
    setSelected,
    viewDetail,
    reload: query.refetch,
  };
}

/** Hook form sesi stock opname baru — state keranjang lokal, bukan server-cache. */
export function useStockOpnameForm(onSuccess) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [opnameDate, setOpnameDate] = useState(today());
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const productsQuery = useQuery({
    queryKey: queryKeys.products(),
    queryFn: () => stockOpnameApi.listProducts(),
  });

  function addItem(product) {
    setItems((prev) => {
      if (prev.some((i) => i.product_id === product.id)) return prev;
      const stock = parseFloat(product.stock) || 0;
      return [
        ...prev,
        {
          product_id: product.id,
          product_name: product.name,
          barcode: product.barcode,
          unit: product.unit || "pcs",
          system_stock: stock,
          cost_price: product.cost_price || 0,
          physical_stock: stock,
          notes: "",
        },
      ];
    });
  }

  function addAllVisible(visibleProducts) {
    setItems((prev) => {
      const existingIds = new Set(prev.map((i) => i.product_id));
      const additions = visibleProducts
        .filter((p) => !existingIds.has(p.id))
        .map((p) => {
          const stock = parseFloat(p.stock) || 0;
          return {
            product_id: p.id,
            product_name: p.name,
            barcode: p.barcode,
            unit: p.unit || "pcs",
            system_stock: stock,
            cost_price: p.cost_price || 0,
            physical_stock: stock,
            notes: "",
          };
        });
      return [...prev, ...additions];
    });
  }

  function updateItem(productId, field, value) {
    setItems((prev) =>
      prev.map((i) =>
        i.product_id === productId ? { ...i, [field]: value } : i,
      ),
    );
  }
  function removeItem(productId) {
    setItems((prev) => prev.filter((i) => i.product_id !== productId));
  }

  const itemsWithDiff = items.map((i) => {
    const physical =
      i.physical_stock === "" ? 0 : parseFloat(i.physical_stock) || 0;
    const difference = Number((physical - i.system_stock).toFixed(3));
    return {
      ...i,
      difference,
      difference_value: Number(
        (difference * parseFloat(i.cost_price || 0)).toFixed(2),
      ),
    };
  });

  const totalDifferenceQty = itemsWithDiff.reduce(
    (s, i) => s + i.difference,
    0,
  );
  const totalDifferenceValue = itemsWithDiff.reduce(
    (s, i) => s + i.difference_value,
    0,
  );
  const totalSelisihItems = itemsWithDiff.filter(
    (i) => i.difference !== 0,
  ).length;

  async function submit() {
    if (items.length === 0) {
      toast.error("Pilih minimal satu produk untuk diperiksa");
      return false;
    }
    setSubmitting(true);
    try {
      await stockOpnameApi.create({
        opname_date: opnameDate,
        notes,
        recorded_by: user?.name || "Admin",
        items: itemsWithDiff.map((i) => ({
          product_id: i.product_id,
          physical_stock:
            i.physical_stock === "" ? 0 : parseFloat(i.physical_stock),
          notes: i.notes,
        })),
      });
      toast.success("Stock opname tersimpan, stok sistem telah disesuaikan");
      setItems([]);
      setNotes("");
      productsQuery.refetch();
      queryClient.invalidateQueries({ queryKey: ["products"] });
      onSuccess?.();
      return true;
    } catch (e) {
      toast.error(e.message);
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  return {
    products: productsQuery.data?.data ?? [],
    loadingProducts: productsQuery.isLoading,
    items: itemsWithDiff,
    addItem,
    addAllVisible,
    updateItem,
    removeItem,
    opnameDate,
    setOpnameDate,
    notes,
    setNotes,
    submitting,
    submit,
    totalDifferenceQty,
    totalDifferenceValue,
    totalSelisihItems,
  };
}
