// src/features/purchase/PurchasePage.jsx
import toast from "react-hot-toast";
import { usePurchase } from "./hooks";
import { purchaseApi } from "./api";
import { PageLoader } from "../../components/UI";
import PurchaseList from "./components/PurchaseList";
import NewPurchaseForm from "./components/NewPurchaseForm";
import SupplierList from "./components/SupplierList";
import PurchaseDetailModal from "./components/PurchaseDetailModal";

const TABS = [
  { id: "list", label: "Riwayat Pembelian" },
  { id: "new", label: "Pembelian Baru" },
  { id: "suppliers", label: "Supplier" },
];

function viewNota(notaUrl) {
  purchaseApi.viewNota(notaUrl).catch(() => toast.error("Gagal membuka file nota"));
}

export default function Purchase() {
  const pu = usePurchase();

  if (pu.loading) return <PageLoader text="Memuat data pembelian..." />;

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Pembelian Stok</div>
          <div className="page-subtitle">Catat barang masuk dari supplier</div>
        </div>
      </div>

      <div className="page-body">
        <div className="tab-nav">
          {TABS.map((t) => (
            <button key={t.id} className={`tab-btn ${pu.tab === t.id ? "active" : ""}`} onClick={() => pu.setTab(t.id)}>{t.label}</button>
          ))}
        </div>

        {pu.tab === "list" && (
          <PurchaseList
            purchases={pu.purchases}
            total={pu.total}
            page={pu.page}
            search={pu.search}
            onSearchChange={pu.setSearch}
            onPageChange={pu.setPage}
            onViewDetail={pu.viewDetail}
            onViewNota={viewNota}
          />
        )}
        {pu.tab === "new" && <NewPurchaseForm products={pu.products} suppliers={pu.suppliers} onSuccess={pu.reload} />}
        {pu.tab === "suppliers" && <SupplierList suppliers={pu.suppliers} onReload={pu.reload} />}
      </div>

      {pu.selected && (
        <PurchaseDetailModal purchase={pu.selected} onClose={() => pu.setSelected(null)} onViewNota={viewNota} />
      )}
    </div>
  );
}
