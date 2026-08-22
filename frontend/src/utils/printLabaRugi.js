// src/utils/printLabaRugi.js
// ─────────────────────────────────────────────────────────────────────────────
// Laporan Laba Rugi siap cetak — meniru gaya laporan akuntansi Accurate
// Online: hitam-putih, margin A4, garis pemisah, angka rata kanan, format
// Rupiah, tanpa sidebar/navbar. Menyediakan 3 cara keluaran:
//   1. printLabaRugiReport()  → window.print() langsung dari browser
//   2. exportLabaRugiPDF()    → berkas .pdf (vector, via jsPDF + autoTable)
//   3. exportLabaRugiExcel()  → berkas .xlsx (via SheetJS)
// ─────────────────────────────────────────────────────────────────────────────
import { formatRupiah, formatDate, formatDateTime, escapeHtml } from "./format";

function buildRows(statement) {
  const st = statement;
  const rows = [];
  const push = (label, value, opts = {}) =>
    rows.push({ label, value, ...opts });

  push("PENDAPATAN", null, { section: true });
  push("Penjualan Kotor", st.revenue.gross_sales, { indent: 1 });
  push("Diskon Penjualan", -st.revenue.total_discount, { indent: 1 });
  push("Pendapatan Bersih", st.revenue.net_sales, { subtotal: true });

  push("HARGA POKOK PENJUALAN (HPP)", null, { section: true });
  push(
    `HPP (${st.cost_of_goods_sold.units_sold} unit terjual)`,
    -st.cost_of_goods_sold.total_cogs,
    { indent: 1 },
  );
  push("Laba Kotor", st.gross_profit, { subtotal: true });

  push("BEBAN OPERASIONAL", null, { section: true });
  if (st.operating_expenses.by_category.length === 0) {
    push("Tidak ada catatan biaya", 0, { indent: 1 });
  } else {
    st.operating_expenses.by_category.forEach((e) =>
      push(e.category, -e.total, { indent: 1 }),
    );
  }
  push("Jumlah Beban Operasional", -st.operating_expenses.total, {
    indent: 1,
    italic: true,
  });
  push("Pendapatan Operasional", st.operating_profit, { subtotal: true });

  push("PENDAPATAN DAN BEBAN NON OPERASIONAL", null, { section: true });
  push("Pendapatan Non Operasional", st.non_operational.revenue.total, {
    indent: 1,
  });
  push("Beban Non Operasional", -st.non_operational.expense.total, {
    indent: 1,
  });
  push("Jumlah Pendapatan dan Beban Non Operasional", st.non_operational.net, {
    indent: 0,
    italic: true,
  });
  push("Laba Sebelum Pajak", st.profit_before_tax, { subtotal: true });

  if (st.tax.enabled) {
    push("PAJAK", null, { section: true });
    push(`Pajak Penghasilan (${st.tax.rate_percent}%)`, -st.tax.amount, {
      indent: 1,
    });
  }

  push("LABA BERSIH", st.net_profit, { total: true });
  return rows;
}

// ─── Baris ringkasan generik — dipakai oleh laporan multi-kolom ───────────
// (Multi Year, Kuartal, Multi Periode, Perbandingan Periode) di mana rincian
// per kategori biaya tidak ditampilkan, hanya total tiap bagian.
const SUMMARY_ROW_DEFS = [
  { type: "section", label: "PENDAPATAN" },
  { type: "value", label: "Jumlah Pendapatan", key: "net_sales" },
  { type: "section", label: "BEBAN POKOK PENJUALAN" },
  { type: "value", label: "Jumlah Beban Pokok Penjualan", key: "total_cogs" },
  { type: "subtotal", label: "LABA KOTOR", key: "gross_profit" },
  { type: "section", label: "BEBAN OPERASIONAL" },
  {
    type: "value",
    label: "Jumlah Beban Operasional",
    key: "operating_expenses_total",
  },
  {
    type: "subtotal",
    label: "PENDAPATAN OPERASIONAL",
    key: "operating_profit",
  },
  { type: "section", label: "PENDAPATAN DAN BEBAN NON OPERASIONAL" },
  { type: "label-only", label: "Pendapatan Non Operasional" },
  {
    type: "value",
    label: "Jumlah Pendapatan Non Operasional",
    key: "non_operational_revenue",
    indent: true,
  },
  { type: "label-only", label: "Beban Non Operasional" },
  {
    type: "value",
    label: "Jumlah Beban Non Operasional",
    key: "non_operational_expense",
    indent: true,
  },
  {
    type: "subtotal",
    label: "Jumlah Pendapatan dan Beban Non Operasional",
    key: "non_operational_net",
  },
  { type: "total", label: "LABA BERSIH", key: "net_profit" },
];

