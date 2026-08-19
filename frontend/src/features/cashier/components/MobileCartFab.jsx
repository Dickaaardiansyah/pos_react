// src/features/cashier/components/MobileCartFab.jsx
import { ShoppingCart } from "lucide-react";
import { formatRupiah } from "../../../utils/format";

export default function MobileCartFab({ visible, cartTotalQty, total, onShow, onHideBackdrop, showMobileCart }) {
  return (
    <>
      <div
        className={`cart-drawer-backdrop ${showMobileCart ? "cart-drawer-backdrop--open" : ""}`}
        onClick={onHideBackdrop}
      />
      {visible && (
        <button className="cart-fab" onClick={onShow}>
          <span className="cart-fab__left">
            <ShoppingCart size={18} />
            <span className="cart-fab__badge">{cartTotalQty}</span>
            Lihat Keranjang
          </span>
          <span className="cart-fab__total">{formatRupiah(total)}</span>
        </button>
      )}
    </>
  );
}
