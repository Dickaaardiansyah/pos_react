// src/features/stockOpname/components/StockOpnameDetailModal.jsx
import { X } from "lucide-react";
import { formatRupiah, formatDate, formatQty } from "../../../utils/format";

export default function StockOpnameDetailModal({ session, onClose }) {
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal--large">
        <div className="modal-header">
          <h2 className="modal-title">Detail Stock Opname — {session.opname_code}</h2>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="statement-row"><span>Tanggal</span><span>{formatDate(session.opname_date)}</span></div>
          <div className="statement-row"><span>Petugas</span><span>{session.recorded_by || "-"}</span></div>
          {session.notes && <div className="statement-row"><span>Catatan</span><span>{session.notes}</span></div>}
          <div className="divider" />
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Produk</th><th>SKU</th><th>Stok Sistem</th><th>Stok Fisik</th>
                  <th>Selisih</th><th>Nilai Selisih</th><th>Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {session.items?.map((item) => (
                  <tr key={item.id}>
                    <td>{item.product_name}</td>
                    <td className="font-mono text-xs">{item.product_barcode}</td>
                    <td className="font-mono">{formatQty(item.system_stock)} {item.unit}</td>
                    <td className="font-mono">{formatQty(item.physical_stock)} {item.unit}</td>
                    <td className={`font-mono ${item.difference > 0 ? "text-positive" : item.difference < 0 ? "text-negative" : ""}`}>
                      {item.difference > 0 ? "+" : ""}{formatQty(item.difference)}
                    </td>
                    <td className={`font-mono ${item.difference_value > 0 ? "text-positive" : item.difference_value < 0 ? "text-negative" : ""}`}>
                      {formatRupiah(item.difference_value)}
                    </td>
                    <td className="text-sm">{item.notes || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Tutup</button>
        </div>
      </div>
    </div>
  );
}