function genericReportMeta(storeSettings, title, periodLabel) {
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

function baseReportCSS() {
  return `
    @page { size: A4 landscape; margin: 16mm 14mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #000; background: #fff; margin: 0; padding: 24px; font-size: 12px; }
    .lr-header { text-align: center; margin-bottom: 16px; }
    .lr-store { font-size: 18px; font-weight: 700; }
    .lr-address { font-size: 11px; color: #333; margin-top: 2px; }
    .lr-title { font-size: 16px; font-weight: 700; margin-top: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #9b1c4b; }
    .lr-period { font-size: 12px; margin-top: 2px; }
    .lr-divider { border: none; border-top: 2px solid #000; margin: 12px 0; }
    table.lr-table { width: 100%; border-collapse: collapse; }
    table.lr-table th { padding: 6px 4px; font-size: 11.5px; text-align: right; border-bottom: 2px solid #000; font-weight: 700; }
    table.lr-table th:first-child { text-align: left; }
    table.lr-table td { padding: 5px 4px; font-size: 12px; border-bottom: 1px solid #e2e2e2; }
    table.lr-table td:first-child, table.lr-table th:first-child { text-align: left; }
    .lr-value { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .lr-section td { font-weight: 700; text-transform: uppercase; font-size: 11.5px; letter-spacing: 0.4px; padding-top: 12px; border-bottom: none; }
    .lr-indent td:first-child { padding-left: 18px; }
    .lr-subtotal td { font-weight: 700; border-top: 1px solid #000; border-bottom: 1px solid #000; }
    .lr-total td { font-weight: 800; font-size: 13.5px; border-top: 3px double #000; border-bottom: 3px double #000; padding-top: 7px; padding-bottom: 7px; }
    .lr-footer { margin-top: 24px; display: flex; justify-content: space-between; font-size: 10.5px; color: #444; }
    @media print { .lr-noprint { display: none; } }
  `;
}

function valueCellsHTML(row, columns) {
  return columns
    .map((col) => {
      const v = row.key ? Number(col.summary?.[row.key] || 0) : null;
      if (v === null) return `<td></td>`;
      const str = v < 0 ? `(${formatRupiah(Math.abs(v))})` : formatRupiah(v);
      return `<td class="lr-value">${escapeHtml(str)}</td>`;
    })
    .join("");
}

function rowClass(row) {
  return [
    row.indent ? "lr-indent" : "",
    row.type === "subtotal" ? "lr-subtotal" : "",
    row.type === "total" ? "lr-total" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

// ─── Cetak laporan multi-kolom (Multi Year / Kuartal / Multi Periode) ─────
export function printMultiColumnLabaRugi({
  title,
  periodLabel,
  columns,
  storeSettings,
}) {
  const meta = genericReportMeta(storeSettings, title, periodLabel);

  const headHTML = `<tr><th>Deskripsi</th>${columns.map((c) => `<th>${escapeHtml(c.label)}</th>`).join("")}</tr>`;
  const bodyHTML = SUMMARY_ROW_DEFS.map((row) => {
    if (row.type === "section" || row.type === "label-only") {
      return `<tr class="${row.type === "section" ? "lr-section" : "lr-indent"}"><td${row.type === "section" ? ` colspan="${columns.length + 1}"` : ""}>${escapeHtml(row.label)}</td>${row.type === "section" ? "" : valueCellsHTML({}, columns)}</tr>`;
    }
    return `<tr class="${rowClass(row)}"><td>${escapeHtml(row.label)}</td>${valueCellsHTML(row, columns)}</tr>`;
  }).join("");

  const html = `
    <html>
    <head>
      <title>${escapeHtml(title)} - ${escapeHtml(meta.storeName)}</title>
      <meta charset="utf-8" />
      <style>${baseReportCSS()}</style>
    </head>
    <body>
      <div class="lr-header">
        <div class="lr-store">${escapeHtml(meta.storeName)}</div>
        ${meta.storeAddress ? `<div class="lr-address">${escapeHtml(meta.storeAddress)}</div>` : ""}
        <div class="lr-title">${escapeHtml(title)}</div>
        <div class="lr-period">${escapeHtml(periodLabel)}</div>
      </div>
      <hr class="lr-divider" />
      <table class="lr-table"><thead>${headHTML}</thead><tbody>${bodyHTML}</tbody></table>
      <div class="lr-footer">
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

export async function exportMultiColumnLabaRugiExcel({
  title,
  periodLabel,
  columns,
  storeSettings,
  filename,
}) {
  const XLSX = await import("xlsx");
  const meta = genericReportMeta(storeSettings, title, periodLabel);

  const sheetData = [
    [meta.storeName],
    meta.storeAddress ? [meta.storeAddress] : [],
    [title],
    [periodLabel],
    [],
    ["Deskripsi", ...columns.map((c) => c.label)],
  ];

  SUMMARY_ROW_DEFS.forEach((row) => {
    if (row.type === "section") {
      sheetData.push([row.label]);
    } else if (row.type === "label-only") {
      sheetData.push([`  ${row.label}`]);
    } else {
      const label = row.indent ? `    ${row.label}` : row.label;
      sheetData.push([
        label,
        ...columns.map((c) => Number(c.summary?.[row.key] || 0)),
      ]);
    }
  });

  sheetData.push([]);
  sheetData.push([`Dicetak: ${meta.printedAt}`]);

  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  ws["!cols"] = [{ wch: 42 }, ...columns.map(() => ({ wch: 18 }))];

  const range = XLSX.utils.decode_range(ws["!ref"]);
  for (let R = 6; R <= range.e.r; R++) {
    for (let C = 1; C <= columns.length; C++) {
      const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
      if (cell && typeof cell.v === "number")
        cell.z = '"Rp" #,##0;[RED]("Rp" #,##0)';
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 28));
  XLSX.writeFile(wb, filename || `${title.replace(/[^\w]+/g, "_")}.xlsx`);
}

// ─── Cetak & ekspor laporan Perbandingan Periode (2 kolom + variance) ─────
export function printComparisonLabaRugi({
  period1,
  period2,
  variance,
  storeSettings,
}) {
  const meta = genericReportMeta(
    storeSettings,
    "Laba/Rugi (Perbandingan Periode)",
    `${period1.label}  dan  ${period2.label}`,
  );

  const headHTML = `<tr><th>Deskripsi</th><th>${escapeHtml(period1.label)}</th><th>${escapeHtml(period2.label)}</th><th>Variance</th><th>% Var.</th></tr>`;
  const bodyHTML = SUMMARY_ROW_DEFS.map((row) => {
    if (row.type === "section") {
      return `<tr class="lr-section"><td colspan="5">${escapeHtml(row.label)}</td></tr>`;
    }
    if (row.type === "label-only") {
      return `<tr class="lr-indent"><td>${escapeHtml(row.label)}</td><td></td><td></td><td></td><td></td></tr>`;
    }
    const v1 = Number(period1.summary?.[row.key] || 0);
    const v2 = Number(period2.summary?.[row.key] || 0);
    const varr = variance?.[row.key] || { diff: 0, pct: 0 };
    const fmt = (v) =>
      v < 0 ? `(${formatRupiah(Math.abs(v))})` : formatRupiah(v);
    return `<tr class="${rowClass(row)}"><td>${escapeHtml(row.label)}</td><td class="lr-value">${escapeHtml(fmt(v1))}</td><td class="lr-value">${escapeHtml(fmt(v2))}</td><td class="lr-value">${escapeHtml(fmt(varr.diff))}</td><td class="lr-value">${escapeHtml(varr.pct)}%</td></tr>`;
  }).join("");

  const html = `
    <html>
    <head>
      <title>Laba/Rugi Perbandingan - ${escapeHtml(meta.storeName)}</title>
      <meta charset="utf-8" />
      <style>${baseReportCSS()}</style>
    </head>
    <body>
      <div class="lr-header">
        <div class="lr-store">${escapeHtml(meta.storeName)}</div>
        ${meta.storeAddress ? `<div class="lr-address">${escapeHtml(meta.storeAddress)}</div>` : ""}
        <div class="lr-title">${escapeHtml(meta.title)}</div>
        <div class="lr-period">${escapeHtml(meta.periodLabel)}</div>
      </div>
      <hr class="lr-divider" />
      <table class="lr-table"><thead>${headHTML}</thead><tbody>${bodyHTML}</tbody></table>
      <div class="lr-footer">
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

export async function exportComparisonLabaRugiExcel({
  period1,
  period2,
  variance,
  storeSettings,
}) {
  const XLSX = await import("xlsx");
  const meta = genericReportMeta(
    storeSettings,
    "Laba/Rugi (Perbandingan Periode)",
    `${period1.label} dan ${period2.label}`,
  );

  const sheetData = [
    [meta.storeName],
    meta.storeAddress ? [meta.storeAddress] : [],
    [meta.title],
    [meta.periodLabel],
    [],
    ["Deskripsi", period1.label, period2.label, "Variance", "% Var."],
  ];

  SUMMARY_ROW_DEFS.forEach((row) => {
    if (row.type === "section") {
      sheetData.push([row.label]);
    } else if (row.type === "label-only") {
      sheetData.push([`  ${row.label}`]);
    } else {
      const v1 = Number(period1.summary?.[row.key] || 0);
      const v2 = Number(period2.summary?.[row.key] || 0);
      const varr = variance?.[row.key] || { diff: 0, pct: 0 };
      const label = row.indent ? `    ${row.label}` : row.label;
      sheetData.push([label, v1, v2, varr.diff, `${varr.pct}%`]);
    }
  });

  sheetData.push([]);
  sheetData.push([`Dicetak: ${meta.printedAt}`]);

  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  ws["!cols"] = [
    { wch: 42 },
    { wch: 18 },
    { wch: 18 },
    { wch: 16 },
    { wch: 10 },
  ];

  const range = XLSX.utils.decode_range(ws["!ref"]);
  for (let R = 6; R <= range.e.r; R++) {
    for (const C of [1, 2, 3]) {
      const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
      if (cell && typeof cell.v === "number")
        cell.z = '"Rp" #,##0;[RED]("Rp" #,##0)';
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Perbandingan Periode");
  XLSX.writeFile(wb, `Laba_Rugi_Perbandingan_Periode.xlsx`);
}

function reportMeta(statement, storeSettings) {
  return {
    storeName: storeSettings?.store_name || "Toko Saya",
    storeAddress: storeSettings?.store_address || "",
    period: `${formatDate(statement.period.startDate)} s/d ${formatDate(statement.period.endDate)}`,
    printedAt: formatDateTime(
      new Date().toISOString().slice(0, 19).replace("T", " "),
    ),
  };
}

// ─── 1. Cetak via browser (window.print) ───────────────────────────────────
export function printLabaRugiReport(statement, storeSettings) {
  const meta = reportMeta(statement, storeSettings);
  const rows = buildRows(statement);

  const rowsHTML = rows
    .map((r) => {
      if (r.section) {
        return `<tr><td colspan="2" class="lr-section">${escapeHtml(r.label)}</td></tr>`;
      }
      const cls = [
        r.indent ? "lr-indent" : "",
        r.subtotal ? "lr-subtotal" : "",
        r.total ? "lr-total" : "",
        r.italic ? "lr-italic" : "",
      ]
        .filter(Boolean)
        .join(" ");
      const valueStr =
        r.value < 0
          ? `(${formatRupiah(Math.abs(r.value))})`
          : formatRupiah(r.value);
      return `<tr class="${cls}"><td>${escapeHtml(r.label)}</td><td class="lr-value">${escapeHtml(valueStr)}</td></tr>`;
    })
    .join("");

  const html = `
    <html>
    <head>
      <title>Laporan Laba Rugi - ${escapeHtml(meta.storeName)}</title>
      <meta charset="utf-8" />
      <style>
        @page { size: A4 portrait; margin: 18mm 16mm; }
        * { box-sizing: border-box; }
        body { font-family: Arial, Helvetica, sans-serif; color: #000; background: #fff; margin: 0; padding: 24px; font-size: 12.5px; }
        .lr-header { text-align: center; margin-bottom: 18px; }
        .lr-store { font-size: 18px; font-weight: 700; }
        .lr-address { font-size: 11px; color: #333; margin-top: 2px; }
        .lr-title { font-size: 16px; font-weight: 700; margin-top: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
        .lr-period { font-size: 12px; margin-top: 2px; }
        .lr-divider { border: none; border-top: 2px solid #000; margin: 14px 0; }
        table.lr-table { width: 100%; border-collapse: collapse; }
        table.lr-table td { padding: 5px 4px; font-size: 12.5px; border-bottom: 1px solid #e2e2e2; }
        table.lr-table td:first-child { text-align: left; }
        .lr-value { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
        .lr-section td { font-weight: 700; text-transform: uppercase; font-size: 11.5px; letter-spacing: 0.4px; padding-top: 14px; border-bottom: none; }
        .lr-indent td:first-child { padding-left: 18px; }
        .lr-subtotal td { font-weight: 700; border-top: 1px solid #000; border-bottom: 1px solid #000; }
        .lr-italic td { font-style: italic; color: #333; }
        .lr-total td { font-weight: 800; font-size: 14px; border-top: 3px double #000; border-bottom: 3px double #000; padding-top: 8px; padding-bottom: 8px; }
        .lr-footer { margin-top: 28px; display: flex; justify-content: space-between; font-size: 10.5px; color: #444; }
        @media print {
          .lr-noprint { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="lr-header">
        <div class="lr-store">${escapeHtml(meta.storeName)}</div>
        ${meta.storeAddress ? `<div class="lr-address">${escapeHtml(meta.storeAddress)}</div>` : ""}
        <div class="lr-title">Laporan Laba Rugi</div>
        <div class="lr-period">Periode: ${escapeHtml(meta.period)}</div>
      </div>
      <hr class="lr-divider" />
      <table class="lr-table">${rowsHTML}</table>
      <div class="lr-footer">
        <span>Dicetak: ${escapeHtml(meta.printedAt)}</span>
        <span>Sistem POS</span>
      </div>
      <script>window.onload = () => { window.print(); }<\/script>
    </body>
    </html>
  `;

  const win = window.open("", "_blank", "width=850,height=1000");
  if (!win) return false;
  win.document.write(html);
  win.document.close();
  return true;
}

// ─── 2. Export PDF (vector, via jsPDF + autoTable) ─────────────────────────
export async function exportLabaRugiPDF(statement, storeSettings) {
  const [{ default: jsPDF }] = await Promise.all([import("jspdf")]);
  await import("jspdf-autotable");

  const meta = reportMeta(statement, storeSettings);
  const rows = buildRows(statement);
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(meta.storeName, pageWidth / 2, 18, { align: "center" });

  if (meta.storeAddress) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.text(meta.storeAddress, pageWidth / 2, 24, { align: "center" });
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("LAPORAN LABA RUGI", pageWidth / 2, meta.storeAddress ? 32 : 28, {
    align: "center",
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    `Periode: ${meta.period}`,
    pageWidth / 2,
    meta.storeAddress ? 38 : 34,
    { align: "center" },
  );

  // Sisipkan baris judul section sebagai baris penuh (colSpan) di posisi yang benar
  const bodyWithSections = [];
  let sectionRowIndexes = [];
  let idx = 0;
  rows.forEach((r) => {
    if (r.section) {
      bodyWithSections.push([r.label, ""]);
      sectionRowIndexes.push(idx);
    } else {
      const valueStr =
        r.value < 0
          ? `(${formatRupiah(Math.abs(r.value))})`
          : formatRupiah(r.value);
      bodyWithSections.push([r.indent ? `    ${r.label}` : r.label, valueStr]);
    }
    idx++;
  });

  const boldRowIndexes = [];
  const totalRowIndexes = [];
  rows.forEach((r, i) => {
    if (r.subtotal) boldRowIndexes.push(i);
    if (r.total) totalRowIndexes.push(i);
  });

  doc.autoTable({
    startY: meta.storeAddress ? 45 : 40,
    head: [],
    body: bodyWithSections,
    theme: "plain",
    styles: {
      font: "helvetica",
      fontSize: 10,
      textColor: 20,
      cellPadding: { top: 1.6, bottom: 1.6, left: 1, right: 1 },
    },
    columnStyles: {
      0: { cellWidth: 130 },
      1: { halign: "right", cellWidth: 45 },
    },
    didParseCell: (data) => {
      const rowIdx = data.row.index;
      if (sectionRowIndexes.includes(rowIdx)) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fontSize = 9;
      }
      if (boldRowIndexes.includes(rowIdx) || totalRowIndexes.includes(rowIdx)) {
        data.cell.styles.fontStyle = "bold";
      }
      if (totalRowIndexes.includes(rowIdx)) {
        data.cell.styles.fontSize = 11.5;
      }
    },
    didDrawCell: (data) => {
      const rowIdx = data.row.index;
      if (boldRowIndexes.includes(rowIdx) || totalRowIndexes.includes(rowIdx)) {
        const lineWidth = totalRowIndexes.includes(rowIdx) ? 0.5 : 0.2;
        doc.setLineWidth(lineWidth);
        doc.line(
          data.cell.x,
          data.cell.y,
          data.cell.x + data.cell.width,
          data.cell.y,
        );
      }
    },
  });

  const finalY = doc.lastAutoTable.finalY || 60;
  doc.setFontSize(8.5);
  doc.setTextColor(90);
  doc.text(`Dicetak: ${meta.printedAt}`, 14, finalY + 10);

  doc.save(
    `Laporan_Laba_Rugi_${statement.period.startDate}_sd_${statement.period.endDate}.pdf`,
  );
}

// ─── 3. Export Excel (.xlsx via SheetJS) ───────────────────────────────────
export async function exportLabaRugiExcel(statement, storeSettings) {
  const XLSX = await import("xlsx");
  const meta = reportMeta(statement, storeSettings);
  const rows = buildRows(statement);

  const sheetData = [
    [meta.storeName],
    meta.storeAddress ? [meta.storeAddress] : [],
    ["LAPORAN LABA RUGI"],
    [`Periode: ${meta.period}`],
    [],
  ].filter((r) => r.length > 0 || true);

  rows.forEach((r) => {
    if (r.section) {
      sheetData.push([r.label, null]);
    } else {
      const label = r.indent ? `    ${r.label}` : r.label;
      sheetData.push([label, r.value]);
    }
  });

  sheetData.push([]);
  sheetData.push([`Dicetak: ${meta.printedAt}`]);

  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  ws["!cols"] = [{ wch: 42 }, { wch: 20 }];

  // Format kolom nilai (kolom B) sebagai angka Rupiah rata kanan
  const range = XLSX.utils.decode_range(ws["!ref"]);
  for (let R = range.s.r; R <= range.e.r; R++) {
    const cellRef = XLSX.utils.encode_cell({ r: R, c: 1 });
    const cell = ws[cellRef];
    if (cell && typeof cell.v === "number") {
      cell.z = '"Rp" #,##0;[RED]("Rp" #,##0)';
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Laba Rugi");
  XLSX.writeFile(
    wb,
    `Laporan_Laba_Rugi_${statement.period.startDate}_sd_${statement.period.endDate}.xlsx`,
  );
}
