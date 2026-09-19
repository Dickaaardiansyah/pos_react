// src/features/cashier/components/PaymentModal.jsx
import { useState } from "react";
import { X, UserPlus } from "lucide-react";
import { RupiahInput, SearchFilterSelect } from "../../../components/UI";
import { formatRupiah } from "../../../utils/format";
import { PAYMENT_METHODS } from "../hooks";
import CustomerFormModal from "../../customers/components/CustomerFormModal";

export default function PaymentModal({
  total, paymentMethod, onSelectMethod,
  paymentAmount, setPaymentAmount, quickAmounts, onSelectQuickAmount, change,
  customers, selectedCustomerId, onSelectCustomer,
  customerName, setCustomerName, dueDate, setDueDate,
  loadingPayment, onConfirm, onClose,
}) {
  const isOpenBill = paymentMethod === "open_bill";
  const [showNewCustomer, setShowNewCustomer] = useState(false);

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">Pembayaran</h2>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="statement-row statement-row--total mb-3">
            <span>Total Tagihan</span><span className="statement-value">{formatRupiah(total)}</span>
          </div>

          <div className="form-group">
            <label className="form-label">Metode Pembayaran</label>
            <div className="flex gap-2">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.id}
                  className={`btn btn-sm ${paymentMethod === m.id ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => onSelectMethod(m.id)}
                >{m.label}</button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">
              {isOpenBill ? "Jumlah DP (boleh Rp0)" : "Jumlah Dibayar"}
            </label>

            {paymentMethod === "cash" && quickAmounts.length > 0 && (
              <div className="quick-amount-row">
                {quickAmounts.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    className={`quick-amount-chip ${String(paymentAmount) === String(amount) ? "quick-amount-chip--active" : ""}`}
                    onClick={() => onSelectQuickAmount(amount)}
                  >
                    {amount === total ? "Uang Pas" : formatRupiah(amount)}
                  </button>
                ))}
              </div>
            )}

            <RupiahInput
              value={paymentAmount}
              onChange={(v) => setPaymentAmount(v === "" ? "" : String(v))}
            />
          </div>

          {paymentMethod === "cash" && paymentAmount && (
            <div className="statement-row">
              <span>Kembalian</span>
              <span className="statement-value">{formatRupiah(Math.max(change, 0))}</span>
            </div>
          )}

          {isOpenBill && (
            <div className="statement-row">
              <span>Sisa Piutang</span>
              <span className="statement-value">
                {formatRupiah(Math.max(total - (parseFloat(paymentAmount) || 0), 0))}
              </span>
            </div>
          )}

          {isOpenBill ? (
            <>
              <div className="form-group">
                <label className="form-label">Pelanggan Terdaftar *</label>
                <div className="flex gap-2 items-center">
                  <div style={{ flex: 1 }}>
                    <SearchFilterSelect
                      options={customers}
                      value={selectedCustomerId}
                      onChange={onSelectCustomer}
                      placeholder="Cari pelanggan terdaftar..."
                      emptyText="Pelanggan tidak ditemukan"
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon"
                    title="Daftarkan pelanggan baru"
                    onClick={() => setShowNewCustomer(true)}
                  >
                    <UserPlus size={16} />
                  </button>
                </div>
                {}
                {!selectedCustomerId && (
                  <p className="text-sm text-muted mt-1" style={{ margin: "4px 0 0" }}>
                    Belum ada di daftar? Klik <UserPlus size={12} style={{ verticalAlign: "-1px" }} /> untuk mendaftarkan pelanggan baru dulu.
                  </p>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Jatuh Tempo *</label>
                <input
                  type="date" className="form-input" value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </>
          ) : (
            <div className="form-group">
              <label className="form-label">Nama Pelanggan (opsional)</label>
              <input className="form-input" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Batal</button>
          <button
            className="btn btn-success"
            onClick={onConfirm}
            disabled={loadingPayment || (isOpenBill && !selectedCustomerId)}
          >
            {loadingPayment ? "Memproses..." : "Konfirmasi Bayar"}
          </button>
        </div>
      </div>

      {showNewCustomer && (
        <CustomerFormModal
          onSuccess={() => {}}
          onClose={() => setShowNewCustomer(false)}
        />
      )}
    </div>
  );
}