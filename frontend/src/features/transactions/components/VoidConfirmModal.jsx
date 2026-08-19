// src/features/transactions/components/VoidConfirmModal.jsx
import { X } from "lucide-react";
import { formatRupiah } from "../../../utils/format";

export default function VoidConfirmModal({ target, reason, onReasonChange, loading, isAdmin, onClose, onConfirm }) {
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal--small">
        <div className="modal-header">
          <h2 className="modal-title">{isAdmin ? "Batalkan Transaksi" : "Ajukan Pembatalan Transaksi"}</h2>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} disabled={loading}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <p className="ui-confirm-dialog__message">
            {isAdmin ? (
              <>
                Transaksi <strong className="font-mono">{target.transaction_code}</strong> senilai{" "}
                <strong>{formatRupiah(target.final_amount)}</strong> akan dibatalkan. Stok akan
                dikembalikan otomatis, jurnal koreksi akan diposting, dan piutang Open Bill terkait
                (jika ada) akan ikut dibatalkan. Tindakan ini tidak dapat dibatalkan kembali.
              </>
            ) : (
              <>
                Pengajuan pembatalan untuk transaksi{" "}
                <strong className="font-mono">{target.transaction_code}</strong> senilai{" "}
                <strong>{formatRupiah(target.final_amount)}</strong> akan dikirim ke admin untuk
                disetujui. Transaksi baru benar-benar dibatalkan (stok dikembalikan, jurnal dibalik)
                setelah admin menyetujui pengajuan ini.
              </>
            )}
          </p>
          <div className="form-group">
            <label className="form-label">Alasan Pembatalan *</label>
            <textarea
              className="form-input"
              rows={3}
              placeholder="mis. salah input jumlah, pelanggan batal beli, salah scan produk..."
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              disabled={loading}
              autoFocus
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={loading}>Batal</button>
          <button className="btn btn-danger" onClick={onConfirm} disabled={loading || !reason.trim()}>
            {loading ? "Memproses..." : isAdmin ? "Ya, Batalkan Transaksi" : "Kirim Pengajuan"}
          </button>
        </div>
      </div>
    </div>
  );
}
