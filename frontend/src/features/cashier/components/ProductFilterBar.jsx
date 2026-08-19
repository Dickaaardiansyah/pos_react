// src/features/cashier/components/ProductFilterBar.jsx
import { SearchInput } from "../../../components/UI";

export default function ProductFilterBar({ searchTerm, setSearchTerm, selectedCategory, setSelectedCategory, categories }) {
  return (
    <div className="filter-bar">
      <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Cari nama produk..." className="w-full" />
      <select className="form-select" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
        <option value="">Semua Kategori</option>
        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    </div>
  );
}
