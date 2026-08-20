// src/utils/printLaporan.js
// ─────────────────────────────────────────────────────────────────────────────
// Cetak & ekspor generik untuk Laporan (Penjualan, Barang Masuk, Barang
// Expired) di menu Keuangan → Laporan. Meniru gaya cetak Laba Rugi
// (printLabaRugi.js): hitam-putih, margin A4, siap cetak/PDF via browser,
// serta ekspor .xlsx via SheetJS.
// ─────────────────────────────────────────────────────────────────────────────
import { formatRupiah, formatDateTime, escapeHtml } from "./format";

// FIX (review dosen #8): file ini sebelumnya membangun HTML laporan dengan
// menyuntikkan title/storeName/storeAddress/periodLabel/column label/nilai
// baris/summary secara mentah ke dalam template string, lalu merender
// lewat win.document.write(html) — yang benar-benar MENGEKSEKUSI HTML/JS,
// bukan cuma menampilkannya sebagai teks. Banyak dari nilai itu berasal
// dari input bebas pengguna (mis. customer_name pada Laporan Penjualan per
// Pelanggan, supplier_name pada Laporan Pembelian per Supplier), sehingga
// kasir/pengguna bisa menitip payload <script>/onerror ke nama pelanggan
// atau nama supplier saat transaksi, yang baru "meledak" ketika admin lain
// membuka & mencetak laporan terkait (stored XSS). Pola ini sudah pernah
// ditutup di struk (lihat escapeHtml() & generateReceiptHTML() di file ini
// juga) tapi belum ikut diterapkan di sini. Sekarang SETIAP nilai
// dinamis/teks-bebas di-escape lewat escapeHtml() sebelum masuk ke HTML —
// termasuk title & storeName/storeAddress (nama toko diisi admin lewat
// Pengaturan, tetap di-escape sebagai defense-in-depth murah, konsisten
// dengan generateReceiptHTML).

function reportMeta(storeSettings, title, periodLabel) {
  return {
    storeName: storeSettings?.store_name || "Toko Saya",
    storeAddress: storeSettings?.store_address || "",
    title,
    periodLabel,
    printedAt: formatDateTime(
      new Date().toISOString().slice(0, 19).replace("T", " "),
    ),
  };
}

function reportCSS() {
  return `
    @page { size: A4 landscape; margin: 16mm 14mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #000; background: #fff; margin: 0; padding: 24px; font-size: 12px; }
    .rp-header { text-align: center; margin-bottom: 16px; }
    .rp-store { font-size: 18px; font-weight: 700; }
    .rp-address { font-size: 11px; color: #333; margin-top: 2px; }
    .rp-title { font-size: 16px; font-weight: 700; margin-top: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #1c4b9b; }
    .rp-period { font-size: 12px; margin-top: 2px; }
    .rp-divider { border: none; border-top: 2px solid #000; margin: 12px 0; }
    .rp-summary { display: flex; gap: 24px; margin-bottom: 14px; flex-wrap: wrap; }
    .rp-summary div { font-size: 12px; }
    .rp-summary b { display: block; font-size: 14px; }
    table.rp-table { width: 100%; border-collapse: collapse; }
    table.rp-table th { padding: 6px 4px; font-size: 11.5px; text-align: right; border-bottom: 2px solid #000; font-weight: 700; }
    table.rp-table th:first-child, table.rp-table th:nth-child(2) { text-align: left; }
    table.rp-table td { padding: 5px 4px; font-size: 12px; border-bottom: 1px solid #e2e2e2; text-align: right; }
    table.rp-table td:first-child, table.rp-table td:nth-child(2) { text-align: left; }
    .rp-footer { margin-top: 24px; display: flex; justify-content: space-between; font-size: 10.5px; color: #444; }
    @media print { .rp-noprint { display: none; } }
  `;
}

/**
 * Cetak laporan tabular generik lewat window.print().
 * columns: [{ key, label }]  rows: array of plain objects (nilai sudah string siap tampil)
 * summary: [{ label, value }] — opsional, ditampilkan sebagai ringkasan di atas tabel
 */
export function printTabularReport({
  title,
  periodLabel,
  storeSettings,
  columns,
  rows,
  summary = [],
}) {
  const meta = reportMeta(storeSettings, title, periodLabel);

  const headHTML = `<tr>${columns.map((c) => `<th>${escapeHtml(c.label)}</th>`).join("")}</tr>`;
  const bodyHTML = rows
    .map(
      (row) =>
        `<tr>${columns.map((c) => `<td>${escapeHtml(row[c.key] ?? "")}</td>`).join("")}</tr>`,
    )
    .join("");
  const summaryHTML = summary.length
    ? `<div class="rp-summary">${summary.map((s) => `<div>${escapeHtml(s.label)}<b>${escapeHtml(s.value)}</b></div>`).join("")}</div>`
    : "";

  const html = `
    <html>
    <head>
      <title>${escapeHtml(title)} - ${escapeHtml(meta.storeName)}</title>
      <meta charset="utf-8" />
      <style>${reportCSS()}</style>
    </head>
    <body>
      <div class="rp-header">
        <div class="rp-store">${escapeHtml(meta.storeName)}</div>
        ${meta.storeAddress ? `<div class="rp-address">${escapeHtml(meta.storeAddress)}</div>` : ""}
        <div class="rp-title">${escapeHtml(title)}</div>
        <div class="rp-period">${escapeHtml(periodLabel)}</div>
      </div>
      <hr class="rp-divider" />
      ${summaryHTML}
      <table class="rp-table"><thead>${headHTML}</thead><tbody>${bodyHTML}</tbody></table>
      <div class="rp-footer">
        <span>Dicetak: ${escapeHtml(meta.printedAt)}</span>
        <span>Sistem POS</span>
      </div>
      <script>window.onload = () => { window.print(); }<\/script>
    </body>
    </html>
  `;
  const win = window.open("", "_blank", "width=1100,height=750");
  if (!win) return false;
  win.document.write(html);
  win.document.close();
  return true;
}

export async function exportTabularReportExcel({
  title,
  periodLabel,
  storeSettings,
  columns,
  rows,
  summary = [],
  filename,
}) {
  const XLSX = await import("xlsx");
  const meta = reportMeta(storeSettings, title, periodLabel);

  const sheetData = [
    [meta.storeName],
    meta.storeAddress ? [meta.storeAddress] : [],
    [title],
    [periodLabel],
    [],
  ];

  if (summary.length) {
    summary.forEach((s) => sheetData.push([s.label, s.value]));
    sheetData.push([]);
  }

  sheetData.push(columns.map((c) => c.label));
  rows.forEach((row) => sheetData.push(columns.map((c) => row[c.key] ?? "")));
  sheetData.push([]);
  sheetData.push([`Dicetak: ${meta.printedAt}`]);

  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  ws["!cols"] = columns.map(() => ({ wch: 20 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 31));
  XLSX.writeFile(wb, filename || `${title.replace(/\s+/g, "_")}.xlsx`);
}

export { formatRupiah };
