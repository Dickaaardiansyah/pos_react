// src/features/cashRegister/components/CashHistoryTable.jsx
// ─────────────────────────────────────────────────────────────────────────────
// PRESENTATION — Tabel riwayat sesi kas yang sudah ditutup (dipakai admin di
// tab "Riwayat Tutup Kas") beserta paginasinya.
// ─────────────────────────────────────────────────────────────────────────────
import { Wallet, Eye } from "lucide-react";
import { PageLoader, EmptyState, Pagination, Badge } from "../../../components/UI";
import { formatRupiah, formatDateTime } from "../../../utils/format";

export default function CashHistoryTable({ loading, history, page, total, onPageChange, onViewDetail }) {
  if (loading) return <PageLoader />;
  if (history.length === 0) {
    return <EmptyState icon={Wallet} title="Belum ada riwayat tutup kas" description="Riwayat akan muncul setelah kamu menutup sesi kas" />;
  }
  return (
    <>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Kode</th><th>Dibuka</th><th>Ditutup</th><th>Modal Awal</th>
              <th>Saldo Sistem</th><th>Kas Fisik</th><th>Selisih</th><th>Oleh</th><th></th>
            </tr>
          </thead>
          <tbody>
            {history.map((s) => (
              <tr key={s.id}>
                <td className="font-mono text-xs">{s.shift_code}</td>
                <td className="text-sm">{formatDateTime(s.opened_at)}</td>
                <td className="text-sm">{formatDateTime(s.closed_at)}</td>
                <td className="font-mono">{formatRupiah(s.opening_balance)}</td>
                <td className="font-mono">{formatRupiah(s.closing_balance_system)}</td>
                <td className="font-mono">{formatRupiah(s.closing_balance_physical)}</td>
                <td>
                  {Number(s.difference) === 0
                    ? <Badge variant="green">Sesuai</Badge>
                    : <Badge variant={Number(s.difference) > 0 ? "blue" : "red"}>{Number(s.difference) > 0 ? "+" : ""}{formatRupiah(s.difference)}</Badge>}
                </td>
                <td className="text-sm">{s.closed_by || "-"}</td>
                <td><button className="btn btn-ghost btn-icon btn-sm" onClick={() => onViewDetail(s.id)}><Eye size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} totalPages={Math.max(1, Math.ceil(total / 20))} total={total} limit={20} onPageChange={onPageChange} />
    </>
  );
}