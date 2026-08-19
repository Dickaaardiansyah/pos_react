// src/features/stockOpname/components/OpnameProductPicker.jsx
import { useState } from "react";
import { Plus, ListChecks } from "lucide-react";
import { PageLoader, SearchInput } from "../../../components/UI";
import { formatQty } from "../../../utils/format";

export default function OpnameProductPicker({ products, loading, selectedIds, onAddItem, onAddAllVisible }) {
  const [search, setSearch] = useState("");
  const visibleProducts = products.filter((p) => !selectedIds.has(p.id) && p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="card mb-4">
      <div className="flex gap-3 items-center mb-3" style={{ flexWrap: "wrap" }}>
        <div className="chart-card__title" style={{ marginBottom: 0, flex: 1 }}>Tambah Produk untuk Diperiksa</div>
        <SearchInput value={search} onChange={setSearch} placeholder="Cari produk..." className="w-full" />
        {visibleProducts.length > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={() => onAddAllVisible(visibleProducts)}>
            <ListChecks size={14} /> Tambah Semua ({visibleProducts.length})
          </button>
        )}
      </div>
      {loading ? <PageLoader text="Memuat produk..." /> : (
        <div style={{ maxHeight: 220, overflowY: "auto" }}>
          {visibleProducts.length === 0 ? (
            <div className="text-sm text-muted">Tidak ada produk lagi untuk ditambahkan</div>
          ) : visibleProducts.map((p) => (
            <div key={p.id} className="cart-item" style={{ cursor: "pointer" }} onClick={() => onAddItem(p)}>
              <div style={{ flex: 1 }}>
                <div className="cart-item-name">{p.name}</div>
                <div className="cart-item-price">Stok Sistem: {formatQty(p.stock)} {p.unit} • {p.barcode}</div>
              </div>
              <Plus size={16} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
