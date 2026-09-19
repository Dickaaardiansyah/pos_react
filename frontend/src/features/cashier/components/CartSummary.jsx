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
// src/features/cashier/components/CartSummary.jsx
import { FileClock, ShieldAlert } from "lucide-react";
import { RupiahInput } from "../../../components/UI";
import { formatRupiah } from "../../../utils/format";

export default function CartSummary({
  discount, setDiscount, subtotal, discountAmount, total,
  discountPct, discountNeedsApproval,
  discountReason, setDiscountReason,
  discountAdminUsername, setDiscountAdminUsername,
  discountAdminPassword, setDiscountAdminPassword,
  cartIsEmpty, onOpenPayment, onOpenBillShortcut,
}) {
  const approvalIncomplete =
    discountNeedsApproval &&
    (!discountReason?.trim() || !discountAdminUsername?.trim() || !discountAdminPassword?.trim());

  return (
    <div style={{ padding: 16, borderTop: "1px solid var(--border)" }}>
      <div className="form-group">
        <label className="form-label">Diskon (Rp)</label>
        <RupiahInput value={discount || ""} onChange={(v) => setDiscount(v || 0)} />
      </div>

      {discountNeedsApproval && (
        <div
          className="form-group"
          style={{
            border: "1px solid var(--accent-orange, #f59e0b)",
            borderRadius: 8,
            padding: 12,
            marginBottom: 12,
            background: "rgba(245, 158, 11, 0.08)",
          }}
        >
          <div className="flex items-center gap-2 mb-2" style={{ color: "var(--accent-orange, #f59e0b)" }}>
            <ShieldAlert size={16} />
            <span className="text-sm" style={{ fontWeight: 600 }}>
              Diskon {discountPct.toFixed(1)}% dari subtotal — di atas 10% wajib alasan &amp; approval admin
            </span>
          </div>
          <div className="form-group">
            <label className="form-label">Alasan Diskon *</label>
            <input
              className="form-input"
              value={discountReason}
              onChange={(e) => setDiscountReason(e.target.value)}
              placeholder="Mis. barang rusak kemasan, promo khusus, dsb."
            />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Username Admin *</label>
              <input
                className="form-input"
                autoComplete="off"
                value={discountAdminUsername}
                onChange={(e) => setDiscountAdminUsername(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password Admin *</label>
              <input
                className="form-input"
                type="password"
                autoComplete="off"
                value={discountAdminPassword}
                onChange={(e) => setDiscountAdminPassword(e.target.value)}
              />
            </div>
          </div>
          <p className="text-sm text-muted" style={{ margin: 0 }}>
            Minta admin yang bertugas memasukkan kredensialnya sendiri di sini untuk menyetujui diskon ini.
          </p>
        </div>
      )}

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
        <button
          className="btn btn-primary btn-lg"
          style={{ flex: 1 }}
          onClick={onOpenPayment}
          disabled={cartIsEmpty || approvalIncomplete}
          title={approvalIncomplete ? "Lengkapi alasan & kredensial admin untuk diskon ini dulu" : undefined}
        >
          Bayar Sekarang
        </button>
        <button
          className="btn btn-ghost btn-lg btn-icon"
          style={{ borderColor: "var(--accent-purple)", color: "var(--accent-purple)" }}
          onClick={onOpenBillShortcut}
          disabled={cartIsEmpty || approvalIncomplete}
          title="Open Bill (bayar nanti / kredit)"
        >
          <FileClock size={18} />
        </button>
      </div>
    </div>
  );
}