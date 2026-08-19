// src/features/stockMutation/components/StockMutationFilterBar.jsx
import { SearchFilterSelect } from "../../../components/UI";

export default function StockMutationFilterBar({
  startDate,
  endDate,
  productId,
  jenis,
  products,
  jenisOptions,
  onStartDateChange,
  onEndDateChange,
  onProductIdChange,
  onJenisChange,
  onReset,
}) {
  return (
    <div className="filter-bar">
      <input type="date" className="form-input" value={startDate} onChange={(e) => onStartDateChange(e.target.value)} />
      <span className="text-muted text-sm">s/d</span>
      <input type="date" className="form-input" value={endDate} onChange={(e) => onEndDateChange(e.target.value)} />
      <div style={{ width: 220 }}>
        <SearchFilterSelect
          options={products}
          value={productId}
          onChange={onProductIdChange}
          placeholder="Cari Produk..."
          emptyText="Produk tidak ditemukan"
        />
      </div>
      <select className="form-select" value={jenis} onChange={(e) => onJenisChange(e.target.value)}>
        <option value="">Semua Jenis Mutasi</option>
        {jenisOptions.map((j) => <option key={j.id} value={j.id}>{j.label}</option>)}
      </select>
      <button className="btn btn-ghost btn-sm" onClick={onReset}>Reset</button>
    </div>
  );
}
