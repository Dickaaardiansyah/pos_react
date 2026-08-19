// src/features/stockOpname/StockOpnamePage.jsx
// ─────────────────────────────────────────────────────────────────────────────
// VIEW LAYER — Stock Opname: sesi pemeriksaan stok fisik vs stok sistem.
// Menyimpan sesi otomatis menyesuaikan stok produk & mencatat histori.
// ─────────────────────────────────────────────────────────────────────────────
import { useStockOpname } from "./hooks";
import { PageLoader } from "../../components/UI";
import StockOpnameList from "./components/StockOpnameList";
import NewOpnameForm from "./components/NewOpnameForm";
import StockOpnameDetailModal from "./components/StockOpnameDetailModal";

const TABS = [
  { id: "list", label: "Riwayat Stock Opname" },
  { id: "new", label: "Stock Opname Baru" },
];

export default function StockOpname() {
  const so = useStockOpname();

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Stock Opname</div>
          <div className="page-subtitle">Periksa stok fisik &amp; sesuaikan otomatis dengan stok sistem</div>
        </div>
      </div>

      <div className="page-body">
        <div className="tab-nav">
          {TABS.map((t) => (
            <button key={t.id} className={`tab-btn ${so.tab === t.id ? "active" : ""}`} onClick={() => so.setTab(t.id)}>{t.label}</button>
          ))}
        </div>

        {so.tab === "list" && (so.loading ? <PageLoader /> : (
          <StockOpnameList
            sessions={so.sessions}
            total={so.total}
            page={so.page}
            search={so.search}
            fetching={so.fetching}
            onSearchChange={so.setSearch}
            onPageChange={so.setPage}
            onViewDetail={so.viewDetail}
          />
        ))}
        {so.tab === "new" && <NewOpnameForm onSuccess={() => { so.reload(); so.setTab("list"); }} />}
      </div>

      {so.selected && <StockOpnameDetailModal session={so.selected} onClose={() => so.setSelected(null)} />}
    </div>
  );
}
