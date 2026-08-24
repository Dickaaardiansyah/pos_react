// src/features/cashRegister/components/CashShiftDetailModal.jsx
// ─────────────────────────────────────────────────────────────────────────────
// PRESENTATION — Detail satu sesi kas yang sudah ditutup: ringkasan saldo,
// selisih, & seluruh pergerakan kas selama sesi tersebut berlangsung.
// ─────────────────────────────────────────────────────────────────────────────
import { X } from "lucide-react";
import { Badge } from "../../../components/UI";
import { formatRupiah, formatDateTime } from "../../../utils/format";

export default function CashShiftDetailModal({ shift, onClose }) {
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal--large">
        <div className="modal-header">
          <h2 className="modal-title">Detail Sesi Kas — {shift.shift_code}</h2>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="statement-row"><span>Dibuka</span><span>{formatDateTime(shift.opened_at)} oleh {shift.opened_by}</span></div>
          <div className="statement-row"><span>Ditutup</span><span>{formatDateTime(shift.closed_at)} oleh {shift.closed_by}</span></div>
          <div className="statement-row"><span>Modal Awal</span><span className="statement-value">{formatRupiah(shift.opening_balance)}</span></div>
          <div className="statement-row"><span>Total Penjualan Tunai</span><span className="statement-value">{formatRupiah(shift.total_cash_sales)}</span></div>
          <div className="statement-row"><span>Total Kas Masuk</span><span className="statement-value text-positive">+{formatRupiah(shift.total_cash_in)}</span></div>
          <div className="statement-row"><span>Total Kas Keluar</span><span className="statement-value text-negative">-{formatRupiah(shift.total_cash_out)}</span></div>
          {/* FIX (revisi dosen #17): snapshot 5 kategori yang sebelumnya
              tidak pernah tersimpan sama sekali — sekarang ikut ditampilkan
              di riwayat tutup kas, dibaca dari kolom snapshot cash_shifts
              (bukan dihitung ulang, supaya histori tidak berubah walau data
              sumbernya sudah berubah setelah shift ditutup). */}
          {Number(shift.total_cash_receivable) > 0 && (
            <div className="statement-row"><span>Pembayaran Piutang Tunai</span><span className="statement-value text-positive">+{formatRupiah(shift.total_cash_receivable)}</span></div>
          )}
          {Number(shift.total_cash_capital_in) > 0 && (
            <div className="statement-row"><span>Setoran Modal Tunai</span><span className="statement-value text-positive">+{formatRupiah(shift.total_cash_capital_in)}</span></div>
          )}
          {Number(shift.total_cash_payable) > 0 && (
            <div className="statement-row"><span>Pembayaran Hutang Tunai</span><span className="statement-value text-negative">-{formatRupiah(shift.total_cash_payable)}</span></div>
          )}
          {Number(shift.total_cash_purchase) > 0 && (
            <div className="statement-row"><span>Pembelian Tunai</span><span className="statement-value text-negative">-{formatRupiah(shift.total_cash_purchase)}</span></div>
          )}
          {Number(shift.total_cash_capital_out) > 0 && (
            <div className="statement-row"><span>Prive (Penarikan Modal) Tunai</span><span className="statement-value text-negative">-{formatRupiah(shift.total_cash_capital_out)}</span></div>
          )}
          {Number(shift.total_cash_expense) > 0 && (
            <div className="statement-row"><span>Biaya Operasional</span><span className="statement-value text-negative">-{formatRupiah(shift.total_cash_expense)}</span></div>
          )}
          <div className="statement-row statement-row--total"><span>Saldo Sistem</span><span className="statement-value">{formatRupiah(shift.closing_balance_system)}</span></div>
          <div className="statement-row"><span>Kas Fisik</span><span className="statement-value">{formatRupiah(shift.closing_balance_physical)}</span></div>
          <div className={`statement-row ${Number(shift.difference) === 0 ? "" : Number(shift.difference) > 0 ? "statement-row--positive" : "statement-row--negative"}`}>
            <span>Selisih</span><span className="statement-value">{Number(shift.difference) > 0 ? "+" : ""}{formatRupiah(shift.difference)}</span>
          </div>
          {shift.closing_notes && <div className="statement-row"><span>Catatan Tutup Kas</span><span>{shift.closing_notes}</span></div>}
          <div className="divider" />
          <div className="chart-card__title">Pergerakan Kas Selama Sesi</div>
          {shift.movements?.length === 0 ? (
            <div className="text-sm text-muted">Tidak ada pergerakan kas selain penjualan tunai pada sesi ini</div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr><th>Waktu</th><th>Jenis</th><th>Kategori</th><th>Jumlah</th><th>Keterangan</th><th>Oleh</th></tr>
                </thead>
                <tbody>
                  {shift.movements?.map((m) => (
                    <tr key={m.id}>
                      <td className="text-sm">{formatDateTime(m.created_at)}</td>
                      <td>{m.type === "in" ? <Badge variant="green">Kas Masuk</Badge> : <Badge variant="red">Kas Keluar</Badge>}</td>
                      <td className="text-sm">{m.category}</td>
                      <td className={`font-mono font-bold ${m.type === "in" ? "text-positive" : "text-negative"}`}>
                        {m.type === "in" ? "+" : "-"}{formatRupiah(m.amount)}
                      </td>
                      <td className="text-sm">{m.description || "-"}</td>
                      <td className="text-sm">{m.created_by}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Tutup</button>
        </div>
      </div>
    </div>
  );
}