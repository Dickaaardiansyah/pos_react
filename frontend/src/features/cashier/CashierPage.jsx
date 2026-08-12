// src/features/cashier/CashierPage.jsx
import { useState } from "react";
import { Search, ScanBarcode, Trash2, Plus, Minus, ShoppingCart, Printer, X, CheckCircle2, FileClock } from "lucide-react";
import { useCashier, PAYMENT_METHODS } from "./hooks";
import { useShift } from "../../context/ShiftContext";
import { useAuth } from "../../context/AuthContext";
import { SearchInput, EmptyState, PageLoader, RupiahInput, SearchFilterSelect } from "../../components/UI";
import { OpenShiftModal } from "../../components/ShiftModals";
import NoShiftScreen from "../../components/NoShiftScreen";
import ProductOptionsModal from "../../components/ProductOptionsModal";
import { formatRupiah, formatQty } from "../../utils/format";

export default function Cashier() {
  const { shift, loading: shiftLoading, opening, openShift } = useShift();
  const { isAdmin } = useAuth();
  const [showOpenShift, setShowOpenShift] = useState(false);

  // Kasir wajib mulai shift (isi modal awal) dulu sebelum bisa jualan — supaya
  // saldo kas & rekonsiliasi akhir hari selalu punya titik awal yang jelas.
  // Admin tidak diberi tombol ini sama sekali (lihat NoShiftScreen) karena
  // buka/tutup kas memang dibatasi khusus akun kasir di backend
  // (authorize("cashier") pada routes/cashRegister.routes.js).
  if (shiftLoading) return <PageLoader text="Memeriksa status shift..." />;
  if (!shift) {
    return (
      <>
        <NoShiftScreen isAdmin={isAdmin} onStart={() => setShowOpenShift(true)} />
        {showOpenShift && (
          <OpenShiftModal opening={opening} onSubmit={openShift} onClose={() => setShowOpenShift(false)} />
        )}
      </>
    );
  }

  return <CashierPOS />;
}

