// src/features/cashier/CashierPage.jsx
import { useState } from "react";
import { useCashier } from "./hooks";
import { useShift } from "../../context/ShiftContext";
import { useAuth } from "../../context/AuthContext";
import { PageLoader } from "../../components/UI";
import { OpenShiftModal } from "../../components/ShiftModals";
import NoShiftScreen from "../../components/NoShiftScreen";
import ProductOptionsModal from "../../components/ProductOptionsModal";
import BarcodeScanner from "./components/BarcodeScanner";
import ProductFilterBar from "./components/ProductFilterBar";
import ProductGrid from "./components/ProductGrid";
import CartList from "./components/CartList";
import CartSummary from "./components/CartSummary";
import MobileCartFab from "./components/MobileCartFab";
import PaymentModal from "./components/PaymentModal";
import ReceiptModal from "./components/ReceiptModal";

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

  return (
    <div className="pos-layout">
      {/* ── Kolom produk ─────────────────────────────────────────────── */}
      <div className="pos-products">
        <BarcodeScanner
          inputRef={p.barcodeInputRef}
          value={p.barcode}
          onChange={p.setBarcode}
          onSubmit={p.submitBarcode}
        />

        <ProductFilterBar
          searchTerm={p.searchTerm}
          setSearchTerm={p.setSearchTerm}
          selectedCategory={p.selectedCategory}
          setSelectedCategory={p.setSelectedCategory}
          categories={p.categories}
        />

        <ProductGrid products={p.filteredProducts} onPick={p.handleProductPick} />
      </div>

      {/* ── Keranjang ────────────────────────────────────────────────── */}
      <div className={`pos-cart ${showMobileCart ? "pos-cart--open" : ""}`}>
        <CartList
          cart={p.cart}
          onClearCart={p.clearCart}
          onCloseMobileCart={() => setShowMobileCart(false)}
          onChangeQty={p.changeQty}
          onSetQtyExact={p.setQtyExact}
          onRemove={p.removeFromCart}
        />

        <CartSummary
          discount={p.discount}
          setDiscount={p.setDiscount}
          subtotal={p.subtotal}
          discountAmount={p.discountAmount}
          total={p.total}
          cartIsEmpty={p.cart.length === 0}
          onOpenPayment={p.openPaymentModal}
          onOpenBillShortcut={p.openBillShortcut}
        />
      </div>

      <MobileCartFab
        visible={!showMobileCart}
        showMobileCart={showMobileCart}
        cartTotalQty={p.cartTotalQty}
        total={p.total}
        onShow={() => setShowMobileCart(true)}
        onHideBackdrop={() => setShowMobileCart(false)}
      />

      {/* ── Modal Pembayaran ─────────────────────────────────────────── */}
      {p.showPayment && (
        <PaymentModal
          total={p.total}
          paymentMethod={p.paymentMethod}
          onSelectMethod={p.selectPaymentMethod}
          paymentAmount={p.paymentAmount}
          setPaymentAmount={p.setPaymentAmount}
          quickAmounts={p.quickAmounts}
          onSelectQuickAmount={p.selectQuickAmount}
          change={p.change}
          customers={p.customers}
          selectedCustomerId={p.selectedCustomerId}
          onSelectCustomer={p.selectCustomer}
          customerName={p.customerName}
          setCustomerName={p.setCustomerName}
          dueDate={p.dueDate}
          setDueDate={p.setDueDate}
          loadingPayment={p.loadingPayment}
          onConfirm={p.processPayment}
          onClose={() => p.setShowPayment(false)}
        />
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
        <ReceiptModal
          receipt={p.lastReceipt}
          onClose={() => p.setLastReceipt(null)}
          onPrint={p.printReceipt}
        />
      )}
    </div>
  );
}
