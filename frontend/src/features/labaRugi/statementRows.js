// src/features/labaRugi/statementRows.js
// ─────────────────────────────────────────────────────────────────────────────
// Baris ringkasan generik untuk laporan multi-kolom (Multi Year/Kuartal/Multi
// Periode) & laporan Perbandingan Periode — dipakai bersama supaya struktur
// baris di kedua jenis laporan itu tetap konsisten.
// ─────────────────────────────────────────────────────────────────────────────
import { formatRupiah } from "../../utils/format";

export const SUMMARY_ROWS = [
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
  { type: "label", label: "Pendapatan Non Operasional" },
  {
    type: "value",
    label: "Jumlah Pendapatan Non Operasional",
    key: "non_operational_revenue",
    indent: true,
  },
  { type: "label", label: "Beban Non Operasional" },
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

export function fmtSigned(v) {
  const n = Number(v || 0);
  return n < 0 ? `(${formatRupiah(Math.abs(n))})` : formatRupiah(n);
}
