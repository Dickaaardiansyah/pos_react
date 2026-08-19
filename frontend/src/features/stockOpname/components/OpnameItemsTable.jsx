// src/features/stockOpname/components/OpnameItemsTable.jsx
import { Trash2 } from "lucide-react";
import { EmptyState } from "../../../components/UI";
import { formatRupiah, formatQty } from "../../../utils/format";

export default function OpnameItemsTable({ items, onUpdateItem, onRemoveItem }) {
  if (items.length === 0) {
    return <EmptyState title="Belum ada produk dipilih" description="Tambahkan produk dari daftar di atas" />;
  }

  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th>Produk</th><th>SKU</th><th>Stok Sistem</th><th style={{ minWidth: 110 }}>Stok Fisik</th>
            <th>Selisih</th><th>Nilai Selisih</th><th style={{ minWidth: 160 }}>Keterangan</th><th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.product_id}>
              <td>{item.product_name}</td>
              <td className="font-mono text-xs">{item.barcode}</td>
              <td className="font-mono">{formatQty(item.system_stock)} {item.unit}</td>
              <td>
                <input
                  type="number" step="0.001" min="0" className="form-input" style={{ width: 90 }}
                  value={item.physical_stock}
                  onChange={(e) => onUpdateItem(item.product_id, "physical_stock", e.target.value)}
                />
              </td>
              <td className={`font-mono ${item.difference > 0 ? "text-positive" : item.difference < 0 ? "text-negative" : ""}`}>
                {item.difference > 0 ? "+" : ""}{formatQty(item.difference)}
              </td>
              <td className={`font-mono ${item.difference_value > 0 ? "text-positive" : item.difference_value < 0 ? "text-negative" : ""}`}>
                {formatRupiah(item.difference_value)}
              </td>
              <td>
                <input
                  className="form-input" style={{ minWidth: 150 }}
                  value={item.notes} placeholder="Opsional"
                  onChange={(e) => onUpdateItem(item.product_id, "notes", e.target.value)}
                />
              </td>
              <td><button className="btn btn-ghost btn-icon btn-sm" onClick={() => onRemoveItem(item.product_id)}><Trash2 size={14} /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
