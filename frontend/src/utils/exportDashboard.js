// src/utils/exportDashboard.js
// ─────────────────────────────────────────────────────────────────────────────
// Ekspor ringkasan Dashboard (untuk rentang tanggal yang sedang difilter user)
// ke PDF (cetak lewat browser, gaya sama dengan printLaporan.js/printLabaRugi.js)
// dan ke Excel (.xlsx, multi-sheet via SheetJS).
// ─────────────────────────────────────────────────────────────────────────────
import { formatRupiah, formatDateTime, formatQty, escapeHtml } from "./format";

function meta(storeSettings, periodLabel) {
  return {
    storeName: storeSettings?.store_name || "Toko Saya",
    storeAddress: storeSettings?.store_address || "",
    periodLabel,
    printedAt: formatDateTime(
      new Date().toISOString().slice(0, 19).replace("T", " "),
    ),
  };
}

function dashboardCSS() {
  return `
    @page { size: A4 portrait; margin: 16mm 14mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #000; background: #fff; margin: 0; padding: 24px; font-size: 12px; }
    .db-header { text-align: center; margin-bottom: 16px; }
    .db-store { font-size: 18px; font-weight: 700; }
    .db-address { font-size: 11px; color: #333; margin-top: 2px; }
    .db-title { font-size: 16px; font-weight: 700; margin-top: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #1c4b9b; }
    .db-period { font-size: 12px; margin-top: 2px; }
    .db-divider { border: none; border-top: 2px solid #000; margin: 12px 0; }
    .db-summary { display: flex; gap: 24px; margin-bottom: 16px; flex-wrap: wrap; }
    .db-summary div { font-size: 12px; }
    .db-summary b { display: block; font-size: 14px; }
    .db-section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; margin: 18px 0 8px; border-bottom: 1px solid #000; padding-bottom: 4px; }
    table.db-table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
    table.db-table th { padding: 6px 4px; font-size: 11.5px; text-align: right; border-bottom: 2px solid #000; font-weight: 700; }
    table.db-table th:first-child, table.db-table th:nth-child(2) { text-align: left; }
    table.db-table td { padding: 5px 4px; font-size: 12px; border-bottom: 1px solid #e2e2e2; text-align: right; }
    table.db-table td:first-child, table.db-table td:nth-child(2) { text-align: left; }
    .db-footer { margin-top: 24px; display: flex; justify-content: space-between; font-size: 10.5px; color: #444; }
    @media print { .db-noprint { display: none; } }
  `;
}

function summaryBlock(periodSummary, incomeStatement) {
  const items = [
    { label: "Pendapatan", value: formatRupiah(periodSummary?.revenue || 0) },
    { label: "Jumlah Transaksi", value: String(periodSummary?.txCount || 0) },
    {
      label: "Total Pengeluaran",
      value: formatRupiah(periodSummary?.expensesTotal || 0),
    },
  ];
  if (incomeStatement) {
    items.push({
      label: "Laba Bersih",
      value: formatRupiah(incomeStatement.net_profit || 0),
    });
  }
  return items;
}

/**
 * Cetak ringkasan Dashboard (periode terfilter) lewat window.print().
 */
