// src/features/cashier/components/CartList.jsx
import { ShoppingCart, Trash2, X } from "lucide-react";
import CartItemRow from "./CartItemRow";

export default function CartList({ cart, onClearCart, onCloseMobileCart, onChangeQty, onSetQtyExact, onRemove }) {
  return (
    <>
      <div className="page-header" style={{ padding: "18px 16px 12px" }}>
        <div className="flex items-center gap-2">
          <ShoppingCart size={18} />
          <span className="font-bold">Keranjang ({cart.length})</span>
        </div>
        <div className="flex items-center gap-2">
          {cart.length > 0 && (
            <button className="btn btn-ghost btn-icon btn-sm" onClick={onClearCart}><Trash2 size={14} /></button>
          )}
          <button
            className="btn btn-ghost btn-icon btn-sm cart-close-btn"
            onClick={onCloseMobileCart}
            aria-label="Tutup keranjang"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {cart.length === 0 ? (
        <div className="cart-empty">
          <ShoppingCart size={40} style={{ opacity: 0.2 }} />
          <span className="text-sm">Keranjang masih kosong</span>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: "auto" }}>
          {cart.map((item) => (
            <CartItemRow
              key={item.lineKey}
              item={item}
              onChangeQty={onChangeQty}
              onSetQtyExact={onSetQtyExact}
              onRemove={onRemove}
            />
          ))}
        </div>
      )}
    </>
  );
}
