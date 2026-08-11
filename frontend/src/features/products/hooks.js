// src/features/products/hooks.js
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { productsApi } from "./api";
import { queryKeys } from "../../lib/queryClient";

export const EMPTY_PRODUCT_FORM = {
  barcode: "",
  name: "",
  description: "",
  category_id: "",
  category_name: "",
  price: "",
  price_wholesale: "",
  min_qty_wholesale: "",
  cost_price: "",
  stock: "",
  min_stock: 5,
  lead_time_value: "",
  safety_stock_value: "",
  rop_time_unit: "hari",
  unit: "pcs",
  is_active: 1,
  // Field bantu (tidak dikirim apa adanya ke API) — dipakai untuk menghitung
  // cost_price otomatis: Harga Beli ÷ Isi. Kalau diisi, hasilnya juga
  // disimpan sebagai baris purchase_only di additional_units, supaya satuan
  // ini otomatis kepakai lagi di dropdown "Satuan Beli" pada form Pembelian.
  initial_purchase_unit_id: null,
  initial_purchase_unit_name: "",
  initial_purchase_conversion_qty: "",
  initial_purchase_price: "",
  additional_units: [
    {
      unit_id: null,
      unit_name: "",
      conversion_qty: "",
      price: "",
      price_wholesale: "",
      min_qty_wholesale: "",
      purchase_only: false,
    },
  ],
  variants: [
    {
      name: "",
      price: "",
      price_wholesale: "",
      min_qty_wholesale: "",
      barcode: "",
    },
  ],
};

function generateBarcodeCode() {
  const ts = Math.floor(Date.now() / 100)
    .toString()
    .slice(-10);
  const rand = String(Math.floor(Math.random() * 1000)).padStart(3, "0");
  return `889${ts}${rand}`;
}

