// src/features/cashier/utils/cashierHelper.js
// Pure functions only — no JSX, no side effects. Anything that renders
// markup belongs in ../components instead.

// Untuk item keranjang dengan satuan konversi (mis. beli per dus tapi stok
// dipotong per pcs), hitung qty dalam satuan dasar dan apakah perlu
// ditampilkan sebagai hint tambahan di baris keranjang.
export function cartLineBaseQty(item) {
  const factor = Number(item.option?.conversionQty) || 1;
  const qtyBase = Math.round(Number(item.qty) * factor * 1000) / 1000;
  return { qtyBase, showBaseHint: factor !== 1 };
}
