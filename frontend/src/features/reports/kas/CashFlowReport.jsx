// src/features/reports/kas/CashFlowReport.jsx
// ─────────────────────────────────────────────────────────────────────────────
// VIEW LAYER — Laporan Cash Flow / Arus Kas (modul Kas).
// Saldo awal + kas masuk − kas keluar = saldo akhir, dipecah per aktivitas
// (operasi, investasi, pendanaan) dari journalService.cashFlowReport.
// ─────────────────────────────────────────────────────────────────────────────
import { Wallet, TrendingUp, TrendingDown, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { StatCard, EmptyState, Badge } from "../../../components/UI";
import { formatRupiah, formatDate } from "../../../utils/format";

export function CashFlowContent({ r }) {
  const rep = r.cashFlowReport;
  if (!rep) return null;

  const sections = ["operasi", "investasi", "pendanaan"];
  const hasItems = sections.some((k) => (rep.activities?.[k]?.items || []).length > 0);

  return (
    <>
      <div className="stats-grid">
        <StatCard icon={Wallet} tone="blue" label="Saldo Awal" value={formatRupiah(rep.openingBalance || 0)} />
        <StatCard icon={ArrowUpCircle} tone="green" label="Total Kas Masuk (Net +)" value={formatRupiah(Math.max(0, rep.netCashFlow || 0))} />
        <StatCard icon={ArrowDownCircle} tone="orange" label="Total Kas Keluar (Net −)" value={formatRupiah(Math.max(0, -(rep.netCashFlow || 0)))} />
        <StatCard
          icon={TrendingUp}
          tone={(rep.netCashFlow || 0) >= 0 ? "green" : "orange"}
          label="Net Cash Flow"
          value={formatRupiah(rep.netCashFlow || 0)}
        />
        <StatCard icon={Wallet} tone="purple" label="Saldo Akhir" value={formatRupiah(rep.closingBalance || 0)} />
      </div>

      <div className="card mb-4">
        <div className="chart-card__title">Ringkasan Arus Kas</div>
        <div className="table-container">
          <table>
            <tbody>
              <tr>
                <td>Saldo Awal</td>
                <td className="font-mono text-right">{formatRupiah(rep.openingBalance || 0)}</td>
              </tr>
              <tr>
                <td>Kas Masuk − Kas Keluar (Net)</td>
                <td className={`font-mono text-right ${(rep.netCashFlow || 0) >= 0 ? "text-success" : "text-danger"}`}>
                  {formatRupiah(rep.netCashFlow || 0)}
                </td>
              </tr>
              <tr style={{ borderTop: "2px solid var(--border)" }}>
                <td><strong>Saldo Akhir</strong></td>
                <td className="font-mono text-right"><strong>{formatRupiah(rep.closingBalance || 0)}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-muted text-sm mt-2">
          Periode: {formatDate(rep.startDate)} s/d {formatDate(rep.endDate)}
        </p>
      </div>

      {!hasItems ? (
        <EmptyState
          icon={Wallet}
          title="Belum ada pergerakan kas pada periode ini"
          description="Coba pilih rentang tanggal lain"
        />
      ) : (
        sections.map((key) => {
          const sec = rep.activities?.[key];
          if (!sec || (sec.items || []).length === 0) return null;
          return (
            <div className="card mb-4" key={key}>
              <div className="flex items-center justify-between mb-3">
                <div className="chart-card__title" style={{ marginBottom: 0 }}>
                  {sec.label || key}
                </div>
                <Badge variant={sec.net >= 0 ? "green" : "orange"}>
                  Net {formatRupiah(sec.net || 0)}
                </Badge>
              </div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Keterangan</th>
                      <th>Masuk</th>
                      <th>Keluar</th>
                      <th>Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sec.items.map((item, i) => (
                      <tr key={i}>
                        <td>{item.label || item.reference_type}</td>
                        <td className="font-mono text-success">{formatRupiah(item.inflow || 0)}</td>
                        <td className="font-mono text-danger">{formatRupiah(item.outflow || 0)}</td>
                        <td className={`font-mono ${(item.net || 0) >= 0 ? "text-success" : "text-danger"}`}>
                          {formatRupiah(item.net || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })
      )}
    </>
  );
}

export function buildCashFlowExportPayload(r) {
  const rep = r.cashFlowReport;
  if (!rep) return null;
  const rows = [];
  ["operasi", "investasi", "pendanaan"].forEach((key) => {
    const sec = rep.activities?.[key];
    if (!sec) return;
    (sec.items || []).forEach((item) => {
      rows.push({
        Aktivitas: sec.label || key,
        Keterangan: item.label || item.reference_type,
        Masuk: item.inflow || 0,
        Keluar: item.outflow || 0,
        Net: item.net || 0,
      });
    });
  });
  return {
    title: "Laporan Cash Flow (Arus Kas)",
    subtitle: `${rep.startDate} s/d ${rep.endDate}`,
    columns: ["Aktivitas", "Keterangan", "Masuk", "Keluar", "Net"],
    rows,
    summary: {
      openingBalance: rep.openingBalance,
      netCashFlow: rep.netCashFlow,
      closingBalance: rep.closingBalance,
    },
  };
}
