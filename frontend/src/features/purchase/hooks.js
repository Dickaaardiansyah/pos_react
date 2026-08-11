// src/features/purchase/hooks.js
import { useState } from "react";
import {
  useQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import toast from "react-hot-toast";
import { purchaseApi } from "./api";
import { productsApi } from "../products/api";
import { queryKeys } from "../../lib/queryClient";
import { useDebounce } from "../../hooks";

function today() {
  return new Date().toISOString().split("T")[0];
}
function defaultDueDate() {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().split("T")[0];
}

export function usePurchase() {
  const [tab, setTab] = useState("list"); // list | new | suppliers | report
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [selected, setSelected] = useState(null);
  const queryClient = useQueryClient();

  const purchasesQuery = useQuery({
    queryKey: queryKeys.purchases({ page, search: debouncedSearch }),
    queryFn: () =>
      purchaseApi.list({
        page,
        limit: 20,
        search: debouncedSearch || undefined,
      }),
    placeholderData: keepPreviousData,
  });
  const suppliersQuery = useQuery({
    queryKey: queryKeys.suppliers(),
    queryFn: () => purchaseApi.listSuppliers(),
  });
  const productsQuery = useQuery({
    queryKey: queryKeys.products(),
    queryFn: () => productsApi.list(),
  });

  function reload() {
    purchasesQuery.refetch();
    suppliersQuery.refetch();
    productsQuery.refetch();
    queryClient.invalidateQueries({ queryKey: ["products"] });
  }

  async function viewDetail(id) {
    try {
      const res = await purchaseApi.getById(id);
      setSelected(res.data);
    } catch {
      toast.error("Gagal memuat detail pembelian");
    }
  }

  function updateSearch(value) {
    setSearch(value);
    setPage(1);
  }

  return {
    tab,
    setTab,
    purchases: purchasesQuery.data?.data ?? [],
    total: purchasesQuery.data?.total ?? 0,
    page,
    setPage,
    search,
    setSearch: updateSearch,
    suppliers: suppliersQuery.data?.data ?? [],
    products: productsQuery.data?.data ?? [],
    loading:
      purchasesQuery.isLoading ||
      suppliersQuery.isLoading ||
      productsQuery.isLoading,
    selected,
    setSelected,
    viewDetail,
    reload,
  };
}

/**
 * Hook form pembelian baru: keranjang item + satu supplier untuk seluruh
 * transaksi + nota supplier (opsional). Tetap custom hook biasa karena isinya
 * state keranjang/form lokal, bukan data server yang perlu di-cache.
 */
export function usePurchaseForm(products, onSuccess) {
  const [items, setItems] = useState([]);
  const [supplierId, setSupplierId] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(today());
  const [notes, setNotes] = useState("");
  const [notaFile, setNotaFileState] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("tunai"); // 'tunai' | 'kredit'
  const [dueDate, setDueDate] = useState(defaultDueDate());
  const [submitting, setSubmitting] = useState(false);

  // Konversi satuan beli (mis. "karung") ke satuan dasar produk (mis. "kg").
  // Dipakai HANYA untuk tampilan (preview "= X kg ditambahkan ke stok") —
  // perhitungan yang benar-benar dipakai untuk update stok/HPP sekarang
  // dilakukan di backend (purchaseModel.createPurchase), berdasarkan
  // conversion_qty yang diambil ulang dari DB, bukan dari state form ini.
  function conversionOf(item) {
    if (!item.purchase_unit_id) return 1;
    const u = (item.additional_units || []).find(
      (u) => String(u.id) === String(item.purchase_unit_id),
    );
    return parseFloat(u?.conversion_qty) || 1;
  }

  function addItem(product) {
    setItems((prev) => {
      const existing = prev.find((i) => i.product_id === product.id);
      if (existing)
        return prev.map((i) =>
          i.product_id === product.id
            ? { ...i, purchase_qty: (parseFloat(i.purchase_qty) || 0) + 1 }
            : i,
        );
      return [
        ...prev,
        {
          product_id: product.id,
          product_name: product.name,
          base_unit: product.unit,
          base_cost_price: parseFloat(product.cost_price) || 0,
          additional_units: product.additional_units || [],
          purchase_unit_id: "",
          purchase_qty: 1,
          unit_cost: product.cost_price || 0,
          expiry_date: "",
        },
      ];
    });
  }

  function updateItem(productId, field, value) {
    setItems((prev) =>
      prev.map((i) =>
        i.product_id === productId ? { ...i, [field]: value } : i,
      ),
    );
  }

  function updatePurchaseUnit(productId, unitId) {
    setItems((prev) =>
      prev.map((i) => {
        if (i.product_id !== productId) return i;
        const conv = unitId
          ? parseFloat(
              (i.additional_units || []).find(
                (u) => String(u.id) === String(unitId),
              )?.conversion_qty,
            ) || 1
          : 1;
        return {
          ...i,
          purchase_unit_id: unitId,
          unit_cost: Number((i.base_cost_price * conv).toFixed(2)),
        };
      }),
    );
  }

  function removeItem(productId) {
    setItems((prev) => prev.filter((i) => i.product_id !== productId));
  }

  function setNotaFile(file) {
    setNotaFileState(file || null);
  }

  function baseQtyOf(item) {
    return (parseFloat(item.purchase_qty) || 0) * conversionOf(item);
  }

  const totalCost = items.reduce(
    (s, i) =>
      s + (parseFloat(i.unit_cost) || 0) * (parseFloat(i.purchase_qty) || 0),
    0,
  );
  const totalQty = items.reduce((s, i) => s + baseQtyOf(i), 0);

  async function submit() {
    if (items.length === 0) {
      toast.error("Tambahkan minimal satu produk");
      return false;
    }
    for (const i of items) {
      const qty = parseFloat(i.purchase_qty);
      if (isNaN(qty) || qty <= 0) {
        toast.error(`Qty untuk "${i.product_name}" tidak valid`);
        return false;
      }
    }
    if (paymentMethod === "kredit" && !supplierName?.trim()) {
      toast.error("Supplier wajib dipilih untuk pembelian kredit (hutang)");
      return false;
    }
    if (paymentMethod === "kredit" && !dueDate) {
      toast.error("Tanggal jatuh tempo wajib diisi untuk pembelian kredit");
      return false;
    }
    setSubmitting(true);
    try {
      await purchaseApi.createWithNota({
        // Kirim apa adanya dalam satuan yang DIPILIH kasir/admin (mis. 2
        // Karung) — TIDAK dikonversi ke satuan dasar di sini lagi. Backend
        // (purchaseModel.createPurchase) yang mengambil ulang conversion_qty
        // dari DB berdasarkan purchase_unit_id & menghitung qty/HPP dalam
        // satuan dasar, sama seperti alur checkout kasir (createSale).
        items: items.map((i) => ({
          product_id: i.product_id,
          purchase_unit_id: i.purchase_unit_id || null,
          unit_label: i.purchase_unit_id
            ? (i.additional_units || []).find(
                (u) => String(u.id) === String(i.purchase_unit_id),
              )?.unit_name || null
            : null,
          quantity: parseFloat(i.purchase_qty) || 0,
          unit_cost: parseFloat(i.unit_cost) || 0,
          expiry_date: i.expiry_date || null,
        })),
        supplier_id: supplierId || null,
        supplier_name: supplierName,
        purchase_date: purchaseDate,
        notes,
        notaFile,
        payment_method: paymentMethod,
        due_date: paymentMethod === "kredit" ? dueDate : null,
      });
      toast.success(
        paymentMethod === "kredit"
          ? "Pembelian kredit dicatat, stok diperbarui & hutang dibuat"
          : "Pembelian berhasil dicatat, stok diperbarui",
      );
      setItems([]);
      setSupplierId("");
      setSupplierName("");
      setNotes("");
      setNotaFileState(null);
      setPaymentMethod("tunai");
      setDueDate(defaultDueDate());
      onSuccess();
      return true;
    } catch (e) {
      toast.error(e.message);
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  return {
    items,
    addItem,
    updateItem,
    updatePurchaseUnit,
    conversionOf,
    baseQtyOf,
    removeItem,
    totalCost,
    totalQty,
    supplierId,
    setSupplierId,
    supplierName,
    setSupplierName,
    purchaseDate,
    setPurchaseDate,
    notes,
    setNotes,
    notaFile,
    setNotaFile,
    paymentMethod,
    setPaymentMethod,
    dueDate,
    setDueDate,
    submitting,
    submit,
  };
}
