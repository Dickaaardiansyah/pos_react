// src/features/products/components/ProductFilterBar.jsx
import { SearchInput } from "../../../components/UI";

export default function ProductFilterBar({
  search,
  onSearchChange,
  categories,
  filterCategory,
  onFilterCategoryChange,
  filterLowStock,
  onFilterLowStockChange,
}) {
  return (
    <div className="filter-bar">
      <SearchInput value={search} onChange={onSearchChange} placeholder="Cari nama/barcode..." className="w-full" />
      <select className="form-select" value={filterCategory} onChange={(e) => onFilterCategoryChange(e.target.value)}>
        <option value="">Semua Kategori</option>
        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={filterLowStock} onChange={(e) => onFilterLowStockChange(e.target.checked)} />
        Stok menipis saja
      </label>
    </div>
  );
}
