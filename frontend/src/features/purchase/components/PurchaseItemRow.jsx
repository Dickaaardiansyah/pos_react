// src/features/purchase/components/PurchaseItemRow.jsx
import { Trash2 } from "lucide-react";
import { RupiahInput } from "../../../components/UI";
import { formatQty } from "../../../utils/format";

export default function PurchaseItemRow({ item, conversion, baseQty, onUpdateItem, onUpdatePurchaseUnit, onRemoveItem }) {
  const hasPackaging = item.additional_units?.length > 0;
  const purchaseUnitLabel = item.purchase_unit_id
    ? item.additional_units.find((u) => String(u.id) === String(item.purchase_unit_id))?.unit_name
    : item.base_unit;

  return (
    <div className="purchase-item-row">
      <div style={{ flex: 1, width: "100%" }}>
        <div className="cart-item-name">{item.product_name}</div>
        <div className="purchase-item-fields">
          {hasPackaging && (
            <div className="purchase-item-field">
              <label>Satuan Beli</label>
              <select
                className="form-select"
                value={item.purchase_unit_id}
                onChange={(e) => onUpdatePurchaseUnit(item.product_id, e.target.value)}
              >
                <option value="">{item.base_unit} (satuan dasar)</option>
                {item.additional_units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.unit_name} (1 = {u.conversion_qty} {item.base_unit})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="purchase-item-field">
            <label>Qty {hasPackaging ? `(${purchaseUnitLabel})` : ""}</label>
            <input
              type="number" step="0.001" min="0" className="form-input"
              value={item.purchase_qty}
              onChange={(e) => onUpdateItem(item.product_id, "purchase_qty", e.target.value)}
            />
          </div>
          <div className="purchase-item-field">
            <label>Harga Modal / {purchaseUnitLabel}</label>
            <RupiahInput value={item.unit_cost} onChange={(v) => onUpdateItem(item.product_id, "unit_cost", v)} />
          </div>
          <div className="purchase-item-field">
            <label>Kadaluarsa</label>
            <input type="date" className="form-input" value={item.expiry_date || ""} onChange={(e) => onUpdateItem(item.product_id, "expiry_date", e.target.value)} />
          </div>
        </div>
        {conversion !== 1 && (
          <div className="text-xs text-muted mt-1">
            = {formatQty(baseQty)} {item.base_unit} ditambahkan ke stok
          </div>
        )}
      </div>
      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => onRemoveItem(item.product_id)}><Trash2 size={14} /></button>
    </div>
  );
}
