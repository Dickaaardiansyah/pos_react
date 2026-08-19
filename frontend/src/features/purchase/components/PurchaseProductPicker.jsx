// src/features/purchase/components/PurchaseProductPicker.jsx
import { useState } from "react";
import { Plus } from "lucide-react";
import { SearchInput } from "../../../components/UI";
import { formatRupiah, formatQty } from "../../../utils/format";

export default function PurchaseProductPicker({ products, onAddItem }) {
  const [search, setSearch] = useState("");
  const filteredProducts = products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="card">
      <div className="chart-card__title">Pilih Produk</div>
      <SearchInput value={search} onChange={setSearch} placeholder="Cari produk..." className="mb-3 w-full" />
      <div className="purchase-product-list">
        {filteredProducts.map((p) => (
          <div key={p.id} className="cart-item" style={{ cursor: "pointer" }} onClick={() => onAddItem(p)}>
            <div style={{ flex: 1 }}>
              <div className="cart-item-name">{p.name}</div>
              <div className="cart-item-price">Modal: {formatRupiah(p.cost_price)} • Stok: {formatQty(p.stock)} {p.unit}</div>
            </div>
            <Plus size={16} />
          </div>
        ))}
      </div>
    </div>
  );
}