function CashierPOS() {
  const p = useCashier();
  const [showMobileCart, setShowMobileCart] = useState(false);

  const cartTotalQty = p.cart.reduce((sum, item) => sum + Number(item.qty), 0);

  return (
    <div className="pos-layout">
      {/* ── Kolom produk ─────────────────────────────────────────────── */}
      <div className="pos-products">
        <form onSubmit={p.submitBarcode} className="mb-4">
          <div className="flex items-center gap-2">
            <ScanBarcode size={20} className="text-muted" />
            <input
              ref={p.barcodeInputRef}
              className="barcode-input"
              value={p.barcode}
              onChange={(e) => p.setBarcode(e.target.value)}
              placeholder="Scan atau ketik barcode produk..."
              autoFocus
            />
          </div>
        </form>

        <div className="filter-bar">
          <SearchInput value={p.searchTerm} onChange={p.setSearchTerm} placeholder="Cari nama produk..." className="w-full" />
          <select className="form-select" value={p.selectedCategory} onChange={(e) => p.setSelectedCategory(e.target.value)}>
            <option value="">Semua Kategori</option>
            {p.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {p.filteredProducts.length === 0 ? (
          <EmptyState icon={Search} title="Produk tidak ditemukan" description="Coba kata kunci atau kategori lain" />
        ) : (
          <div className="product-grid">
            {p.filteredProducts.map((product) => (
              <div
                key={product.id}
                className={`product-card ${Number(product.stock) <= 0 ? "out-of-stock" : ""}`}
                onClick={() => p.handleProductPick(product)}
              >
                <div className="product-category">{product.category_name || "Lainnya"}</div>
                <div className="product-name">{product.name}</div>
                <div className="product-price">{formatRupiah(product.price)}</div>
                {Number(product.price_wholesale) > 0 && (
                  <div className="product-price-wholesale">
                    Grosir: {formatRupiah(product.price_wholesale)} (beli ≥ {product.min_qty_wholesale} {product.unit})
                  </div>
                )}
                <div className="product-stock">Stok: {formatQty(product.stock)} {product.unit}{(product.selection_type === "unit" || (product.additional_units && product.additional_units.length > 0)) ? " · multi satuan" : ""}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Keranjang ────────────────────────────────────────────────── */}
      <div className={`pos-cart ${showMobileCart ? "pos-cart--open" : ""}`}>
        <div className="page-header" style={{ padding: "18px 16px 12px" }}>
          <div className="flex items-center gap-2">
            <ShoppingCart size={18} />
            <span className="font-bold">Keranjang ({p.cart.length})</span>
          </div>
          <div className="flex items-center gap-2">
            {p.cart.length > 0 && (
              <button className="btn btn-ghost btn-icon btn-sm" onClick={p.clearCart}><Trash2 size={14} /></button>
            )}
            <button
              className="btn btn-ghost btn-icon btn-sm cart-close-btn"
              onClick={() => setShowMobileCart(false)}
              aria-label="Tutup keranjang"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {p.cart.length === 0 ? (
          <div className="cart-empty">
            <ShoppingCart size={40} style={{ opacity: 0.2 }} />
            <span className="text-sm">Keranjang masih kosong</span>
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: "auto" }}>
            {p.cart.map((item) => {
              const factor = Number(item.option?.conversionQty) || 1;
              const qtyBase = Math.round(Number(item.qty) * factor * 1000) / 1000;
              const showBaseHint = factor !== 1;
              return (
              <div key={item.lineKey} className="cart-item">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="cart-item-name">
                    {item.name}
                    {item.optionLabel ? (
                      <span className="cart-item-option"> ({item.optionLabel})</span>
                    ) : null}
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
                <button className="cart-qty-btn" onClick={() => p.changeQty(item.lineKey, -1)}><Minus size={12} /></button>
                <input
                  className="cart-qty-input"
                  type="number"
                  min="0.001"
                  step="any"
                  value={item.qty}
                  onChange={(e) => p.setQtyExact(item.lineKey, e.target.value)}
                  title="Jumlah (boleh desimal)"
                />
                <button className="cart-qty-btn" onClick={() => p.changeQty(item.lineKey, 1)}><Plus size={12} /></button>
                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => p.removeFromCart(item.lineKey)}><X size={14} /></button>
              </div>
              );
            })}
          </div>
        )}

        <div style={{ padding: 16, borderTop: "1px solid var(--border)" }}>
          <div className="form-group">
            <label className="form-label">Diskon (Rp)</label>
            <RupiahInput
              value={p.discount || ""}
              onChange={(v) => p.setDiscount(v || 0)}
            />
          </div>
          <div className="statement-row">
            <span>Subtotal</span><span className="statement-value">{formatRupiah(p.subtotal)}</span>
          </div>
          <div className="statement-row">
            <span>Diskon</span><span className="statement-value">-{formatRupiah(p.discountAmount)}</span>
          </div>
          <div className="statement-row statement-row--total">
            <span>Total</span><span className="statement-value">{formatRupiah(p.total)}</span>
          </div>
          <div className="flex gap-2 mt-3">
            <button className="btn btn-primary btn-lg" style={{ flex: 1 }} onClick={p.openPaymentModal} disabled={p.cart.length === 0}>
              Bayar Sekarang
            </button>
            <button
              className="btn btn-ghost btn-lg btn-icon"
              style={{ borderColor: "var(--accent-purple)", color: "var(--accent-purple)" }}
              onClick={p.openBillShortcut}
              disabled={p.cart.length === 0}
              title="Open Bill (bayar nanti / kredit)"
            >
              <FileClock size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Backdrop + tombol keranjang mengambang (mobile) ─────────────── */}
      <div
        className={`cart-drawer-backdrop ${showMobileCart ? "cart-drawer-backdrop--open" : ""}`}
        onClick={() => setShowMobileCart(false)}
      />
      {!showMobileCart && (
        <button className="cart-fab" onClick={() => setShowMobileCart(true)}>
          <span className="cart-fab__left">
            <ShoppingCart size={18} />
            <span className="cart-fab__badge">{cartTotalQty}</span>
            Lihat Keranjang
          </span>
          <span className="cart-fab__total">{formatRupiah(p.total)}</span>
        </button>
      )}

      {/* ── Modal Pembayaran ─────────────────────────────────────────── */}
      {p.showPayment && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && p.setShowPayment(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Pembayaran</h2>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => p.setShowPayment(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="statement-row statement-row--total mb-3">
                <span>Total Tagihan</span><span className="statement-value">{formatRupiah(p.total)}</span>
              </div>

              <div className="form-group">
                <label className="form-label">Metode Pembayaran</label>
                <div className="flex gap-2">
                  {PAYMENT_METHODS.map((m) => (
                    <button
                      key={m.id}
                      className={`btn btn-sm ${p.paymentMethod === m.id ? "btn-primary" : "btn-ghost"}`}
                      onClick={() => p.selectPaymentMethod(m.id)}
                    >{m.label}</button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  {p.paymentMethod === "open_bill" ? "Jumlah DP (boleh Rp0)" : "Jumlah Dibayar"}
                </label>

                {p.paymentMethod === "cash" && p.quickAmounts.length > 0 && (
                  <div className="quick-amount-row">
                    {p.quickAmounts.map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        className={`quick-amount-chip ${String(p.paymentAmount) === String(amount) ? "quick-amount-chip--active" : ""}`}
                        onClick={() => p.selectQuickAmount(amount)}
                      >
                        {amount === p.total ? "Uang Pas" : formatRupiah(amount)}
                      </button>
                    ))}
                  </div>
                )}

                <RupiahInput
                  value={p.paymentAmount}
                  onChange={(v) => p.setPaymentAmount(v === "" ? "" : String(v))}
                />
              </div>

              {p.paymentMethod === "cash" && p.paymentAmount && (
                <div className="statement-row">
                  <span>Kembalian</span>
                  <span className="statement-value">{formatRupiah(Math.max(p.change, 0))}</span>
                </div>
              )}

              {p.paymentMethod === "open_bill" && (
                <div className="statement-row">
                  <span>Sisa Piutang</span>
                  <span className="statement-value">
                    {formatRupiah(Math.max(p.total - (parseFloat(p.paymentAmount) || 0), 0))}
                  </span>
                </div>
              )}

              {p.paymentMethod === "open_bill" ? (
                <>
                  <div className="form-group">
                    <label className="form-label">Pelanggan Terdaftar</label>
                    <SearchFilterSelect
                      options={p.customers}
                      value={p.selectedCustomerId}
                      onChange={p.selectCustomer}
                      placeholder="Cari pelanggan..."
                      emptyText="Pelanggan tidak ditemukan"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Nama Pelanggan *</label>
                    <input
                      className="form-input" value={p.customerName}
                      onChange={(e) => { p.setCustomerName(e.target.value); }}
                      placeholder="Ketik nama pelanggan baru, atau pilih dari daftar di atas"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Jatuh Tempo *</label>
                    <input
                      type="date" className="form-input" value={p.dueDate}
                      onChange={(e) => p.setDueDate(e.target.value)}
                    />
                  </div>
                </>
              ) : (
                <div className="form-group">
                  <label className="form-label">Nama Pelanggan (opsional)</label>
                  <input className="form-input" value={p.customerName} onChange={(e) => p.setCustomerName(e.target.value)} />
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => p.setShowPayment(false)}>Batal</button>
              <button className="btn btn-success" onClick={p.processPayment} disabled={p.loadingPayment}>
                {p.loadingPayment ? "Memproses..." : "Konfirmasi Bayar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal pilih satuan / varian ───────────────────────────── */}
      {p.optionProduct && (
        <ProductOptionsModal
          product={p.optionProduct}
          onSelect={p.onOptionSelect}
          onClose={() => p.setOptionProduct(null)}
        />
      )}

      {/* ── Modal Struk Berhasil ─────────────────────────────────────── */}
      {p.lastReceipt && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && p.setLastReceipt(null)}>
          <div className="modal modal--small">
            <div className="modal-header">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={18} style={{ color: "var(--accent-green)" }} />
                <h2 className="modal-title">Transaksi Berhasil</h2>
              </div>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => p.setLastReceipt(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="statement-row"><span>Kode Transaksi</span><span className="font-mono">{p.lastReceipt.transaction_code}</span></div>
              <div className="statement-row statement-row--total"><span>Total</span><span className="statement-value">{formatRupiah(p.lastReceipt.final_amount)}</span></div>
              {p.lastReceipt.payment_method === "open_bill" ? (
                <>
                  <div className="statement-row"><span>DP Dibayar</span><span className="statement-value">{formatRupiah(p.lastReceipt.payment_amount)}</span></div>
                  <div className="statement-row"><span>Sisa Piutang</span><span className="statement-value">{formatRupiah(p.lastReceipt.final_amount - p.lastReceipt.payment_amount)}</span></div>
                  {p.lastReceipt.receivable && (
                    <div className="statement-row"><span>No. Faktur Open Bill</span><span className="font-mono">{p.lastReceipt.receivable.invoice_code}</span></div>
                  )}
                </>
              ) : (
                <div className="statement-row"><span>Kembalian</span><span className="statement-value">{formatRupiah(p.lastReceipt.change_amount)}</span></div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => p.setLastReceipt(null)}>Tutup</button>
              <button className="btn btn-primary" onClick={() => p.printReceipt(p.lastReceipt)}>
                <Printer size={14} /> Cetak Struk
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}