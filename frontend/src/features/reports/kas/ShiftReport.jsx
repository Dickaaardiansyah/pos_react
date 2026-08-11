// src/features/reports/kas/ShiftReport.jsx
// ─────────────────────────────────────────────────────────────────────────────
// VIEW LAYER — Laporan Shift Kasir (modul Kas).
// Rekap setiap sesi kas yang sudah ditutup: jam buka/tutup, kas awal,
// penjualan cash, pengeluaran, seharusnya vs aktual, selisih.
// Sumber: cash-register/history (shift yang status = closed).
// ─────────────────────────────────────────────────────────────────────────────
import { Clock, Wallet, TrendingUp, TrendingDown, AlertTriangle, Users } from "lucide-react";
import { StatCard, EmptyState, Badge } from "../../../components/UI";
import { formatRupiah, formatDate, formatDateTime } from "../../../utils/format";

function timeOnly(dateStr) {
  if (!dateStr) return "-";
  const m = String(dateStr).match(/(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : "-";
}

export function ShiftReportContent({ r }) {
  const list = r.shiftReport?.data || [];
  const summary = r.shiftReport?.summary || {};

  return (
    <>
      <div className="stats-grid">
        <StatCard icon={Users} tone="blue" label="Total Shift" value={summary.total_shifts || list.length || 0} />
        <StatCard icon={Wallet} tone="cyan" label="Total Kas Awal" value={formatRupiah(summary.total_opening || 0)} />
        <StatCard icon={TrendingUp} tone="green" label="Total Penjualan Cash" value={formatRupiah(summary.total_cash_sales || 0)} />
        <StatCard icon={TrendingDown} tone="orange" label="Total Pengeluaran" value={formatRupiah(summary.total_cash_out || 0)} />
        <StatCard
          icon={AlertTriangle}
          tone={(summary.total_difference || 0) < 0 ? "orange" : "purple"}
          label="Total Selisih"
          value={formatRupiah(summary.total_difference || 0)}
        />
      </div>

      <div className="card">
        <div className="chart-card__title">Detail Shift Kasir</div>
        {list.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="Belum ada shift yang ditutup"
            description="Coba pilih rentang tanggal lain"
          />
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Kode Shift</th>
                  <th>Kasir</th>
                  <th>Jam Buka</th>
                  <th>Jam Tutup</th>
                  <th>Kas Awal</th>
                  <th>Penjualan Cash</th>
                  <th>Kas Masuk</th>
                  <th>Pengeluaran</th>
                  <th>Seharusnya</th>
                  <th>Kas Aktual</th>
                  <th>Selisih</th>
                </tr>
              </thead>
              <tbody>
                {list.map((s) => {
                  const expected =
                    s.closing_balance_system != null
                      ? Number(s.closing_balance_system)
                      : Number(s.opening_balance || 0) +
                        Number(s.total_cash_sales || 0) +
                        Number(s.total_cash_in || 0) -
                        Number(s.total_cash_out || 0);
                  const physical = Number(s.closing_balance_physical ?? 0);
                  const diff = s.difference != null ? Number(s.difference) : physical - expected;
                  return (
                    <tr key={s.id}>
                      <td className="font-mono text-sm">{s.shift_code}</td>
                      <td>{s.opened_by_name || s.cashier_name || s.opened_by || "-"}</td>
                      <td className="text-sm">
                        {formatDateTime(s.opened_at)?.slice(0, 16) || timeOnly(s.opened_at)}
                      </td>
                      <td className="text-sm">
                        {s.closed_at
                          ? formatDateTime(s.closed_at)?.slice(0, 16) || timeOnly(s.closed_at)
                          : "-"}
                      </td>
                      <td className="font-mono">{formatRupiah(s.opening_balance || 0)}</td>
                      <td className="font-mono text-success">{formatRupiah(s.total_cash_sales || 0)}</td>
                      <td className="font-mono">{formatRupiah(s.total_cash_in || 0)}</td>
                      <td className="font-mono text-danger">{formatRupiah(s.total_cash_out || 0)}</td>
                      <td className="font-mono">{formatRupiah(expected)}</td>
                      <td className="font-mono">{formatRupiah(physical)}</td>
                      <td>
                        <Badge variant={diff < 0 ? "red" : diff > 0 ? "green" : "blue"}>
                          {formatRupiah(diff)}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

export function buildShiftReportExportPayload(r) {
  const list = r.shiftReport?.data || [];
  const summary = r.shiftReport?.summary || {};
  const rows = list.map((s) => {
    const expected =
      s.closing_balance_system != null
        ? Number(s.closing_balance_system)
        : Number(s.opening_balance || 0) +
          Number(s.total_cash_sales || 0) +
          Number(s.total_cash_in || 0) -
          Number(s.total_cash_out || 0);
    const physical = Number(s.closing_balance_physical ?? 0);
    const diff = s.difference != null ? Number(s.difference) : physical - expected;
    return {
      shift_code: s.shift_code,
      kasir: s.opened_by_name || s.cashier_name || s.opened_by || "-",
      jam_buka: formatDateTime(s.opened_at)?.slice(0, 16) || timeOnly(s.opened_at),
      jam_tutup: s.closed_at ? formatDateTime(s.closed_at)?.slice(0, 16) || timeOnly(s.closed_at) : "-",
      kas_awal: formatRupiah(s.opening_balance || 0),
      penjualan_cash: formatRupiah(s.total_cash_sales || 0),
      kas_masuk: formatRupiah(s.total_cash_in || 0),
      pengeluaran: formatRupiah(s.total_cash_out || 0),
      seharusnya: formatRupiah(expected),
      kas_aktual: formatRupiah(physical),
      selisih: formatRupiah(diff),
    };
  });
  return {
    title: "Laporan Shift Kasir",
    periodLabel: `${formatDate(r.startDate)} – ${formatDate(r.endDate)}`,
    columns: [
      { key: "shift_code", label: "Kode Shift" },
      { key: "kasir", label: "Kasir" },
      { key: "jam_buka", label: "Jam Buka" },
      { key: "jam_tutup", label: "Jam Tutup" },
      { key: "kas_awal", label: "Kas Awal" },
      { key: "penjualan_cash", label: "Penjualan Cash" },
      { key: "kas_masuk", label: "Kas Masuk" },
      { key: "pengeluaran", label: "Pengeluaran" },
      { key: "seharusnya", label: "Seharusnya" },
      { key: "kas_aktual", label: "Kas Aktual" },
      { key: "selisih", label: "Selisih" },
    ],
    rows,
    summary: [
      { label: "Total Shift", value: summary.total_shifts || list.length || 0 },
      { label: "Total Kas Awal", value: formatRupiah(summary.total_opening || 0) },
      { label: "Total Penjualan Cash", value: formatRupiah(summary.total_cash_sales || 0) },
      { label: "Total Pengeluaran", value: formatRupiah(summary.total_cash_out || 0) },
      { label: "Total Selisih", value: formatRupiah(summary.total_difference || 0) },
    ],
  };
}