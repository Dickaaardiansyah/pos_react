// src/features/cashier/hooks.js
// ─────────────────────────────────────────────────────────────────────────────
// Kasir: keranjang, satuan/varian, qty desimal, checkout.
// Model B: stok dipotong dalam satuan dasar (qty × conversion_qty).
//
// Catatan modernisasi: data awal (produk/kategori/pelanggan/pengaturan toko)
// diambil lewat react-query supaya konsisten dengan fitur lain. Logika
// keranjang & checkout SENGAJA dibiarkan sebagai fungsi async biasa (bukan
// dipaksa jadi useMutation) — ini alur transaksi uang nyata dengan banyak
// validasi & reset state berurutan, jadi risikonya lebih besar daripada
// manfaat abstraksinya.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { productsApi } from "../products/api";
import { transactionsApi } from "../transactions/api";
import { settingsApi } from "../settings/api";
import { customersApi } from "../customers/api";
import { printReceiptSmart } from "../../utils/printReceipt";
import { usePrinterContext } from "../../context/PrinterContext";
import { queryKeys } from "../../lib/queryClient";

export const PAYMENT_METHODS = [
  { id: "cash", label: "Tunai" },
  { id: "debit", label: "Debit/Kredit" },
  { id: "qris", label: "QRIS" },
  { id: "open_bill", label: "Open Bill" },
];

