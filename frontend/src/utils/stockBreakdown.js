// src/utils/stockBreakdown.js
// ─────────────────────────────────────────────────────────────────────────────
// Stok selalu DISIMPAN dalam satuan dasar (mis. Kg, Botol) — tapi menampilkan
// "123 Kg" ke pengguna kurang mudah dibaca dibanding "4 Karung 23 Kg". Fungsi
// ini murni tampilan (tidak pernah disimpan ke database) dan generik: tidak
// ada nama satuan yang di-hardcode, semua berasal dari `unit_breakdown` yang
// dikirim backend (lihat productModel.findAll di backend) — daftar satuan
// tambahan produk beserta faktor konversinya terhadap satuan dasar.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {number} stock - stok saat ini, dalam satuan dasar
 * @param {string} baseUnitName - nama satuan dasar (mis. "kg", "botol")
 * @param {Array<{unit_name:string, conversion_qty:number|string}>} unitBreakdown
 *        daftar satuan tambahan produk (dari product.unit_breakdown / additional_units)
 * @returns {string} mis. "4 Karung 23 Kg", "10 Botol", "0 Kg"
 */
export function formatStockBreakdown(stock, baseUnitName, unitBreakdown) {
  const base = baseUnitName || "pcs";
  const qty = Number(stock) || 0;

  const units = (unitBreakdown || [])
    .map((u) => ({
      name: u.unit_name,
      factor: Number(u.conversion_qty),
    }))
    .filter((u) => u.name && u.factor > 0)
    // Terbesar dulu, supaya breakdown-nya greedy dari satuan paling besar.
    .sort((a, b) => b.factor - a.factor);

  if (units.length === 0 || qty <= 0) {
    return `${formatNumber(qty)} ${base}`;
  }

  let remaining = qty;
  const parts = [];
  for (const u of units) {
    const count = Math.floor(remaining / u.factor);
    if (count > 0) {
      parts.push(`${count} ${u.name}`);
      remaining -= count * u.factor;
    }
  }
  // Sisa yang tidak cukup untuk satuan tambahan manapun, tampilkan dalam
  // satuan dasar (dibulatkan wajar untuk pecahan seperti 0.5 Kg).
  if (remaining > 0 || parts.length === 0) {
    parts.push(`${formatNumber(remaining)} ${base}`);
  }
  return parts.join(" ");
}

function formatNumber(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "0";
  return x.toLocaleString("id-ID", { maximumFractionDigits: 3 });
}
