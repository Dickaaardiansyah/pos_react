// src/features/products/components/ProductTable.jsx
import { Pencil, Trash2, Barcode as BarcodeIcon, Tags } from "lucide-react";
import { Badge } from "../../../components/UI";
import { formatRupiah, formatQty } from "../../../utils/format";

export default function ProductTable({ products, onPrintLabel, onAdjustStock, onEdit, onDelete }) {
  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th>Barcode</th><th>Nama</th><th>Kategori</th><th>Harga Jual</th><th>Harga Modal</th><th>Stok</th><th></th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id} className={Number(product.stock) <= Number(product.min_stock) ? "low-stock-row" : ""}>
              <td className="font-mono text-xs">{product.barcode}</td>
              <td className="font-bold">{product.name}</td>
              <td>{product.category_name || "-"}</td>
              <td className="font-mono">{formatRupiah(product.price)}</td>
              <td className="font-mono text-muted">{formatRupiah(product.cost_price)}</td>
              <td>
                {formatQty(product.stock)} {product.unit}
                {Number(product.stock) <= Number(product.min_stock) && <Badge variant="orange">Menipis</Badge>}
              </td>
              <td>
                <div className="flex gap-2">
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => onPrintLabel(product)} title="Cetak label"><Tags size={14} /></button>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => onAdjustStock(product)} title="Sesuaikan stok"><BarcodeIcon size={14} /></button>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => onEdit(product)}><Pencil size={14} /></button>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => onDelete(product)}><Trash2 size={14} /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
