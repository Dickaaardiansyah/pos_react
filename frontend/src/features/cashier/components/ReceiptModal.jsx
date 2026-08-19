// src/features/cashier/components/ReceiptModal.jsx
import { CheckCircle2, Printer, X } from "lucide-react";
import { formatRupiah } from "../../../utils/format";

export default function ReceiptModal({ receipt, onClose, onPrint }) {
  const isOpenBill = receipt.payment_method === "open_bill";

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal--small">
        <div className="modal-header">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} style={{ color: "var(--accent-green)" }} />
            <h2 className="modal-title">Transaksi Berhasil</h2>
          </div>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="statement-row"><span>Kode Transaksi</span><span className="font-mono">{receipt.transaction_code}</span></div>
          <div className="statement-row statement-row--total"><span>Total</span><span className="statement-value">{formatRupiah(receipt.final_amount)}</span></div>
          {isOpenBill ? (
            <>
              <div className="statement-row"><span>DP Dibayar</span><span className="statement-value">{formatRupiah(receipt.payment_amount)}</span></div>
              <div className="statement-row"><span>Sisa Piutang</span><span className="statement-value">{formatRupiah(receipt.final_amount - receipt.payment_amount)}</span></div>
              {receipt.receivable && (
                <div className="statement-row"><span>No. Faktur Open Bill</span><span className="font-mono">{receipt.receivable.invoice_code}</span></div>
              )}
            </>
          ) : (
            <div className="statement-row"><span>Kembalian</span><span className="statement-value">{formatRupiah(receipt.change_amount)}</span></div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Tutup</button>
          <button className="btn btn-primary" onClick={() => onPrint(receipt)}>
            <Printer size={14} /> Cetak Struk
          </button>
        </div>
      </div>
    </div>
  );
}
