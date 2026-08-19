// src/features/purchase/components/PurchaseDetailModal.jsx
import { X, FileText } from "lucide-react";
import { Badge } from "../../../components/UI";
import { formatRupiah, formatDate, formatQty } from "../../../utils/format";

const PAYABLE_STATUS_BADGE = { belum_lunas: "red", sebagian: "orange", lunas: "green" };
const PAYABLE_STATUS_LABEL = { belum_lunas: "Belum Lunas", sebagian: "Sebagian", lunas: "Lunas" };

export default function PurchaseDetailModal({ purchase, onClose, onViewNota }) {
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">Detail Pembelian</h2>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="statement-row"><span>Kode</span><span className="font-mono">{purchase.purchase_code}</span></div>
          <div className="statement-row"><span>Tanggal</span><span>{formatDate(purchase.purchase_date)}</span></div>
          <div className="statement-row"><span>Supplier</span><span>{purchase.supplier_name || purchase.supplier_name_ref || "-"}</span></div>
          <div className="statement-row">
            <span>Cara Bayar</span>
            <span>
              <Badge variant={purchase.payment_method === "kredit" ? "orange" : "green"}>
                {purchase.payment_method === "kredit" ? "Kredit" : "Tunai"}
              </Badge>
            </span>
          </div>
          {purchase.payment_method === "kredit" && (
            <>
              <div className="statement-row"><span>Jatuh Tempo</span><span>{formatDate(purchase.due_date)}</span></div>
              <div className="statement-row">
                <span>Status Hutang</span>
                <span>
                  {purchase.payable_status ? (
                    <Badge variant={PAYABLE_STATUS_BADGE[purchase.payable_status]}>{PAYABLE_STATUS_LABEL[purchase.payable_status]}</Badge>
                  ) : "-"}
                </span>
              </div>
            </>
          )}
          {purchase.nota_url && (
            <div className="statement-row">
              <span>Nota Supplier</span>
              <button type="button" className="purchase-nota-preview btn-link" onClick={() => onViewNota(purchase.nota_url)}>
                <FileText size={14} /> Lihat file
              </button>
            </div>
          )}
          <div className="divider" />
          {purchase.items?.map((item) => (
            <div key={item.id} className="statement-row">
              <span>{item.product_name} x{formatQty(item.quantity)}</span>
              <span className="statement-value">{formatRupiah(item.subtotal_cost)}</span>
            </div>
          ))}
          <div className="divider" />
          <div className="statement-row statement-row--total"><span>Total Biaya</span><span className="statement-value">{formatRupiah(purchase.total_cost)}</span></div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Tutup</button>
        </div>
      </div>
    </div>
  );
}
