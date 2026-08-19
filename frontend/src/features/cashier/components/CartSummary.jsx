// src/features/cashier/components/CartSummary.jsx
import { FileClock } from "lucide-react";
import { RupiahInput } from "../../../components/UI";
import { formatRupiah } from "../../../utils/format";

export default function CartSummary({
  discount, setDiscount, subtotal, discountAmount, total,
  cartIsEmpty, onOpenPayment, onOpenBillShortcut,
}) {
  return (
    <div style={{ padding: 16, borderTop: "1px solid var(--border)" }}>
      <div className="form-group">
        <label className="form-label">Diskon (Rp)</label>
        <RupiahInput value={discount || ""} onChange={(v) => setDiscount(v || 0)} />
      </div>
      <div className="statement-row">
        <span>Subtotal</span><span className="statement-value">{formatRupiah(subtotal)}</span>
      </div>
      <div className="statement-row">
        <span>Diskon</span><span className="statement-value">-{formatRupiah(discountAmount)}</span>
      </div>
      <div className="statement-row statement-row--total">
        <span>Total</span><span className="statement-value">{formatRupiah(total)}</span>
      </div>
      <div className="flex gap-2 mt-3">
        <button className="btn btn-primary btn-lg" style={{ flex: 1 }} onClick={onOpenPayment} disabled={cartIsEmpty}>
          Bayar Sekarang
        </button>
        <button
          className="btn btn-ghost btn-lg btn-icon"
          style={{ borderColor: "var(--accent-purple)", color: "var(--accent-purple)" }}
          onClick={onOpenBillShortcut}
          disabled={cartIsEmpty}
          title="Open Bill (bayar nanti / kredit)"
        >
          <FileClock size={18} />
        </button>
      </div>
    </div>
  );
}
