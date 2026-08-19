// src/features/transactions/components/TransactionDetailModal.jsx
import { X, Printer, Ban } from "lucide-react";
import { Badge } from "../../../components/UI";
import { formatRupiah, formatDateTime, formatSaleItemLabel } from "../../../utils/format";

export default function TransactionDetailModal({ transaction, isAdmin, onClose, onOpenVoidModal, onPrintReceipt }) {
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">Detail Transaksi</h2>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="statement-row"><span>Kode</span><span className="font-mono">{transaction.transaction_code}</span></div>
          <div className="statement-row"><span>Waktu</span><span>{formatDateTime(transaction.created_at)}</span></div>
          <div className="statement-row"><span>Kasir</span><span>{transaction.cashier_name}</span></div>
          <div className="statement-row"><span>Pelanggan</span><span>{transaction.customer_name || "Umum"}</span></div>
          <div className="divider" />
          {transaction.items?.map((item) => (
            <div key={item.id} className="statement-row">
              <span>{formatSaleItemLabel(item)}</span>
              <span className="statement-value">{formatRupiah(item.subtotal)}</span>
            </div>
          ))}
          <div className="divider" />
          <div className="statement-row"><span>Subtotal</span><span className="statement-value">{formatRupiah(transaction.total_amount)}</span></div>
          <div className="statement-row"><span>Diskon</span><span className="statement-value">-{formatRupiah(transaction.discount_amount)}</span></div>
          <div className="statement-row statement-row--total"><span>Total</span><span className="statement-value">{formatRupiah(transaction.final_amount)}</span></div>
          <div className="statement-row"><span>Dibayar</span><span className="statement-value">{formatRupiah(transaction.payment_amount)}</span></div>
          <div className="statement-row"><span>Kembalian</span><span className="statement-value">{formatRupiah(transaction.change_amount)}</span></div>
          {transaction.status === "cancelled" && (
            <>
              <div className="divider" />
              <div className="statement-row"><span>Status</span><Badge variant="red">Dibatalkan</Badge></div>
              {transaction.void_reason && (
                <div className="statement-row"><span>Alasan</span><span>{transaction.void_reason}</span></div>
              )}
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Tutup</button>
          {transaction.status === "completed" && (
            transaction.pending_void_request_id ? (
              <Badge variant="orange">Menunggu Persetujuan Admin</Badge>
            ) : (
              <button className="btn btn-danger" onClick={() => onOpenVoidModal(transaction)}>
                <Ban size={14} /> {isAdmin ? "Batalkan" : "Ajukan Pembatalan"}
              </button>
            )
          )}
          <button className="btn btn-primary" onClick={() => onPrintReceipt(transaction)}>
            <Printer size={14} /> Cetak Struk
          </button>
        </div>
      </div>
    </div>
  );
}