// ─── Daftar produk + kategori + satuan (server cache via react-query) ──────
export function useProducts() {
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterLowStock, setFilterLowStock] = useState(false);
  const queryClient = useQueryClient();

  const productsQuery = useQuery({
    queryKey: queryKeys.products(),
    queryFn: () => productsApi.list(),
  });
  const categoriesQuery = useQuery({
    queryKey: queryKeys.categories(),
    queryFn: () => productsApi.listCategories(),
  });
  const unitsQuery = useQuery({
    queryKey: queryKeys.units(),
    queryFn: () => productsApi.listUnits(),
  });

  const products = productsQuery.data?.data ?? [];
  const categories = categoriesQuery.data?.data ?? [];
  const units = unitsQuery.data?.data ?? [];
  const loading =
    productsQuery.isLoading ||
    categoriesQuery.isLoading ||
    unitsQuery.isLoading;

  function reload() {
    productsQuery.refetch();
    categoriesQuery.refetch();
    unitsQuery.refetch();
  }

  const filtered = products.filter((p) => {
    if (
      search &&
      !p.name.toLowerCase().includes(search.toLowerCase()) &&
      !(p.barcode || "").includes(search)
    )
      return false;
    if (filterCategory && p.category_id != filterCategory) return false;
    if (filterLowStock && Number(p.stock) > Number(p.min_stock)) return false;
    return true;
  });

  const deleteMutation = useMutation({
    mutationFn: (product) => productsApi.remove(product.id),
    onSuccess: () => {
      toast.success("Produk dihapus");
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
  function deleteProduct(product) {
    if (!confirm(`Hapus produk "${product.name}"?`)) return;
    deleteMutation.mutate(product);
  }

  async function updateStock(product, { quantity, type, notes }) {
    if (!quantity || isNaN(quantity)) {
      toast.error("Jumlah tidak valid");
      return false;
    }
    try {
      await productsApi.updateStock(product.id, {
        quantity: parseInt(quantity),
        type,
        notes,
      });
      toast.success("Stok diperbarui");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      return true;
    } catch (e) {
      toast.error(e.message);
      return false;
    }
  }

  // Data produk lengkap (termasuk additional_units) sebelum buka form edit —
  // listing sengaja tidak menyertakan konversi satuan supaya tetap ringan.
  async function fetchProductForEdit(product) {
    try {
      const res = await productsApi.getById(product.id);
      return res.data;
    } catch (e) {
      toast.error(e.message);
      return product;
    }
  }

  // "Cari atau buat baru" kategori/satuan di form produk.
  async function addCategory(name) {
    const res = await productsApi.createCategory({ name });
    queryClient.setQueryData(queryKeys.categories(), (old) =>
      old && !old.data.some((c) => c.id === res.data.id)
        ? { ...old, data: [...old.data, res.data] }
        : old,
    );
    return res.data;
  }
  async function addUnit(name) {
    const res = await productsApi.createUnit({ name });
    queryClient.setQueryData(queryKeys.units(), (old) =>
      old && !old.data.some((u) => u.id === res.data.id)
        ? { ...old, data: [...old.data, res.data] }
        : old,
    );
    return res.data;
  }

  async function deleteCategory(category) {
    try {
      const res = await productsApi.removeCategory(category.id);
      toast.success(res.message || "Kategori dihapus");
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      return true;
    } catch (e) {
      toast.error(e.message);
      return false;
    }
  }
  async function deleteUnit(unit) {
    try {
      const res = await productsApi.removeUnit(unit.id);
      toast.success(res.message || "Satuan dihapus");
      queryClient.invalidateQueries({ queryKey: ["units"] });
      return true;
    } catch (e) {
      toast.error(e.message);
      return false;
    }
  }

  return {
    products,
    categories,
    units,
    loading,
    filtered,
    search,
    setSearch,
    filterCategory,
    setFilterCategory,
    filterLowStock,
    setFilterLowStock,
    reload,
    deleteProduct,
    updateStock,
    fetchProductForEdit,
    addCategory,
    addUnit,
    deleteCategory,
    deleteUnit,
  };
}

/**
 * Hook form tambah/edit produk — tetap custom hook biasa (bukan react-query)
 * karena isinya state form + validasi lokal, bukan data server yang perlu
 * di-cache. Dipisah dari useProducts karena hidup di modal tersendiri dan
 * punya siklus hidupnya sendiri (termasuk cek duplikasi barcode real-time).
 */
export function useProductForm(editProduct, onSuccess, onClose) {
  const [form, setForm] = useState(() =>
    editProduct
      ? {
          ...EMPTY_PRODUCT_FORM,
          ...editProduct,
          stock:
            editProduct.stock === "" || editProduct.stock == null
              ? ""
              : Number(editProduct.stock),
          min_stock:
            editProduct.min_stock === "" || editProduct.min_stock == null
              ? ""
              : Number(editProduct.min_stock),
          lead_time_value:
            editProduct.lead_time_value === "" ||
            editProduct.lead_time_value == null
              ? ""
              : Number(editProduct.lead_time_value),
          safety_stock_value:
            editProduct.safety_stock_value === "" ||
            editProduct.safety_stock_value == null
              ? ""
              : Number(editProduct.safety_stock_value),
          rop_time_unit: editProduct.rop_time_unit === "jam" ? "jam" : "hari",
          price_wholesale: editProduct.price_wholesale ?? "",
          min_qty_wholesale: editProduct.min_qty_wholesale ?? "",
          additional_units: [
            ...(editProduct.additional_units || []).map((u) => ({
              unit_id: u.unit_id,
              unit_name: u.unit_name,
              conversion_qty:
                u.conversion_qty === "" || u.conversion_qty == null
                  ? ""
                  : Number(u.conversion_qty),
              price: u.price ?? "",
              price_wholesale: u.price_wholesale ?? "",
              min_qty_wholesale: u.min_qty_wholesale ?? "",
              purchase_only: !!u.purchase_only,
            })),
            {
              unit_id: null,
              unit_name: "",
              conversion_qty: "",
              price: "",
              price_wholesale: "",
              min_qty_wholesale: "",
              purchase_only: false,
            },
          ],
          variants: [
            ...(editProduct.variants || []).map((v) => ({
              name: v.name || "",
              price: v.price ?? "",
              price_wholesale: v.price_wholesale ?? "",
              min_qty_wholesale: v.min_qty_wholesale ?? "",
              barcode: v.barcode || "",
            })),
            {
              name: "",
              price: "",
              price_wholesale: "",
              min_qty_wholesale: "",
              barcode: "",
            },
          ],
        }
      : EMPTY_PRODUCT_FORM,
  );
  const [submitting, setSubmitting] = useState(false);
  const [isGenerated, setIsGenerated] = useState(false);
  const [barcodeStatus, setBarcodeStatus] = useState("idle"); // idle|checking|ok|duplicate|error
  const debounceRef = useRef(null);

  const [optionMode, setOptionModeState] = useState(() => {
    if ((editProduct?.variants || []).length > 0) return "variant";
    if ((editProduct?.additional_units || []).length > 0) return "unit";
    return "none";
  });

  function setOptionMode(mode) {
    setOptionModeState(mode);
    setForm((f) => ({
      ...f,
      additional_units:
        mode === "unit"
          ? f.additional_units
          : [
              {
                unit_id: null,
                unit_name: "",
                conversion_qty: "",
                price: "",
                price_wholesale: "",
                min_qty_wholesale: "",
                purchase_only: false,
              },
            ],
      variants:
        mode === "variant"
          ? f.variants
          : [
              {
                name: "",
                price: "",
                price_wholesale: "",
                min_qty_wholesale: "",
                barcode: "",
              },
            ],
    }));
  }

  useEffect(() => {
    const barcode = form.barcode;
    if (!barcode || barcode.trim().length < 3) {
      setBarcodeStatus("idle");
      return;
    }
    setBarcodeStatus("checking");
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await productsApi.getByBarcode(barcode.trim());
        setBarcodeStatus(
          res.data?.id && res.data.id === (editProduct?.id ?? null)
            ? "ok"
            : "duplicate",
        );
      } catch (e) {
        setBarcodeStatus(
          e.message?.includes("404") || e.message?.includes("tidak ditemukan")
            ? "ok"
            : "error",
        );
      }
    }, 500);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.barcode]);

  const [activeErrorTab, setActiveErrorTab] = useState(null);

  function setField(name, value) {
    setForm((f) => ({ ...f, [name]: value }));
    if (name === "barcode") setIsGenerated(false);
  }

  // Bagian "Info Pembelian Awal" di form Produk: Modal = Harga Beli ÷ Isi.
  // Baris konversi (mis. Karung=25 Kg) juga disimpan ke additional_units
  // dengan purchase_only=true, supaya otomatis kepakai lagi di dropdown
  // "Satuan Beli" pada form Pembelian, TANPA memaksa harga jual satuan itu
  // (toko belum tentu jual per Karung ke pembeli).
  function setInitialPurchase(patch) {
    setForm((f) => {
      const next = { ...f, ...patch };
      const isi = Number(next.initial_purchase_conversion_qty);
      const hargaBeli = Number(next.initial_purchase_price);

      next.cost_price =
        isi > 0 && hargaBeli > 0
          ? Math.round((hargaBeli / isi) * 100) / 100
          : "";

      if (next.initial_purchase_unit_id && isi > 0) {
        const idx = next.additional_units.findIndex(
          (r) => r.unit_id === next.initial_purchase_unit_id,
        );
        const row = {
          unit_id: next.initial_purchase_unit_id,
          unit_name: next.initial_purchase_unit_name,
          conversion_qty: isi,
          price: "",
          price_wholesale: "",
          min_qty_wholesale: "",
          purchase_only: true,
        };
        if (idx === -1) {
          next.additional_units = [row, ...next.additional_units];
        } else {
          // Kalau baris ini sebelumnya sudah diisi manual (jadi satuan jual
          // juga oleh admin), pertahankan harga & status purchase_only-nya —
          // jangan ditimpa balik jadi purchase_only.
          next.additional_units = next.additional_units.map((r, i) =>
            i === idx ? { ...r, conversion_qty: isi } : r,
          );
        }
      }
      return next;
    });
  }

  function unitNameTaken(name, { exceptIndex } = {}) {
    const target = (name || "").trim().toLowerCase();
    if (!target) return false;
    if (target === (form.unit || "").trim().toLowerCase()) return true;
    return form.additional_units.some(
      (row, i) =>
        i !== exceptIndex &&
        (row.unit_name || "").trim().toLowerCase() === target,
    );
  }

  function ensureTrailingEmptyRow(rows) {
    const last = rows[rows.length - 1];
    if (!last || last.unit_id) {
      return [
        ...rows,
        {
          unit_id: null,
          unit_name: "",
          conversion_qty: "",
          price: "",
          price_wholesale: "",
          min_qty_wholesale: "",
          purchase_only: false,
        },
      ];
    }
    return rows;
  }

  function selectBaseUnit(option) {
    if (unitNameTaken(option.name)) {
      toast.error(
        `Satuan "${option.name}" sudah dipakai sebagai satuan tambahan`,
      );
      return;
    }
    setField("unit", option.name);
  }

  function addUnitRow() {
    setForm((f) => ({
      ...f,
      additional_units: [
        ...f.additional_units,
        {
          unit_id: null,
          unit_name: "",
          conversion_qty: "",
          price: "",
          price_wholesale: "",
          min_qty_wholesale: "",
          purchase_only: false,
        },
      ],
    }));
  }

  function selectAdditionalUnit(index, option) {
    if (unitNameTaken(option.name, { exceptIndex: index })) {
      toast.error(`Satuan "${option.name}" sudah dipakai pada baris lain`);
      return;
    }
    setForm((f) => ({
      ...f,
      additional_units: ensureTrailingEmptyRow(
        f.additional_units.map((row, i) =>
          i === index
            ? { ...row, unit_id: option.id, unit_name: option.name }
            : row,
        ),
      ),
    }));
  }

  function updateUnitRow(index, patch) {
    setForm((f) => ({
      ...f,
      additional_units: f.additional_units.map((row, i) => {
        if (i !== index) return row;
        const next = { ...row, ...patch };
        // Baris yang tadinya cuma untuk konversi Pembelian (purchase_only),
        // begitu admin isi Harga Jual manual di sini artinya toko memang
        // mau jual satuan ini juga ke pembeli — jadi otomatis ikut
        // ditampilkan lagi di popup kasir.
        if (
          row.purchase_only &&
          patch.price !== undefined &&
          Number(patch.price) > 0
        ) {
          next.purchase_only = false;
        }
        return next;
      }),
    }));
  }

  function clearUnitRowSelection(index) {
    updateUnitRow(index, { unit_id: null, unit_name: "" });
  }

  function removeUnitRow(index) {
    setForm((f) => ({
      ...f,
      additional_units: f.additional_units.filter((_, i) => i !== index),
    }));
  }

  async function generateBarcode() {
    let code = generateBarcodeCode();
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await productsApi.getByBarcode(code);
        code = generateBarcodeCode();
      } catch {
        break; // 404 → barcode bebas dipakai
      }
    }
    setForm((f) => ({ ...f, barcode: code }));
    setIsGenerated(true);
    toast.success("Barcode otomatis berhasil di-generate", { duration: 2000 });
  }

  function ensureTrailingVariantRow(rows) {
    const last = rows[rows.length - 1];
    const needs =
      !last ||
      (last.name && last.name.trim()) ||
      (last.price !== "" && last.price != null);
    if (!needs) return rows;
    return [
      ...rows,
      {
        name: "",
        price: "",
        price_wholesale: "",
        min_qty_wholesale: "",
        barcode: "",
      },
    ];
  }

  function updateVariantRow(index, patch) {
    setForm((f) => ({
      ...f,
      variants: ensureTrailingVariantRow(
        f.variants.map((row, i) => (i === index ? { ...row, ...patch } : row)),
      ),
    }));
  }

  function removeVariantRow(index) {
    setForm((f) => {
      const next = f.variants.filter((_, i) => i !== index);
      return {
        ...f,
        variants:
          next.length === 0
            ? [
                {
                  name: "",
                  price: "",
                  price_wholesale: "",
                  min_qty_wholesale: "",
                  barcode: "",
                },
              ]
            : ensureTrailingVariantRow(next),
      };
    });
  }

  function addVariantRow() {
    setForm((f) => ({
      ...f,
      variants: [
        ...f.variants,
        {
          name: "",
          price: "",
          price_wholesale: "",
          min_qty_wholesale: "",
          barcode: "",
        },
      ],
    }));
  }

  async function submit() {
    setActiveErrorTab(null);
    if (!form.barcode || !form.name) {
      toast.error("Barcode dan nama produk wajib diisi");
      setActiveErrorTab("umum");
      return;
    }
    if (!form.unit) {
      toast.error("Satuan dasar wajib diisi");
      setActiveErrorTab("umum");
      return;
    }
    if (barcodeStatus === "duplicate") {
      toast.error(
        "Barcode sudah digunakan produk lain, silakan ganti atau generate ulang",
      );
      setActiveErrorTab("umum");
      return;
    }
    if (barcodeStatus === "checking") {
      toast.error("Tunggu sebentar, sedang memeriksa barcode...");
      setActiveErrorTab("umum");
      return;
    }
    if (!form.price) {
      toast.error("Harga eceran wajib diisi");
      setActiveErrorTab("harga");
      return;
    }

    if (
      form.initial_purchase_unit_id &&
      (!form.initial_purchase_conversion_qty ||
        Number(form.initial_purchase_conversion_qty) <= 0 ||
        !form.initial_purchase_price ||
        Number(form.initial_purchase_price) <= 0)
    ) {
      toast.error(
        "Lengkapi Isi & Harga Beli di bagian Info Pembelian Awal, atau kosongkan Satuan Beli-nya",
      );
      setActiveErrorTab("harga");
      return;
    }

    const invalidRow = form.additional_units.find(
      (row) =>
        row.unit_name &&
        (!row.unit_id ||
          !row.conversion_qty ||
          Number(row.conversion_qty) <= 0),
    );
    if (invalidRow) {
      toast.error(
        `Isi nilai konversi satuan "${invalidRow.unit_name || "-"}" dengan benar`,
      );
      setActiveErrorTab("opsi");
      return;
    }

    const missingPriceRow = form.additional_units.find(
      (row) =>
        row.unit_id &&
        !row.purchase_only &&
        (!row.price || Number(row.price) <= 0),
    );
    if (missingPriceRow) {
      toast.error(
        `Isi harga jual satuan "${missingPriceRow.unit_name}" terlebih dahulu`,
      );
      setActiveErrorTab("opsi");
      return;
    }

    const names = [
      form.unit.trim().toLowerCase(),
      ...form.additional_units
        .filter((r) => r.unit_id)
        .map((r) => (r.unit_name || "").trim().toLowerCase()),
    ];
    const dupe = names.find((n, i) => names.indexOf(n) !== i);
    if (dupe) {
      toast.error(
        `Satuan "${dupe}" dipakai lebih dari satu kali, mohon perbaiki`,
      );
      setActiveErrorTab("opsi");
      return;
    }

    if (form.price_wholesale && Number(form.price_wholesale) > 0) {
      if (!form.min_qty_wholesale || Number(form.min_qty_wholesale) < 2) {
        toast.error(
          `Isi jumlah beli minimum grosir untuk satuan dasar "${form.unit}" (minimal 2)`,
        );
        setActiveErrorTab("harga");
        return;
      }
    }

    const invalidWholesaleRow = form.additional_units.find(
      (row) =>
        row.unit_id &&
        row.price_wholesale &&
        Number(row.price_wholesale) > 0 &&
        (!row.min_qty_wholesale || Number(row.min_qty_wholesale) < 2),
    );
    if (invalidWholesaleRow) {
      toast.error(
        `Isi jumlah beli minimum grosir untuk satuan "${invalidWholesaleRow.unit_name}" (minimal 2)`,
      );
      setActiveErrorTab("opsi");
      return;
    }

    const filledVariants = form.variants.filter(
      (v) => (v.name || "").trim() && Number(v.price) > 0,
    );
    const filledUnits = form.additional_units.filter(
      (row) => row.unit_id && row.conversion_qty,
    );
    if (filledVariants.length > 0 && filledUnits.length > 0) {
      toast.error(
        "Isi salah satu saja: Satuan tambahan (mis. beras ¼ kg) ATAU Varian (mis. Aqua Es/Biasa)",
      );
      setActiveErrorTab("opsi");
      return;
    }

    for (const v of filledVariants) {
      if (
        v.price_wholesale &&
        Number(v.price_wholesale) > 0 &&
        (!v.min_qty_wholesale || Number(v.min_qty_wholesale) < 2)
      ) {
        toast.error(
          `Isi jumlah beli minimum grosir untuk varian "${v.name}" (minimal 2)`,
        );
        setActiveErrorTab("opsi");
        return;
      }
    }

    const {
      initial_purchase_unit_id,
      initial_purchase_unit_name,
      initial_purchase_conversion_qty,
      initial_purchase_price,
      ...formWithoutHelpers
    } = form;

    const payload = {
      ...formWithoutHelpers,
      price_wholesale:
        form.price_wholesale === "" ? null : form.price_wholesale,
      min_qty_wholesale:
        form.min_qty_wholesale === "" ? null : form.min_qty_wholesale,
      additional_units: form.additional_units
        .filter((row) => row.unit_id && row.conversion_qty)
        .map((row) => ({
          unit_id: row.unit_id,
          conversion_qty: row.conversion_qty,
          price: row.purchase_only && !row.price ? null : row.price,
          price_wholesale:
            row.price_wholesale === "" ? null : row.price_wholesale,
          min_qty_wholesale:
            row.min_qty_wholesale === "" ? null : row.min_qty_wholesale,
          purchase_only: !!row.purchase_only,
        })),
      variants: form.variants
        .filter((v) => (v.name || "").trim() && Number(v.price) > 0)
        .map((v) => ({
          name: v.name.trim(),
          price: v.price,
          price_wholesale: v.price_wholesale === "" ? null : v.price_wholesale,
          min_qty_wholesale:
            v.min_qty_wholesale === "" ? null : v.min_qty_wholesale,
          barcode: (v.barcode || "").trim() || null,
        })),
    };

    setSubmitting(true);
    try {
      if (editProduct) {
        await productsApi.update(editProduct.id, payload);
        toast.success("Produk berhasil diperbarui");
      } else {
        await productsApi.create(payload);
        toast.success("Produk berhasil ditambahkan");
      }
      onSuccess();
      onClose();
    } catch (e) {
      toast.error(
        e.message?.toLowerCase().includes("barcode")
          ? "Barcode sudah digunakan — coba generate ulang"
          : e.message,
      );
    } finally {
      setSubmitting(false);
    }
  }

  return {
    form,
    setField,
    setInitialPurchase,
    submitting,
    isGenerated,
    barcodeStatus,
    generateBarcode,
    submit,
    activeErrorTab,
    optionMode,
    setOptionMode,
    selectBaseUnit,
    addUnitRow,
    selectAdditionalUnit,
    updateUnitRow,
    clearUnitRowSelection,
    removeUnitRow,
    unitNameTaken,
    updateVariantRow,
    removeVariantRow,
    addVariantRow,
  };
}
