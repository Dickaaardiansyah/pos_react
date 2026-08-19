// src/features/transactions/TransactionsPage.jsx
import { useState } from "react";
import { Eye, ClipboardCheck, RefreshCw } from "lucide-react";
import { useTransactions } from "./hooks";
import { PageLoader, EmptyState } from "../../components/UI";
import TransactionFilterBar from "./components/TransactionFilterBar";
import TransactionDayList from "./components/TransactionDayList";
import TransactionDetailModal from "./components/TransactionDetailModal";
import VoidConfirmModal from "./components/VoidConfirmModal";
import VoidRequestsPanel from "./components/VoidRequestsPanel";

export default function Transactions() {
  const t = useTransactions();
  const [showVoidPanel, setShowVoidPanel] = useState(false);

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Riwayat Transaksi</div>
          <div className="page-subtitle">{t.total} transaksi ditemukan</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {t.isAdmin && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setShowVoidPanel(true)}
              title="Persetujuan pengajuan void"
            >
              <ClipboardCheck size={15} /> Persetujuan Void
            </button>
          )}
          <button
            className={`btn btn-ghost btn-icon btn-sm${t.loading ? " tx-refresh--spinning" : ""}`}
            onClick={t.reload}
            disabled={t.loading}
            title="Muat ulang"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      <div className="page-body">
        <TransactionFilterBar
          search={t.search}
          onSearchChange={t.setSearch}
          quickFilter={t.quickFilter}
          onQuickFilterChange={t.setQuickFilter}
          startDate={t.startDate}
          onStartDateChange={t.setStartDate}
          endDate={t.endDate}
          onEndDateChange={t.setEndDate}
          paymentMethod={t.paymentMethod}
          onPaymentMethodChange={t.setPaymentMethod}
          statusFilter={t.statusFilter}
          onStatusFilterChange={t.setStatusFilter}
          onReset={t.resetFilters}
        />

        {t.loading ? (
          <PageLoader />
        ) : t.groupedByDate.length === 0 ? (
          <EmptyState icon={Eye} title="Belum ada transaksi" description="Transaksi kasir akan muncul di sini" />
        ) : (
          <TransactionDayList
            groups={t.groupedByDate}
            collapsedGroups={t.collapsedGroups}
            onToggleGroup={t.toggleGroup}
            onViewDetail={t.viewDetail}
            onOpenVoidModal={t.openVoidModal}
            isAdmin={t.isAdmin}
          />
        )}
      </div>

      {t.selected && (
        <TransactionDetailModal
          transaction={t.selected}
          isAdmin={t.isAdmin}
          onClose={t.closeDetail}
          onOpenVoidModal={t.openVoidModal}
          onPrintReceipt={t.printReceipt}
        />
      )}

      {t.voidTarget && (
        <VoidConfirmModal
          target={t.voidTarget}
          reason={t.voidReason}
          onReasonChange={t.setVoidReason}
          loading={t.voidLoading}
          isAdmin={t.isAdmin}
          onClose={t.closeVoidModal}
          onConfirm={t.confirmVoid}
        />
      )}

      {showVoidPanel && <VoidRequestsPanel onClose={() => setShowVoidPanel(false)} />}
    </div>
  );
}
