// src/features/reports/kas/CashReport.jsx
// ─────────────────────────────────────────────────────────────────────────────
// VIEW LAYER — Laporan Kas Masuk & Kas Keluar (modul Kas). Rekap lintas shift
// dalam suatu rentang tanggal. Dipisah ke file sendiri (modul Kas), konsisten
// dengan Laporan Penjualan Harian yang dipisah ke modul Penjualan.
//
// Kas Masuk digabung dari 3 sumber (lihat cashRegisterService.report di
// backend): modal awal tiap sesi kas, rekap penjualan tunai harian, dan
// pencatatan kas masuk manual (setoran modal, pengembalian, dsb). Kas Keluar
// murni dari pencatatan kas keluar manual per shift.
// ─────────────────────────────────────────────────────────────────────────────
import { ArrowDownCircle, ArrowUpCircle, Wallet, TrendingUp, TrendingDown } from "lucide-react";
import { StatCard, EmptyState, Badge } from "../../../components/UI";
import { formatRupiah, formatDate, formatDateTime } from "../../../utils/format";

function kategoriBadgeVariant(kategori) {
  if (kategori === "Kas Awal") return "blue";
  if (kategori === "Penjualan Cash") return "green";
  return "cyan";
}

export function CashReportContent({ r }) {
  const rep = r.kasReport;
  if (!rep) return null;
  const s = rep.summary || {};
  const cashIn = rep.cashIn || [];
  const cashOut = rep.cashOut || [];

  return (
    <>
      <div className="stats-grid">
        <StatCard icon={Wallet} tone="blue" label="Total Kas Awal" value={formatRupiah(s.total_kas_awal || 0)} />
        <StatCard icon={TrendingUp} tone="green" label="Penjualan Cash" value={formatRupiah(s.total_penjualan_cash || 0)} />
        <StatCard icon={ArrowUpCircle} tone="cyan" label="Kas Masuk Lainnya" value={formatRupiah(s.total_kas_masuk_lain || 0)} />
        <StatCard icon={ArrowUpCircle} tone="green" label="Total Kas Masuk" value={formatRupiah(s.total_kas_masuk || 0)} />
        <StatCard icon={ArrowDownCircle} tone="orange" label="Total Kas Keluar" value={formatRupiah(s.total_kas_keluar || 0)} />
        <StatCard icon={TrendingDown} tone={s.selisih < 0 ? "orange" : "purple"} label="Selisih (Masuk - Keluar)" value={formatRupiah(s.selisih || 0)} />
      </div>

      <div className="card mb-4">
        <div className="chart-card__title">Kas Masuk</div>
        {cashIn.length === 0 ? (
          <EmptyState icon={ArrowUpCircle} title="Belum ada kas masuk" description="Coba pilih rentang tanggal lain" />
        ) : (
          <div className="table-container">
            <table>
              <thead><tr><th>Waktu</th><th>Keterangan</th><th>Kategori</th><th>Nominal</th><th>User</th></tr></thead>
              <tbody>
                {cashIn.map((m, i) => (
                  <tr key={i}>
                    <td className="text-sm">{formatDateTime(m.waktu)}</td>
                    <td>{m.keterangan}</td>
                    <td><Badge variant={kategoriBadgeVariant(m.kategori)}>{m.kategori}</Badge></td>
                    <td className="font-mono text-success">{formatRupiah(m.nominal)}</td>
                    <td>{m.user}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <div className="chart-card__title">Kas Keluar</div>
        {cashOut.length === 0 ? (
          <EmptyState icon={ArrowDownCircle} title="Belum ada kas keluar" description="Coba pilih rentang tanggal lain" />
        ) : (
          <div className="table-container">
            <table>
              <thead><tr><th>Waktu</th><th>Keterangan</th><th>Kategori</th><th>Nominal</th><th>User</th></tr></thead>
              <tbody>
                {cashOut.map((m, i) => (
                  <tr key={i}>
                    <td className="text-sm">{formatDateTime(m.waktu)}</td>
                    <td>{m.keterangan}</td>
                    <td><Badge variant="orange">{m.kategori}</Badge></td>
                    <td className="font-mono text-danger">{formatRupiah(m.nominal)}</td>
                    <td>{m.user}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

// ── Payload cetak / ekspor Excel — dipakai dari ReportsPage.jsx ────────────
export function buildCashReportExportPayload(r) {
  const rep = r.kasReport;
  if (!rep) return {};
  const s = rep.summary || {};
  const columns = [
    { key: "arah", label: "Arah" }, { key: "waktu", label: "Waktu" }, { key: "keterangan", label: "Keterangan" },
    { key: "kategori", label: "Kategori" }, { key: "nominal", label: "Nominal" }, { key: "user", label: "User" },
  ];
  const rows = [
    ...(rep.cashIn || []).map((m) => ({
      arah: "Masuk", waktu: formatDateTime(m.waktu), keterangan: m.keterangan,
      kategori: m.kategori, nominal: formatRupiah(m.nominal), user: m.user,
    })),
    ...(rep.cashOut || []).map((m) => ({
      arah: "Keluar", waktu: formatDateTime(m.waktu), keterangan: m.keterangan,
      kategori: m.kategori, nominal: formatRupiah(m.nominal), user: m.user,
    })),
  ];
  return {
    title: "Laporan Kas Masuk & Keluar",
    periodLabel: `${formatDate(r.startDate)} – ${formatDate(r.endDate)}`,
    columns,
    rows,
    summary: [
      { label: "Total Kas Awal", value: formatRupiah(s.total_kas_awal || 0) },
      { label: "Penjualan Cash", value: formatRupiah(s.total_penjualan_cash || 0) },
      { label: "Kas Masuk Lainnya", value: formatRupiah(s.total_kas_masuk_lain || 0) },
      { label: "Total Kas Masuk", value: formatRupiah(s.total_kas_masuk || 0) },
      { label: "Total Kas Keluar", value: formatRupiah(s.total_kas_keluar || 0) },
      { label: "Selisih (Masuk - Keluar)", value: formatRupiah(s.selisih || 0) },
    ],
  };
}