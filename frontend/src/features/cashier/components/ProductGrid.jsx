// src/features/cashier/components/ProductGrid.jsx
import { Search } from "lucide-react";
import { EmptyState } from "../../../components/UI";
import { formatRupiah, formatQty } from "../../../utils/format";

export default function ProductGrid({ products, onPick }) {
  if (products.length === 0) {
    return <EmptyState icon={Search} title="Produk tidak ditemukan" description="Coba kata kunci atau kategori lain" />;
  }

  return (
    <div className="product-grid">
      {products.map((product) => (
        <div
          key={product.id}
          className={`product-card ${Number(product.stock) <= 0 ? "out-of-stock" : ""}`}
          onClick={() => onPick(product)}
        >
          <div className="product-category">{product.category_name || "Lainnya"}</div>
          <div className="product-name">{product.name}</div>
          <div className="product-price">{formatRupiah(product.price)}</div>
          {Number(product.price_wholesale) > 0 && (
            <div className="product-price-wholesale">
              Grosir: {formatRupiah(product.price_wholesale)} (beli ≥ {product.min_qty_wholesale} {product.unit})
            </div>
          )}
          <div className="product-stock">
            Stok: {formatQty(product.stock)} {product.unit}
            {(product.selection_type === "unit" || (product.additional_units && product.additional_units.length > 0)) ? " · multi satuan" : ""}
          </div>
        </div>
      ))}
    </div>
  );
}