function defaultDueDate() {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

function round3(n) {
  return Math.round(Number(n) * 1000) / 1000;
}

/** Harga otomatis ecer/grosir untuk opsi yang dipilih. */
function resolveAutoPricing(product, qty, option = null) {
  const q = Number(qty) || 0;

  if (option && option.type === "variant") {
    const wholesale = parseFloat(option.priceWholesale);
    const minQty = parseInt(option.minQtyWholesale, 10);
    if (wholesale > 0 && minQty > 0 && q >= minQty) {
      return { priceType: "wholesale", price: wholesale };
    }
    return { priceType: "retail", price: parseFloat(option.price) };
  }

  if (option && option.type === "unit" && !option.isBase) {
    const factor = Number(option.conversionQty) || 1;
    let retail = parseFloat(option.price);
    if (!retail || retail <= 0) retail = parseFloat(product.price) * factor;
    const wholesale = parseFloat(option.priceWholesale);
    const minQty = parseInt(option.minQtyWholesale, 10);
    if (wholesale > 0 && minQty > 0 && q >= minQty) {
      return { priceType: "wholesale", price: wholesale };
    }
    if ((!wholesale || wholesale <= 0) && product.price_wholesale) {
      const baseMin = parseInt(product.min_qty_wholesale, 10);
      const qtyInBase = q * factor;
      if (baseMin > 0 && qtyInBase >= baseMin) {
        return {
          priceType: "wholesale",
          price: parseFloat(product.price_wholesale) * factor,
        };
      }
    }
    return { priceType: "retail", price: retail };
  }

  const wholesale = parseFloat(product.price_wholesale);
  const minQty = parseInt(product.min_qty_wholesale, 10);
  if (wholesale > 0 && minQty > 0 && q >= minQty) {
    return { priceType: "wholesale", price: wholesale };
  }
  return { priceType: "retail", price: parseFloat(product.price) };
}

function cartLineKey(productId, option) {
  const t = option?.type || "none";
  const id = option?.id != null ? option.id : "base";
  return `${productId}:${t}:${id}`;
}

function needsOptionPicker(product) {
  if (!product) return false;
  if (product.selection_type === "variant" || product.selection_type === "unit")
    return true;
  return (
    Array.isArray(product.additional_units) &&
    product.additional_units.length > 0
  );
}

function baseOption(product) {
  return {
    type: "unit",
    id: null,
    label: product.unit || "pcs",
    conversionQty: 1,
    isBase: true,
    price: product.price,
    priceWholesale: product.price_wholesale,
    minQtyWholesale: product.min_qty_wholesale,
  };
}

export function useCashier() {
  const [cart, setCart] = useState([]);
  const [barcode, setBarcode] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [cashierName, setCashierName] = useState("Kasir");
  const [customerName, setCustomerName] = useState("");
  const [discount, setDiscount] = useState(0);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [dueDate, setDueDate] = useState(defaultDueDate());
  const [loadingPayment, setLoadingPayment] = useState(false);
  const [lastReceipt, setLastReceipt] = useState(null);
  const [optionProduct, setOptionProduct] = useState(null);

  const barcodeInputRef = useRef(null);
  const printer = usePrinterContext();
  const queryClient = useQueryClient();

  const productsQuery = useQuery({
    queryKey: queryKeys.products(),
    queryFn: () => productsApi.list(),
  });
  const categoriesQuery = useQuery({
    queryKey: queryKeys.categories(),
    queryFn: () => productsApi.listCategories(),
  });
  const storeSettingsQuery = useQuery({
    queryKey: queryKeys.settings(),
    queryFn: () => settingsApi.get(),
  });
  const customersQuery = useQuery({
    queryKey: queryKeys.customers({}),
    queryFn: () => customersApi.getAll({}),
  });

  const allProducts = productsQuery.data?.data ?? [];
  const categories = categoriesQuery.data?.data ?? [];
  const storeSettings = storeSettingsQuery.data?.data ?? {};
  const customers = customersQuery.data?.data ?? [];

  useEffect(() => {
    if (productsQuery.isError) toast.error("Gagal memuat produk");
  }, [productsQuery.isError]);

  useEffect(() => {
    barcodeInputRef.current?.focus();
    try {
      const auth = JSON.parse(localStorage.getItem("pos_auth") || "{}");
      if (auth?.user?.name) setCashierName(auth.user.name);
    } catch {}
  }, []);

  const filteredProducts = useMemo(() => {
    let result = allProducts;
    if (selectedCategory)
      result = result.filter((p) => p.category_id == selectedCategory);
    if (searchTerm) {
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (p.barcode || "").includes(searchTerm),
      );
    }
    return result;
  }, [allProducts, selectedCategory, searchTerm]);

  function stockNeeded(qty, option) {
    const factor = Number(option?.conversionQty) || 1;
    return round3(Number(qty) * factor);
  }

  function handleProductPick(product) {
    if (Number(product.stock) <= 0) {
      toast.error(`Stok ${product.name} habis`);
      return;
    }
    if (needsOptionPicker(product)) {
      setOptionProduct(product);
      return;
    }
    addToCartWithOption(product, baseOption(product));
  }

  function onOptionSelect(opt) {
    if (!optionProduct) return;
    const product = optionProduct;
    setOptionProduct(null);
    const option = {
      type: opt.type,
      id: opt.id,
      label: opt.label,
      conversionQty: Number(opt.conversionQty) || 1,
      isBase: !!opt.isBase,
      price: opt.price,
      priceWholesale: opt.priceWholesale,
      minQtyWholesale: opt.minQtyWholesale,
    };
    addToCartWithOption(product, option);
  }

  function addToCartWithOption(product, option) {
    const key = cartLineKey(product.id, option);
    const pricing = resolveAutoPricing(product, 1, option);
    const need = stockNeeded(1, option);

    setCart((prev) => {
      const existing = prev.find((i) => i.lineKey === key);
      if (existing) {
        const newQty = round3(existing.qty + 1);
        const newNeed = stockNeeded(newQty, option);
        if (newNeed > Number(product.stock) + 0.0005) {
          toast.error(`Stok ${product.name} tidak cukup`);
          return prev;
        }
        const nextPricing = resolveAutoPricing(product, newQty, option);
        if (
          existing.priceType !== "wholesale" &&
          nextPricing.priceType === "wholesale"
        ) {
          toast.success(
            `Harga grosir ${product.name} otomatis berlaku (beli ${newQty})`,
            { duration: 2000 },
          );
        }
        return prev.map((i) =>
          i.lineKey === key ? { ...i, qty: newQty, ...nextPricing } : i,
        );
      }

      if (need > Number(product.stock) + 0.0005) {
        toast.error(`Stok ${product.name} tidak cukup`);
        return prev;
      }

      return [
        ...prev,
        {
          ...product,
          lineKey: key,
          qty: 1,
          option,
          unitLabel: option.label || product.unit || "pcs",
          basePrice: parseFloat(product.price),
          ...pricing,
        },
      ];
    });
    toast.success(`${product.name} ditambahkan`, { duration: 1500 });
  }

  async function submitBarcode(e) {
    e.preventDefault();
    const code = barcode.trim();
    if (!code) return;
    try {
      const res = await productsApi.getByBarcode(code);
      handleProductPick(res.data);
      barcodeInputRef.current?.classList.add("scanning");
      setTimeout(
        () => barcodeInputRef.current?.classList.remove("scanning"),
        500,
      );
    } catch {
      toast.error(`Produk barcode "${code}" tidak ditemukan`);
    } finally {
      setBarcode("");
    }
  }

  function changeQty(lineKey, delta) {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.lineKey !== lineKey) return item;
          const newQty = round3(item.qty + delta);
          if (newQty <= 0) return null;
          const need = stockNeeded(newQty, item.option);
          if (need > Number(item.stock) + 0.0005) {
            toast.error("Stok tidak mencukupi");
            return item;
          }
          const wasWholesale = item.priceType === "wholesale";
          const pricing = resolveAutoPricing(item, newQty, item.option);
          if (!wasWholesale && pricing.priceType === "wholesale") {
            toast.success(
              `Harga grosir ${item.name} otomatis berlaku (beli ${newQty})`,
              { duration: 2000 },
            );
          } else if (wasWholesale && pricing.priceType === "retail") {
            toast(
              `Harga grosir ${item.name} tidak berlaku lagi (beli ${newQty})`,
              { duration: 2000, icon: "ℹ️" },
            );
          }
          return { ...item, qty: newQty, ...pricing };
        })
        .filter(Boolean),
    );
  }

  function setQtyExact(lineKey, raw) {
    const parsed = parseFloat(String(raw).replace(",", "."));
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.lineKey !== lineKey) return item;
          if (!Number.isFinite(parsed) || parsed <= 0) return null;
          const newQty = round3(parsed);
          const need = stockNeeded(newQty, item.option);
          if (need > Number(item.stock) + 0.0005) {
            toast.error(
              `Stok tidak cukup (butuh ${need} ${item.unit || "satuan dasar"})`,
            );
            return item;
          }
          const pricing = resolveAutoPricing(item, newQty, item.option);
          return { ...item, qty: newQty, ...pricing };
        })
        .filter(Boolean),
    );
  }

  function removeFromCart(lineKey) {
    setCart((prev) => prev.filter((i) => i.lineKey !== lineKey));
  }

  function clearCart() {
    if (cart.length > 0 && confirm("Kosongkan keranjang?")) {
      setCart([]);
      setDiscount(0);
    }
  }

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const discountAmount = discount || 0;
  const total = subtotal - discountAmount;
  const change = parseFloat(paymentAmount || 0) - total;

  // Saran nominal cepat untuk pembayaran tunai: "Uang Pas" (persis total)
  // lalu beberapa nominal pecahan uang kertas yang dibulatkan ke atas dari total.
  const quickAmounts = useMemo(() => {
    if (!total || total <= 0) return [];
    const roundUpTo = (num, step) => Math.ceil(num / step) * step;
    const denominations = [5000, 10000, 20000, 50000, 100000];
    const suggestions = new Set([Math.round(total)]); // Uang Pas
    for (const step of denominations) {
      const rounded = roundUpTo(total, step);
      if (rounded > total) suggestions.add(rounded);
    }
    return Array.from(suggestions)
      .sort((a, b) => a - b)
      .slice(0, 5);
  }, [total]);

  function openPaymentModal() {
    if (cart.length === 0) {
      toast.error("Keranjang kosong");
      return;
    }
    setPaymentAmount("");
    setShowPayment(true);
  }

  function openBillShortcut() {
    if (cart.length === 0) {
      toast.error("Keranjang kosong");
      return;
    }
    setPaymentAmount("");
    setPaymentMethod("open_bill");
    setShowPayment(true);
  }

  function selectPaymentMethod(id) {
    setPaymentMethod(id);
    if (id !== "cash" && id !== "open_bill") {
      setPaymentAmount(String(total));
    }
  }

  function selectQuickAmount(amount) {
    setPaymentAmount(String(amount));
  }

  function selectCustomer(id) {
    setSelectedCustomerId(id);
    const c = customers.find((x) => String(x.id) === String(id));
    if (c) setCustomerName(c.name);
  }

  async function processPayment() {
    const paidAmount = parseFloat(paymentAmount) || 0;
    const isOpenBill = paymentMethod === "open_bill";

    if (isOpenBill) {
      if (!customerName.trim()) {
        toast.error("Pelanggan wajib dipilih untuk Open Bill");
        return;
      }
      if (paidAmount > total) {
        toast.error("Jumlah DP tidak boleh melebihi total tagihan");
        return;
      }
      if (!dueDate) {
        toast.error("Tanggal jatuh tempo wajib diisi");
        return;
      }
    } else if (!paidAmount || paidAmount < total) {
      toast.error("Jumlah pembayaran kurang");
      return;
    }

    setLoadingPayment(true);
    try {
      const res = await transactionsApi.checkout({
        items: cart.map((i) => ({
          product_id: i.id,
          quantity: i.qty,
          price_type: i.priceType,
          option: i.option
            ? {
                type: i.option.type,
                id: i.option.id,
                label: i.option.label,
                conversion_qty: i.option.conversionQty,
                isBase: i.option.isBase,
                price: i.option.price,
                price_wholesale: i.option.priceWholesale,
                min_qty_wholesale: i.option.minQtyWholesale,
              }
            : { type: "none", conversion_qty: 1 },
        })),
        payment_method: paymentMethod,
        payment_amount: paidAmount,
        customer_name: customerName,
        customer_id: isOpenBill ? selectedCustomerId || null : null,
        due_date: isOpenBill ? dueDate : undefined,
        cashier_name: cashierName,
        discount_amount: discountAmount,
      });

      setLastReceipt(res.data);
      setCart([]);
      setDiscount(0);
      setShowPayment(false);
      setPaymentAmount("");
      setCustomerName("");
      setSelectedCustomerId("");
      setDueDate(defaultDueDate());
      // Refresh stok di grid & cache produk lain (dashboard, laporan, dsb.)
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success(
        isOpenBill
          ? "Transaksi Open Bill berhasil dicatat!"
          : "Transaksi berhasil!",
      );
    } catch (e) {
      toast.error(e.message || "Transaksi gagal");
    } finally {
      setLoadingPayment(false);
    }
  }

  async function printReceipt(transaction) {
    await printReceiptSmart(transaction, storeSettings, printer);
  }

  return {
    cart,
    barcode,
    searchTerm,
    filteredProducts,
    categories,
    selectedCategory,
    subtotal,
    discountAmount,
    total,
    change,
    quickAmounts,
    discount,
    showPayment,
    paymentMethod,
    paymentAmount,
    cashierName,
    customerName,
    customers,
    selectedCustomerId,
    dueDate,
    loadingPayment,
    lastReceipt,
    storeSettings,
    barcodeInputRef,
    printer,
    optionProduct,
    setSearchTerm,
    setSelectedCategory,
    setBarcode,
    setDiscount,
    setCashierName,
    setCustomerName,
    setDueDate,
    setPaymentAmount,
    setShowPayment,
    setLastReceipt,
    setOptionProduct,
    handleProductPick,
    onOptionSelect,
    submitBarcode,
    changeQty,
    setQtyExact,
    removeFromCart,
    clearCart,
    openPaymentModal,
    openBillShortcut,
    selectPaymentMethod,
    selectQuickAmount,
    selectCustomer,
    processPayment,
    printReceipt,
    addToCart: handleProductPick,
  };
}
