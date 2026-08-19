// src/features/stockMutation/StockMutationPage.jsx
// ─────────────────────────────────────────────────────────────────────────────
// VIEW LAYER — Mutasi Stok: seluruh pergerakan stok (penjualan, pembelian,
// stock opname, penyesuaian manual) yang sudah dicatat otomatis oleh
// masing-masing modul ke stock_history. Halaman ini murni menampilkan &
// memfilternya.
// ─────────────────────────────────────────────────────────────────────────────
import { useStockMutation } from "./hooks";
import { PageLoader } from "../../components/UI";
import StockMutationFilterBar from "./components/StockMutationFilterBar";
import StockMutationSummary from "./components/StockMutationSummary";
import StockMutationTable from "./components/StockMutationTable";

export default function StockMutation() {
  const sm = useStockMutation();

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Mutasi Stok</div>
          <div className="page-subtitle">Riwayat seluruh pergerakan stok: penjualan, pembelian, stock opname &amp; penyesuaian manual</div>
        </div>
      </div>

      <div className="page-body">
        <StockMutationFilterBar
          startDate={sm.startDate}
          endDate={sm.endDate}
          productId={sm.productId}
          jenis={sm.jenis}
          products={sm.products}
          jenisOptions={sm.jenisOptions}
          onStartDateChange={sm.setStartDate}
          onEndDateChange={sm.setEndDate}
          onProductIdChange={sm.setProductId}
          onJenisChange={sm.setJenis}
          onReset={sm.resetFilters}
        />

        {sm.loading ? <PageLoader /> : (
          <>
            <StockMutationSummary summary={sm.summary} />
            <StockMutationTable mutations={sm.mutations} total={sm.total} page={sm.page} onPageChange={sm.setPage} />
          </>
        )}
      </div>
    </div>
  );
}