export function printDashboardReport({
  storeSettings,
  periodLabel,
  periodSummary,
  incomeStatement,
}) {
  const m = meta(storeSettings, periodLabel);
  const summary = summaryBlock(periodSummary, incomeStatement);

  const revenueRows = (periodSummary?.revenueHistory || [])
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.date)}</td><td>${escapeHtml(r.tx_count)}</td><td>${escapeHtml(formatRupiah(r.revenue))}</td></tr>`,
    )
    .join("");

  const topProductRows = (periodSummary?.topProducts || [])
    .map(
      (p) =>
        `<tr><td>${escapeHtml(p.name)}</td><td>${escapeHtml(p.category || "-")}</td><td>${escapeHtml(formatQty(p.qty))}</td><td>${escapeHtml(formatRupiah(p.revenue))}</td></tr>`,
    )
    .join("");

  const expenseRows = (periodSummary?.expensesByCategory || [])
    .map(
      (e) =>
        `<tr><td>${escapeHtml(e.category)}</td><td>${escapeHtml(e.entry_count)}</td><td>${escapeHtml(formatRupiah(e.total))}</td></tr>`,
    )
    .join("");

  const html = `
    <html>
    <head>
      <title>Ringkasan Dashboard - ${escapeHtml(m.storeName)}</title>
      <meta charset="utf-8" />
      <style>${dashboardCSS()}</style>
    </head>
    <body>
      <div class="db-header">
        <div class="db-store">${escapeHtml(m.storeName)}</div>
        ${m.storeAddress ? `<div class="db-address">${escapeHtml(m.storeAddress)}</div>` : ""}
        <div class="db-title">Ringkasan Dashboard</div>
        <div class="db-period">Periode: ${escapeHtml(m.periodLabel)}</div>
      </div>
      <hr class="db-divider" />
      <div class="db-summary">${summary.map((s) => `<div>${escapeHtml(s.label)}<b>${escapeHtml(s.value)}</b></div>`).join("")}</div>

      <div class="db-section-title">Pendapatan Harian</div>
      <table class="db-table">
        <thead><tr><th>Tanggal</th><th>Transaksi</th><th>Pendapatan</th></tr></thead>
        <tbody>${revenueRows || '<tr><td colspan="3">Tidak ada data</td></tr>'}</tbody>
      </table>

      <div class="db-section-title">Produk Terlaris</div>
      <table class="db-table">
        <thead><tr><th>Produk</th><th>Kategori</th><th>Qty</th><th>Pendapatan</th></tr></thead>
        <tbody>${topProductRows || '<tr><td colspan="4">Tidak ada data</td></tr>'}</tbody>
      </table>

      <div class="db-section-title">Beban per Kategori</div>
      <table class="db-table">
        <thead><tr><th>Kategori</th><th>Jumlah Entri</th><th>Total</th></tr></thead>
        <tbody>${expenseRows || '<tr><td colspan="3">Tidak ada data</td></tr>'}</tbody>
      </table>

      <div class="db-footer">
        <span>Dicetak: ${escapeHtml(m.printedAt)}</span>
        <span>Sistem POS</span>
      </div>
      <script>window.onload = () => { window.print(); }<\/script>
    </body>
    </html>
  `;
  const win = window.open("", "_blank", "width=1000,height=750");
  if (!win) return false;
  win.document.write(html);
  win.document.close();
  return true;
}

/**
 * Ekspor ringkasan Dashboard (periode terfilter) ke .xlsx — 4 sheet:
 * Ringkasan, Pendapatan Harian, Produk Terlaris, Beban per Kategori.
 */
export async function exportDashboardExcel({
  storeSettings,
  periodLabel,
  periodSummary,
  incomeStatement,
}) {
  const XLSX = await import("xlsx");
  const m = meta(storeSettings, periodLabel);
  const summary = summaryBlock(periodSummary, incomeStatement);

  const wb = XLSX.utils.book_new();

  const summarySheet = [
    [m.storeName],
    m.storeAddress ? [m.storeAddress] : [],
    ["Ringkasan Dashboard"],
    [`Periode: ${m.periodLabel}`],
    [],
    ...summary.map((s) => [s.label, s.value]),
    [],
    [`Dicetak: ${m.printedAt}`],
  ];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(summarySheet),
    "Ringkasan",
  );

  const revenueSheet = [
    ["Tanggal", "Jumlah Transaksi", "Pendapatan"],
    ...(periodSummary?.revenueHistory || []).map((r) => [
      r.date,
      r.tx_count,
      r.revenue,
    ]),
  ];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(revenueSheet),
    "Pendapatan Harian",
  );

  const productSheet = [
    ["Produk", "Kategori", "Qty Terjual", "Pendapatan"],
    ...(periodSummary?.topProducts || []).map((p) => [
      p.name,
      p.category || "-",
      Number(p.qty) || 0,
      p.revenue,
    ]),
  ];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(productSheet),
    "Produk Terlaris",
  );

  const expenseSheet = [
    ["Kategori", "Jumlah Entri", "Total"],
    ...(periodSummary?.expensesByCategory || []).map((e) => [
      e.category,
      e.entry_count,
      e.total,
    ]),
  ];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(expenseSheet),
    "Beban per Kategori",
  );

  const filename = `Dashboard_${m.periodLabel.replace(/\s+/g, "_")}.xlsx`;
  XLSX.writeFile(wb, filename);
}
