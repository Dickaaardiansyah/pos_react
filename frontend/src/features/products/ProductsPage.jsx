// src/features/products/ProductsPage.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, PackagePlus, Tags, Settings2 } from "lucide-react";
import { useProducts } from "./hooks";
import { PageLoader, EmptyState } from "../../components/UI";
import BarcodeModal from "../../components/BarcodeModal";
import ProductFilterBar from "./components/ProductFilterBar";
import ProductTable from "./components/ProductTable";
import StockAdjustModal from "./components/StockAdjustModal";
import CategoryUnitManagerModal from "./components/CategoryUnitManagerModal";

export default function Products() {
  const navigate = useNavigate();
  const pr = useProducts();
  const [stockTarget, setStockTarget] = useState(null);
  const [labelProduct, setLabelProduct] = useState(null);
  const [showLabelAll, setShowLabelAll] = useState(false);
  const [showManager, setShowManager] = useState(false);

  // Tambah/Edit Produk sekarang halaman penuh (lihat ProductFormPage.jsx),
  // bukan modal bertab — supaya semua field kelihatan sekaligus tanpa perlu
  // pindah-pindah tab. Data lengkap produk (termasuk additional_units &
  // variants) di-fetch di dalam halaman itu sendiri berdasarkan :id di URL.
  function openCreate() { navigate("/produk/tambah"); }
  function openEdit(product) { navigate(`/produk/${product.id}/edit`); }

  if (pr.loading) return <PageLoader text="Memuat produk..." />;

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Produk</div>
          <div className="page-subtitle">{pr.products.length} produk terdaftar</div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={() => setShowManager(true)}><Settings2 size={16} /> Kelola Kategori &amp; Satuan</button>
          <button className="btn btn-ghost" onClick={() => setShowLabelAll(true)}><Tags size={16} /> Cetak Label</button>
          <button className="btn btn-primary" onClick={openCreate}><Plus size={16} /> Tambah Produk</button>
        </div>
      </div>

      <div className="page-body">
        <ProductFilterBar
          search={pr.search}
          onSearchChange={pr.setSearch}
          categories={pr.categories}
          filterCategory={pr.filterCategory}
          onFilterCategoryChange={pr.setFilterCategory}
          filterLowStock={pr.filterLowStock}
          onFilterLowStockChange={pr.setFilterLowStock}
        />

        {pr.filtered.length === 0 ? (
          <EmptyState icon={PackagePlus} title="Belum ada produk" description="Tambahkan produk pertama Anda" action={<button className="btn btn-primary" onClick={openCreate}>Tambah Produk</button>} />
        ) : (
          <ProductTable
            products={pr.filtered}
            onPrintLabel={setLabelProduct}
            onAdjustStock={setStockTarget}
            onEdit={openEdit}
            onDelete={pr.deleteProduct}
          />
        )}
      </div>

      {stockTarget && (
        <StockAdjustModal product={stockTarget} onUpdate={pr.updateStock} onClose={() => setStockTarget(null)} />
      )}

      {labelProduct && (
        <BarcodeModal products={pr.products} initialProduct={labelProduct} onClose={() => setLabelProduct(null)} />
      )}
      {showLabelAll && (
        <BarcodeModal products={pr.products} onClose={() => setShowLabelAll(false)} />
      )}

      {showManager && (
        <CategoryUnitManagerModal
          categories={pr.categories}
          units={pr.units}
          onDeleteCategory={pr.deleteCategory}
          onDeleteUnit={pr.deleteUnit}
          onClose={() => setShowManager(false)}
        />
      )}
    </div>
  );
}
