// src/features/cashRegister/components/CashMovementsTable.jsx
// ─────────────────────────────────────────────────────────────────────────────
// PRESENTATION — Tabel riwayat pergerakan kas manual (masuk/keluar) untuk
// sesi kas yang sedang berjalan.
// ─────────────────────────────────────────────────────────────────────────────
import { Wallet, Trash2 } from "lucide-react";
import { EmptyState, Badge } from "../../../components/UI";
import { formatRupiah, formatDateTime } from "../../../utils/format";

export default function CashMovementsTable({ movements, onDelete }) {
  return (
    <div className="card">
      <div className="chart-card__title">Riwayat Pergerakan Kas Sesi Ini</div>
      {movements.length === 0 ? (
        <EmptyState icon={Wallet} title="Belum ada pergerakan kas" description="Catat pengeluaran/pemasukan kas tunai lewat tombol di atas" />
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr><th>Waktu</th><th>Jenis</th><th>Kategori</th><th>Jumlah</th><th>Keterangan</th><th>Oleh</th><th></th></tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id}>
                  <td className="text-sm">{formatDateTime(m.created_at)}</td>
                  <td>{m.type === "in" ? <Badge variant="green">Kas Masuk</Badge> : <Badge variant="red">Kas Keluar</Badge>}</td>
                  <td className="text-sm">{m.category}</td>
                  <td className={`font-mono font-bold ${m.type === "in" ? "text-positive" : "text-negative"}`}>
                    {m.type === "in" ? "+" : "-"}{formatRupiah(m.amount)}
                  </td>
                  <td className="text-sm">{m.description || "-"}</td>
                  <td className="text-sm">{m.created_by}</td>
                  <td><button className="btn btn-ghost btn-icon btn-sm" onClick={() => onDelete(m.id)}><Trash2 size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}