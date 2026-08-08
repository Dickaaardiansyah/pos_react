// src/utils/format.js

// ─── Helper: parse string MySQL sebagai waktu LOKAL (bukan UTC) ───────────────
// MySQL mengirim "2025-01-15 06:54:00" tanpa info timezone.
// new Date("2025-01-15 06:54:00") → browser anggap UTC → jam meleset ±7 jam.
// Solusi: parse manual supaya selalu diinterpretasi sebagai waktu lokal.
function parseLocalDate(dateStr) {
  if (!dateStr) return new Date();
  const s = String(dateStr).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  const d = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (d) return new Date(+d[1], +d[2] - 1, +d[3]);
  return new Date(s);
}

export function formatRupiah(amount) {
  if (amount === null || amount === undefined) return "Rp 0";
  const num = Number(amount) || 0;
  const formatted = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(Math.abs(num));
  // Tanda minus digabung manual (bukan dari hasil format Intl langsung) —
  // beberapa browser/ICU menaruh spasi biasa (bukan non-breaking space)
  // antara "-" dan "Rp" pada angka negatif, sehingga di kartu sempit tanda
  // minus bisa terpisah baris sendiri dari "Rp 656.250" dan terlihat seperti
  // nilai kosong/positif. Digabung tanpa spasi supaya selalu utuh "-Rp ...".
  return num < 0 ? `-${formatted}` : formatted;
}

export function formatDate(dateStr) {
  if (!dateStr) return "-";
  return parseLocalDate(dateStr).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

// Kunci tanggal lokal "YYYY-MM-DD" — dipakai untuk mengelompokkan transaksi
// per hari (Riwayat Transaksi) tanpa terpengaruh pergeseran zona waktu UTC.
export function toDateKey(dateStr) {
  const d = parseLocalDate(dateStr);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function formatDateTime(dateStr) {
  if (!dateStr) return "-";
  return parseLocalDate(dateStr).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatShortDate(dateStr) {
  if (!dateStr) return "-";
  return parseLocalDate(dateStr).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
  });
}

// ─── Label sumbu-X grafik laporan (Penjualan / Barang Masuk) ─────────────────
// Backend mengirim `period` dalam 3 bentuk tergantung filter periode:
//   - daily   → tanggal (bisa berupa string ISO seperti "2026-06-12T17:00:00.000Z"
//               karena MySQL DATE() ikut di-serialize dengan timezone)
//   - weekly  → "2026-W24" (format DATE_FORMAT %Y-W%u)
//   - monthly → "2026-06"
// Fungsi ini menyederhanakan ketiganya menjadi label pendek "tanggal + bulan".
export function formatChartPeriod(value, granularity = "daily") {
  if (!value) return "-";
  const str = String(value);

  if (granularity === "monthly") {
    const m = str.match(/^(\d{4})-(\d{2})$/);
    if (m) {
      return new Date(+m[1], +m[2] - 1, 1).toLocaleDateString("id-ID", {
        month: "short",
        year: "numeric",
      });
    }
    return str;
  }

  if (granularity === "weekly") {
    const m = str.match(/^(\d{4})-W(\d{2})$/);
    if (m) return `Mgg ${parseInt(m[2], 10)} '${m[1].slice(2)}`;
    return str;
  }

  // daily — cukup tampilkan tanggal & bulan, tanpa jam/tahun.
  //
  // Catatan penting: nilai "daily" untuk grafik ini berasal dari SQL DATE(t.created_at)
  // yang oleh mysql2 (dengan konfigurasi timezone "+07:00") diserialisasi sebagai
  // ISO string ber-"Z", misal "2026-06-12T17:00:00.000Z" untuk tanggal lokal 13 Juni.
  // String ini SUDAH membawa info timezone eksplisit (Z = UTC), beda dengan string
  // datetime MySQL polos ("2025-01-15 06:54:00") yang ditangani parseLocalDate.
  // Jadi untuk kasus ini kita pakai `new Date()` standar (bukan parseLocalDate) agar
  // konversi UTC → waktu lokal benar dan tanggalnya tidak meleset satu hari.
  if (/T.*(Z|[+-]\d{2}:?\d{2})$/.test(str)) {
    const d = new Date(str);
    // timeZone dikunci ke Asia/Jakarta (WIB) agar cocok dengan konfigurasi
    // backend (`timezone: "+07:00"` di config/database.js) dan tidak bergantung
    // pada setting timezone browser pengguna.
    if (!isNaN(d))
      return d.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        timeZone: "Asia/Jakarta",
      });
  }
  return formatShortDate(str);
}

export function formatNumber(num) {
  if (num === null || num === undefined || num === "") return "0";
  const x = Number(num);
  if (!Number.isFinite(x)) return "0";
  return new Intl.NumberFormat("id-ID").format(x);
}

/**
 * Format qty/stok (boleh desimal).
 * 127 → "127", 249.5 → "249,5", 0.25 → "0,25"
 * Hindari "127.000" yang terbaca sebagai 127 ribu di locale ID.
 */
export function formatQty(num) {
  const x = Number(num);
  if (!Number.isFinite(x)) return "0";
  return x.toLocaleString("id-ID", { maximumFractionDigits: 3 });
}

// settings diambil dari MySQL via API — dikirim dari komponen

/**
 * Label baris item transaksi/struk yang ramah dibaca.
 * Contoh: "Mama Merah 25 kg (1/2 kg) × 1"  atau  "Aqua 600ml — Es × 2"
 */
