// src/features/products/ProductFormPage.jsx
//
// Halaman penuh Tambah/Edit Produk — menggantikan modal lama yang punya 4
// tab (Informasi Umum / Harga & Satuan / Opsi Produk / Stok). Sekarang cuma
// 2 tab: "Informasi Produk" dan "Harga & Satuan" — Opsi Produk & Stok
// digabung ke tab "Harga & Satuan" (sebagai sub-section, dengan judul kecil
// masing-masing) supaya jumlah tab tetap minimal tapi field-nya tetap
// terkelompok jelas.
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useProducts, useProductForm } from "./hooks";
import { PageLoader } from "../../components/UI";
import ProductInfoSection from "./components/ProductInfoSection";
import InitialPurchaseSection from "./components/InitialPurchaseSection";
import CostPriceField from "./components/CostPriceField";
import UnitsPricingSection from "./components/UnitsPricingSection";
import ProductOptionsSection from "./components/ProductOptionsSection";
import StockSection from "./components/StockSection";

const TABS = [
  { id: "umum", label: "Informasi Produk" },
  { id: "harga", label: "Harga & Satuan" },
];

// activeErrorTab dari useProductForm masih pakai 4 nilai lama (umum/harga/
// opsi/stok) — opsi & stok sekarang tinggal di tab "harga" juga.
function tabForError(errorTab) {
  if (!errorTab) return null;
  return errorTab === "umum" ? "umum" : "harga";
}

export default function ProductFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const pr = useProducts();

  const [editProduct, setEditProduct] = useState(null);
  const [loadingEdit, setLoadingEdit] = useState(isEdit);

  // Data lengkap produk (termasuk additional_units & variants) di-fetch di
  // sini berdasarkan :id — listing di ProductsPage sengaja tidak menyertakan
  // itu supaya tetap ringan (lihat komentar fetchProductForEdit di hooks.js).
  //
  // Form-nya sendiri (yang pakai useProductForm) sengaja BARU di-mount lewat
  // <ProductFormBody> di bawah, setelah editProduct ini siap — kalau
  // useProductForm langsung dipanggil di sini dengan editProduct yang masih
  // null lalu di-update belakangan, state form-nya TIDAK akan ikut ter-update
  // (useState di dalam hook cuma diinisialisasi sekali saat mount).
  useEffect(() => {
    let alive = true;
    if (isEdit) {
      setLoadingEdit(true);
      pr.fetchProductForEdit({ id }).then((data) => {
        if (!alive) return;
        setEditProduct(data);
        setLoadingEdit(false);
      });
    }
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function goBack() {
    navigate("/produk");
  }

  if (isEdit && loadingEdit) return <PageLoader text="Memuat produk..." />;

  return (
    <ProductFormBody
      key={isEdit ? id : "create"}
      isEdit={isEdit}
      editProduct={editProduct}
      pr={pr}
      goBack={goBack}
    />
  );
}

function ProductFormBody({ isEdit, editProduct, pr, goBack }) {
  const f = useProductForm(isEdit ? editProduct : null, pr.reload, goBack);
  const [activeTab, setActiveTab] = useState("umum");
  const [categoryQuery, setCategoryQuery] = useState("");
  useEffect(() => {
    setCategoryQuery(f.form.category_name || "");
  }, [f.form.category_name]);

  // Saat validasi gagal, loncat ke tab yang relevan (opsi & stok sama-sama
  // masuk tab "harga" sekarang).
  useEffect(() => {
    const target = tabForError(f.activeErrorTab);
    if (target) setActiveTab(target);
  }, [f.activeErrorTab]);

  // Bantuan input Stok Awal dalam satuan pembelian (mis. Karung), buat
  // produk yang diisi "Info Pembelian Awal" (karung = 25 kg). Tanpa ini,
  // admin gampang salah kira Stok Awal dihitung dalam satuan pembelian
  // padahal sistem selalu mencatat stok dalam satuan dasar (kg) — isi "6"
  // maksudnya 6 karung tapi kesimpan sebagai 6 kg.
  const [stockInPurchaseUnit, setStockInPurchaseUnit] = useState("");
  function handleStockInPurchaseUnitChange(value) {
    setStockInPurchaseUnit(value);
    const qty = Number(value);
    const conversion = Number(f.form.initial_purchase_conversion_qty);
    if (value !== "" && qty > 0 && conversion > 0) {
      f.setField("stock", qty * conversion);
    } else if (value === "") {
      f.setField("stock", "");
    }
  }
  function handleStockChange(value) {
    setStockInPurchaseUnit("");
    f.setField("stock", value);
  }

  function selectCategory(option) {
    f.setField("category_id", option.id);
    f.setField("category_name", option.name);
    setCategoryQuery(option.name);
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <button type="button" className="btn btn-ghost btn-sm mb-2" onClick={goBack}>
            <ArrowLeft size={16} /> Kembali
          </button>
          <div className="page-title">{isEdit ? "Edit Produk" : "Tambah Produk"}</div>
        </div>
      </div>

      <div className="page-body">
        <div className="card">
          <div className="product-form-tabs">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`product-form-tab ${activeTab === t.id ? "active" : ""}`}
                onClick={() => setActiveTab(t.id)}
              >
                {t.label}
                {tabForError(f.activeErrorTab) === t.id && <span className="product-form-tab__error-dot" />}
              </button>
            ))}
          </div>

          {activeTab === "umum" && (
            <ProductInfoSection
              f={f}
              pr={pr}
              categoryQuery={categoryQuery}
              onCategoryQueryChange={setCategoryQuery}
              onSelectCategory={selectCategory}
            />
          )}

          {activeTab === "harga" && (
            <>
              {!editProduct && <InitialPurchaseSection f={f} pr={pr} />}
              <CostPriceField f={f} editProduct={editProduct} />
              <UnitsPricingSection f={f} pr={pr} />
              <ProductOptionsSection f={f} pr={pr} />
              <StockSection
                f={f}
                editProduct={editProduct}
                stockInPurchaseUnit={stockInPurchaseUnit}
                onStockInPurchaseUnitChange={handleStockInPurchaseUnitChange}
                onStockChange={handleStockChange}
              />
            </>
          )}
        </div>

        <div className="product-form-page-footer">
          <button type="button" className="btn btn-ghost" onClick={goBack}>Batal</button>
          <button type="button" className="btn btn-primary" onClick={f.submit} disabled={f.submitting}>
            {f.submitting ? "Menyimpan..." : "Simpan Produk"}
          </button>
        </div>
      </div>
    </div>
  );
}
