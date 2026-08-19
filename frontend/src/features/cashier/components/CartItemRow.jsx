// src/features/cashier/components/CartItemRow.jsx
import { Minus, Plus, X } from "lucide-react";
import { formatRupiah, formatQty } from "../../../utils/format";
import { cartLineBaseQty } from "../utils/cashierHelper";

export default function CartItemRow({ item, onChangeQty, onSetQtyExact, onRemove }) {
  const { qtyBase, showBaseHint } = cartLineBaseQty(item);

  return (
    <div className="cart-item">
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="cart-item-name">
          {item.name}
          {item.optionLabel ? <span className="cart-item-option"> ({item.optionLabel})</span> : null}
        </div>
        <div className="cart-item-price">
          {formatRupiah(item.price)} × {formatQty(item.qty)} {item.unitLabel || item.unit}
        </div>
        {showBaseHint && (
          <div className="text-xs text-muted">≈ {formatQty(qtyBase)} {item.unit}</div>
        )}
        {item.priceType === "wholesale" ? (
          <div className="cart-item-wholesale-badge cart-item-wholesale-badge--active">
            Grosir aktif
          </div>
        ) : Number(item.price_wholesale) > 0 ? (
          <div className="cart-item-wholesale-badge">
            Grosir otomatis mulai {item.min_qty_wholesale} {item.unitLabel || item.unit}
          </div>
        ) : null}
      </div>
      <button className="cart-qty-btn" onClick={() => onChangeQty(item.lineKey, -1)}><Minus size={12} /></button>
      <input
        className="cart-qty-input"
        type="number"
        min="0.001"
        step="any"
        value={item.qty}
        onChange={(e) => onSetQtyExact(item.lineKey, e.target.value)}
        title="Jumlah (boleh desimal)"
      />
      <button className="cart-qty-btn" onClick={() => onChangeQty(item.lineKey, 1)}><Plus size={12} /></button>
      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => onRemove(item.lineKey)}><X size={14} /></button>
    </div>
  );
}