export function formatSaleItemLabel(item) {
  const name = item.product_name || item.name || "Produk";
  const option =
    item.option_label ||
    item.optionLabel ||
    item.unit_label ||
    item.selected_unit ||
    "";
  const qty = formatQty(item.quantity ?? item.qty ?? 0);
  if (option && String(option).trim()) {
    return `${name} (${String(option).trim()}) × ${qty}`;
  }
  return `${name} × ${qty}`;
}

/**
 * Format input rupiah saat mengetik: 5000 → "5.000"
 * Nilai desimal dari MySQL (kolom DECIMAL selalu balik sebagai string,
 * mis. "4000.00") dibuang dulu bagian pecahannya SEBELUM karakter non-digit
 * dibersihkan — kalau tidak, titik desimalnya ikut lenyap dan "4000.00"
 * salah kebaca jadi 400000 (×100 dari nilai aslinya).
 */
export function formatRupiahInput(value) {
  if (value === "" || value === null || value === undefined) return "";
  const intPart = String(value).split(".")[0].replace(/\D/g, "");
  if (!intPart) return "";
  return Number(intPart).toLocaleString("id-ID");
}

/** Parse hasil formatRupiahInput kembali ke number */
export function parseRupiahInput(formatted) {
  const digits = String(formatted ?? "").replace(/\D/g, "");
  if (!digits) return 0;
  return Number(digits);
}

export function generateReceiptHTML(transaction, settings = {}) {
  if (!transaction) return "";

  const storeName = settings.store_name || "Toko Saya";
  const storeAddress = settings.store_address || "";
  const storePhone = settings.store_phone || "";
  const storeTagline =
    settings.store_tagline || "Terima kasih sudah berbelanja!";
  const footer =
    settings.receipt_footer ||
    "Barang yang sudah dibeli tidak dapat dikembalikan";

  const createdAt = transaction.created_at
    ? parseLocalDate(transaction.created_at)
    : new Date();
  const dateStr = createdAt.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const timeStr = createdAt.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const items = transaction.items || [];
  const itemsHTML = items
    .map(
      (item) => `
    <tr>
      <td style="padding:2px 0;vertical-align:top">${formatSaleItemLabel(item)}</td>
      <td style="text-align:right;padding:2px 0;white-space:nowrap;vertical-align:top">
        ${formatRupiah(item.unit_price)}
      </td>
    </tr>
    <tr>
      <td colspan="2" style="text-align:right;padding:2px 0;padding-bottom:4px;border-bottom:1px dotted #ccc">
        ${formatRupiah(item.subtotal)}
      </td>
    </tr>
  `,
    )
    .join("");

  const payMethod = (transaction.payment_method || "cash").toUpperCase();

  return `
    <div style="font-family:'Courier New',monospace;width:280px;font-size:12px;line-height:1.5">
      <div style="text-align:center;padding-bottom:8px;margin-bottom:8px;border-bottom:2px dashed #000">
        <div style="font-size:16px;font-weight:bold">${storeName}</div>
        ${storeAddress ? `<div>${storeAddress}</div>` : ""}
        ${storePhone ? `<div>Telp: ${storePhone}</div>` : ""}
        ${storeTagline ? `<div style="font-style:italic;font-size:11px">${storeTagline}</div>` : ""}
      </div>
      <div style="margin-bottom:8px;padding-bottom:8px;border-bottom:1px dashed #000">
        <div style="display:flex;justify-content:space-between">
          <span>No</span><span style="font-weight:bold">${transaction.transaction_code}</span>
        </div>
        <div style="display:flex;justify-content:space-between">
          <span>Tanggal</span><span>${dateStr}</span>
        </div>
        <div style="display:flex;justify-content:space-between">
          <span>Jam</span><span>${timeStr}</span>
        </div>
        <div style="display:flex;justify-content:space-between">
          <span>Kasir</span><span>${transaction.cashier_name || "-"}</span>
        </div>
        ${
          transaction.customer_name
            ? `
        <div style="display:flex;justify-content:space-between">
          <span>Pelanggan</span><span>${transaction.customer_name}</span>
        </div>`
            : ""
        }
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:8px">${itemsHTML}</table>
      <div style="border-top:2px dashed #000;padding-top:8px">
        <div style="display:flex;justify-content:space-between">
          <span>Subtotal</span><span>${formatRupiah(transaction.total_amount)}</span>
        </div>
        ${
          Number(transaction.discount_amount) > 0
            ? `
        <div style="display:flex;justify-content:space-between">
          <span>Diskon</span><span>- ${formatRupiah(transaction.discount_amount)}</span>
        </div>`
            : ""
        }
        <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:14px;margin:4px 0;padding-top:4px;border-top:1px solid #000">
          <span>TOTAL</span><span>${formatRupiah(transaction.final_amount)}</span>
        </div>
        <div style="display:flex;justify-content:space-between">
          <span>Bayar (${payMethod})</span><span>${formatRupiah(transaction.payment_amount)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-weight:bold">
          <span>Kembalian</span><span>${formatRupiah(transaction.change_amount)}</span>
        </div>
      </div>
      <div style="text-align:center;margin-top:10px;padding-top:8px;border-top:2px dashed #000;font-size:11px">
        <div>${footer}</div>
        <div style="margin-top:4px">*** Simpan struk ini sebagai bukti ***</div>
      </div>
    </div>
  `;
}
