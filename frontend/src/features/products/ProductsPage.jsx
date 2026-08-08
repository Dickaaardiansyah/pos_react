// src/features/products/ProductsPage.jsx
import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, PackagePlus, Barcode as BarcodeIcon, Sparkles, Tags, X, Settings2 } from "lucide-react";
import { useProducts, useProductForm } from "./hooks";
import { PageLoader, EmptyState, SearchInput, Badge, SectionHeader, SearchCreateSelect, ChipSearchSelect, ConfirmDialog } from "../../components/UI";
import BarcodeModal from "../../components/BarcodeModal";
import { formatRupiah, formatQty, formatRupiahInput, parseRupiahInput } from "../../utils/format";

export default function Products() {
  const pr = useProducts();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [stockTarget, setStockTarget] = useState(null);
  const [labelProduct, setLabelProduct] = useState(null);
  const [showLabelAll, setShowLabelAll] = useState(false);
  const [showManager, setShowManager] = useState(false);

  function openCreate() { setEditing(null); setShowForm(true); }
  async function openEdit(product) {
    setLoadingEdit(true);
    const full = await pr.fetchProductForEdit(product);
    setLoadingEdit(false);
    setEditing(full);
    setShowForm(true);
  }

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
        <div className="filter-bar">
          <SearchInput value={pr.search} onChange={pr.setSearch} placeholder="Cari nama/barcode..." className="w-full" />
          <select className="form-select" value={pr.filterCategory} onChange={(e) => pr.setFilterCategory(e.target.value)}>
            <option value="">Semua Kategori</option>
            {pr.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={pr.filterLowStock} onChange={(e) => pr.setFilterLowStock(e.target.checked)} />
            Stok menipis saja
          </label>
        </div>

        {pr.filtered.length === 0 ? (
          <EmptyState icon={PackagePlus} title="Belum ada produk" description="Tambahkan produk pertama Anda" action={<button className="btn btn-primary" onClick={openCreate}>Tambah Produk</button>} />
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Barcode</th><th>Nama</th><th>Kategori</th><th>Harga Jual</th><th>Harga Modal</th><th>Stok</th><th></th>
                </tr>
              </thead>
              <tbody>
                {pr.filtered.map((product) => (
                  <tr key={product.id} className={Number(product.stock) <= Number(product.min_stock) ? "low-stock-row" : ""}>
                    <td className="font-mono text-xs">{product.barcode}</td>
                    <td className="font-bold">{product.name}</td>
                    <td>{product.category_name || "-"}</td>
                    <td className="font-mono">{formatRupiah(product.price)}</td>
                    <td className="font-mono text-muted">{formatRupiah(product.cost_price)}</td>
                    <td>
                      {formatQty(product.stock)} {product.unit}
                      {Number(product.stock) <= Number(product.min_stock) && <Badge variant="orange">Menipis</Badge>}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setLabelProduct(product)} title="Cetak label"><Tags size={14} /></button>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setStockTarget(product)} title="Sesuaikan stok"><BarcodeIcon size={14} /></button>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(product)} disabled={loadingEdit}><Pencil size={14} /></button>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => pr.deleteProduct(product)}><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <ProductFormModal
          editProduct={editing}
          categories={pr.categories}
          units={pr.units}
          onCreateCategory={pr.addCategory}
          onCreateUnit={pr.addUnit}
          onSuccess={pr.reload}
          onClose={() => setShowForm(false)}
        />
      )}

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

const PRODUCT_FORM_TABS = [
  { id: "umum", label: "Informasi Umum" },
  { id: "harga", label: "Harga & Satuan" },
  { id: "opsi", label: "Opsi Produk" },
  { id: "stok", label: "Stok" },
];

function ProductFormModal({ editProduct, categories, units, onCreateCategory, onCreateUnit, onSuccess, onClose }) {
  const f = useProductForm(editProduct, onSuccess, onClose);
  const [tab, setTab] = useState("umum");
  const [categoryQuery, setCategoryQuery] = useState(f.form.category_name || "");

  // Kalau validasi gagal di tab yang sedang tidak aktif (mis. error satuan
  // padahal user sedang di tab Stok), pindahkan otomatis ke tab yang relevan
  // supaya pesan error-nya terlihat — bukan cuma toast yang lewat begitu saja.
  useEffect(() => {
    if (f.activeErrorTab) setTab(f.activeErrorTab);
  }, [f.activeErrorTab]);

  function selectCategory(option) {
    f.setField("category_id", option.id);
    f.setField("category_name", option.name);
    setCategoryQuery(option.name);
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal--large">
        <div className="modal-header">
          <h2 className="modal-title">{editProduct ? "Edit Produk" : "Tambah Produk"}</h2>
        </div>
        <div className="modal-body">
          <div className="product-form-tabs">
            {PRODUCT_FORM_TABS.map((t) => (
              <button
                type="button"
                key={t.id}
                className={`product-form-tab ${tab === t.id ? "active" : ""}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
                {f.activeErrorTab === t.id && <span className="product-form-tab__error-dot" />}
              </button>
            ))}
          </div>

          {tab === "umum" && (
            <>
              <div className="form-group">
                <label className="form-label">Barcode</label>
                <div className="flex gap-2">
                  <input className="form-input" value={f.form.barcode} onChange={(e) => f.setField("barcode", e.target.value)} placeholder="Scan atau ketik manual" />
                  <button type="button" className="btn btn-ghost btn-sm" onClick={f.generateBarcode}><Sparkles size={14} /> Generate</button>
                </div>
                {f.barcodeStatus === "checking" && <div className="form-hint">Memeriksa ketersediaan barcode...</div>}
                {f.barcodeStatus === "duplicate" && <div className="form-hint form-hint--error">Barcode sudah digunakan produk lain</div>}
                {f.barcodeStatus === "ok" && f.form.barcode && <div className="form-hint form-hint--success">Barcode tersedia</div>}
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Nama Produk <span className="text-danger">*</span></label>
                  <input className="form-input" value={f.form.name} onChange={(e) => f.setField("name", e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Kategori</label>
                  <SearchCreateSelect
                    options={categories}
                    value={categoryQuery}
                    onInputChange={(text) => { setCategoryQuery(text); f.setField("category_id", ""); }}
                    onSelect={selectCategory}
                    onCreate={onCreateCategory}
                    placeholder="Cari atau buat kategori baru"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Deskripsi (opsional)</label>
                <textarea className="form-textarea" value={f.form.description || ""} onChange={(e) => f.setField("description", e.target.value)} />
              </div>
            </>
          )}

          {tab === "harga" && (
            <>
              <div className="form-group">
                <label className="form-label">Harga Modal</label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="form-input"
                  value={f.form.cost_price === "" || f.form.cost_price == null ? "" : formatRupiahInput(f.form.cost_price)}
                  onChange={(e) => f.setField("cost_price", e.target.value === "" ? "" : parseRupiahInput(e.target.value))}
                />
                <div className="form-hint">
                  Dipakai untuk hitung laba &amp; laporan Laba Rugi. Nilai ini normalnya dihitung otomatis
                  sebagai rata-rata bergerak setiap ada pembelian masuk — ubah manual di sini hanya untuk
                  koreksi data awal, karena perubahan manual akan ikut jadi dasar perhitungan rata-rata
                  pembelian berikutnya.
                </div>
                {editProduct && editProduct.id != null &&
                  f.form.cost_price !== "" && f.form.cost_price != null &&
                  Number(f.form.cost_price) !== Number(editProduct.cost_price || 0) && (
                    <div className="form-hint form-hint--warning">
                      ⚠️ Anda mengubah Harga Modal secara manual dari {formatRupiah(editProduct.cost_price || 0)}
                      {" "}menjadi {formatRupiah(f.form.cost_price)}. Ini akan menimpa hasil perhitungan rata-rata
                      bergerak dari riwayat pembelian sebelumnya.
                    </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Satuan &amp; Harga</label>
                <div className="form-hint mb-2">
                  Baris pertama adalah satuan dasar (dipakai untuk mencatat stok), lengkap dengan harga
                  jual &amp; harga grosirnya sendiri. Harga grosir wajib disertai jumlah beli minimum,
                  supaya jelas kapan harga itu berlaku.
                </div>
                <div className="unit-conversion-list">
                  <BaseUnitRow
                    unitName={f.form.unit}
                    units={units}
                    onCreateUnit={onCreateUnit}
                    onSelect={f.selectBaseUnit}
                    onInputChange={(text) => f.setField("unit", text)}
                    price={f.form.price}
                    priceWholesale={f.form.price_wholesale}
                    minQtyWholesale={f.form.min_qty_wholesale}
                    onPriceChange={(price) => f.setField("price", price)}
                    onPriceWholesaleChange={(price_wholesale) => f.setField("price_wholesale", price_wholesale)}
                    onMinQtyWholesaleChange={(min_qty_wholesale) => f.setField("min_qty_wholesale", min_qty_wholesale)}
                  />
                </div>
                {f.optionMode === "unit" && (
                  <div className="form-hint mt-2">
                    Satuan tambahan (BOX, LUSIN, dll.) diatur di tab <b>Opsi Produk</b>.
                  </div>
                )}
              </div>
            </>
          )}

          {tab === "opsi" && (
            <>
              <div className="form-group">
                <label className="form-label">Tipe Opsi Produk</label>
                <div className="form-hint mb-2">
                  Menentukan apa yang muncul di popup kasir saat produk ini diklik.
                  Pilih salah satu — kalau bingung, biarkan di "Tanpa Opsi".
                </div>
                <div className="option-mode-toggle">
                  <button
                    type="button"
                    className={`option-mode-toggle__item ${f.optionMode === "none" ? "active" : ""}`}
                    onClick={() => f.setOptionMode("none")}
                  >
                    <span className="option-mode-toggle__title">Tanpa Opsi</span>
                    <span className="option-mode-toggle__desc">Klik langsung masuk keranjang</span>
                  </button>
                  <button
                    type="button"
                    className={`option-mode-toggle__item ${f.optionMode === "unit" ? "active" : ""}`}
                    onClick={() => f.setOptionMode("unit")}
                  >
                    <span className="option-mode-toggle__title">Satuan Tambahan</span>
                    <span className="option-mode-toggle__desc">mis. Pcs / Lusin / Box</span>
                  </button>
                  <button
                    type="button"
                    className={`option-mode-toggle__item ${f.optionMode === "variant" ? "active" : ""}`}
                    onClick={() => f.setOptionMode("variant")}
                  >
                    <span className="option-mode-toggle__title">Varian</span>
                    <span className="option-mode-toggle__desc">mis. Es / Panas / Biasa</span>
                  </button>
                </div>
              </div>

              {f.optionMode === "unit" && (
                <div className="form-group mt-3">
                  <label className="form-label">Satuan tambahan</label>
                  <div className="form-hint mb-2">
                    Baris pertama di tab Harga &amp; Satuan otomatis jadi satuan dasar (dipakai
                    mencatat stok). Tambahkan satuan lain di sini beserta konversi &amp;
                    harganya — mis. BOX = 12 berarti 1 BOX setara 12 satuan dasar.
                  </div>
                  <div className="unit-conversion-list">
                    {f.form.additional_units.map((row, index) => (
                      <UnitConversionRow
                        key={index}
                        row={row}
                        units={units}
                        baseUnitName={f.form.unit || "satuan dasar"}
                        onCreateUnit={onCreateUnit}
                        onSelect={(option) => f.selectAdditionalUnit(index, option)}
                        onQtyChange={(qty) => f.updateUnitRow(index, { conversion_qty: qty })}
                        onPriceChange={(price) => f.updateUnitRow(index, { price })}
                        onPriceWholesaleChange={(price_wholesale) => f.updateUnitRow(index, { price_wholesale })}
                        onMinQtyWholesaleChange={(min_qty_wholesale) => f.updateUnitRow(index, { min_qty_wholesale })}
                        onClearSelection={() => f.clearUnitRowSelection(index)}
                        onRemove={() => f.removeUnitRow(index)}
                      />
                    ))}
                  </div>
                  <button type="button" className="btn btn-ghost btn-sm mt-2" onClick={f.addUnitRow}>
                    <Plus size={14} /> Tambah Satuan
                  </button>
                </div>
              )}

              {f.optionMode === "variant" && (
                <div className="form-group mt-3">
                  <label className="form-label">Varian produk</label>
                  <div className="form-hint mb-2">
                    Untuk produk yang sama tapi beda opsi tanpa mengubah stok terpisah —
                    mis. Aqua <b>Biasa</b> / <b>Es</b>, Kopi <b>Panas</b> / <b>Dingin</b>.
                    Setiap varian punya harga sendiri; stok tetap satu (satuan dasar).
                  </div>
                  <div className="unit-conversion-list">
                    {f.form.variants.map((row, index) => (
                      <VariantRow
                        key={index}
                        row={row}
                        onChange={(patch) => f.updateVariantRow(index, patch)}
                        onRemove={() => f.removeVariantRow(index)}
                        canRemove={f.form.variants.length > 1}
                      />
                    ))}
                  </div>
                  <button type="button" className="btn btn-ghost btn-sm mt-2" onClick={f.addVariantRow}>
                    <Plus size={14} /> Tambah Varian
                  </button>
                </div>
              )}
            </>
          )}

          {tab === "stok" && (
            <div className="grid-2">
              {!editProduct && (
                <div className="form-group">
                  <label className="form-label">Stok Awal</label>
                  <input type="number" min="0" className="form-input" value={f.form.stock} onChange={(e) => f.setField("stock", e.target.value)} />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Stok Minimum (Peringatan)</label>
                <input type="number" min="0" className="form-input" value={f.form.min_stock} onChange={(e) => f.setField("min_stock", e.target.value)} />
                <div className="form-hint">Angka ambang batas manual — produk ditandai "Menipis" di Dashboard &amp; daftar Produk saat stok mencapai angka ini. Tidak dipakai untuk hitung Reorder Point.</div>
              </div>

              <div className="rop-section-divider">
                <div className="rop-section-divider__title">Untuk Hitung Reorder Point (ROP)</div>
                <div className="rop-section-divider__desc">
                  Isi field di bawah supaya sistem bisa menghitung otomatis kapan produk ini perlu dipesan ulang, berdasarkan rata-rata penjualan, lead time, dan cadangan. Hasilnya tampil di halaman Rekomendasi Restock.
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Satuan Waktu Reorder Point</label>
                <select className="form-select" value={f.form.rop_time_unit} onChange={(e) => f.setField("rop_time_unit", e.target.value)}>
                  <option value="hari">Hari</option>
                  <option value="jam">Jam</option>
                </select>
                <div className="form-hint">Pilih "Jam" untuk produk dengan perputaran cepat / lead time singkat (mis. barang titip harian). Jam operasional toko diatur di halaman Pengaturan.</div>
              </div>
              <div className="form-group">
                <label className="form-label">Lead Time ({f.form.rop_time_unit === "jam" ? "jam" : "hari"})</label>
                <input type="number" min="0" step="0.5" className="form-input" placeholder="Kosongkan jika tidak dipakai" value={f.form.lead_time_value} onChange={(e) => f.setField("lead_time_value", e.target.value)} />
                <div className="form-hint">Rata-rata waktu tunggu pemesanan ke supplier sampai barang diterima</div>
              </div>
              <div className="form-group">
                <label className="form-label">{f.form.rop_time_unit === "jam" ? "Jam" : "Hari"} Cadangan (Safety Stock)</label>
                <input type="number" min="0" step="0.5" className="form-input" placeholder="Kosongkan jika tidak dipakai" value={f.form.safety_stock_value} onChange={(e) => f.setField("safety_stock_value", e.target.value)} />
                <div className="form-hint">Isi Lead Time &amp; Cadangan untuk memunculkan produk ini di halaman Rekomendasi Restock</div>
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Batal</button>
          <button className="btn btn-primary" onClick={f.submit} disabled={f.submitting}>
            {f.submitting ? "Menyimpan..." : "Simpan Produk"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Baris satuan dasar — pivot dari seluruh konversi satuan produk. Selalu
// tampil sebagai baris pertama di daftar Satuan, tidak bisa dihapus (setiap
// produk wajib punya satu satuan dasar), tapi tetap bisa diganti lewat chip ✕.
// Harga jual/grosir/jumlah minimum grosirnya ditampilkan langsung di sini
// (bukan field terpisah di luar daftar Satuan) supaya konsisten dengan
// satuan tambahan di bawahnya.
function BaseUnitRow({
  unitName,
  units,
  onCreateUnit,
  onSelect,
  onInputChange,
  price,
  priceWholesale,
  minQtyWholesale,
  onPriceChange,
  onPriceWholesaleChange,
  onMinQtyWholesaleChange,
}) {
  return (
    <div className="unit-conversion-row-block unit-conversion-row-block--base">
      <div className="unit-conversion-row unit-conversion-row--base">
        <div className="unit-conversion-row__unit">
          <ChipSearchSelect
            options={units}
            selectedName={unitName}
            onInputChange={onInputChange}
            onSelect={onSelect}
            onClear={() => onInputChange("")}
            onCreate={onCreateUnit}
            placeholder="pcs, botol, kg, dll"
          />
        </div>
        <span className="unit-conversion-row__badge">Satuan dasar</span>
      </div>

      <div className="unit-conversion-row__prices">
        <div className="unit-conversion-row__price-field">
          <label className="form-label form-label--sm">
            Harga Eceran <span className="text-danger">*</span>
          </label>
          <input
            type="text"
            inputMode="numeric"
            className="form-input"
            value={price === "" || price == null ? "" : formatRupiahInput(price)}
            onChange={(e) => onPriceChange(e.target.value === "" ? "" : parseRupiahInput(e.target.value))}
            placeholder="0"
          />
        </div>
        <div className="unit-conversion-row__price-field">
          <label className="form-label form-label--sm">Harga Grosir (opsional)</label>
          <input
            type="text"
            inputMode="numeric"
            className="form-input"
            value={priceWholesale === "" || priceWholesale == null ? "" : formatRupiahInput(priceWholesale)}
            onChange={(e) => onPriceWholesaleChange(e.target.value === "" ? "" : parseRupiahInput(e.target.value))}
            placeholder="Kosongkan jika tidak ada"
          />
        </div>
        <div className="unit-conversion-row__price-field">
          <label className="form-label form-label--sm">
            Min. Beli Grosir {priceWholesale ? <span className="text-danger">*</span> : null}
          </label>
          <input
            type="number"
            min="2"
            className="form-input"
            value={minQtyWholesale}
            onChange={(e) => onMinQtyWholesaleChange(e.target.value)}
            placeholder={priceWholesale ? `mis. 6 ${unitName || "pcs"}` : "-"}
            disabled={!priceWholesale}
          />
        </div>
      </div>
    </div>
  );
}

// Setiap satuan tambahan (mis. BOX, LUSIN) punya harga jual sendiri —
// bukan cuma faktor konversi — persis seperti "Def. Hrg Jual Satuan #1/#2"
// pada referensi. Baris harga hanya muncul begitu satuannya sudah dipilih.

function VariantRow({ row, onChange, onRemove, canRemove }) {
  const filled = (row.name || "").trim() || row.price;
  return (
    <div className="unit-conversion-row">
      <div className="unit-conversion-row__top" style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div className="form-group" style={{ flex: "1 1 140px", marginBottom: 0 }}>
          <label className="form-label form-label--sm">Nama Varian</label>
          <input
            className="form-input"
            value={row.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Mis. Biasa, Es, Panas"
          />
        </div>
        <div className="form-group" style={{ flex: "1 1 120px", marginBottom: 0 }}>
          <label className="form-label form-label--sm">
            Harga Jual {filled ? <span className="text-danger">*</span> : null}
          </label>
          <input
            type="text"
            inputMode="numeric"
            className="form-input"
            value={row.price === "" || row.price == null ? "" : formatRupiahInput(row.price)}
            onChange={(e) => onChange({ price: e.target.value === "" ? "" : parseRupiahInput(e.target.value) })}
            placeholder="0"
          />
        </div>
        <div className="form-group" style={{ flex: "1 1 120px", marginBottom: 0 }}>
          <label className="form-label form-label--sm">Harga Grosir (opsional)</label>
          <input
            type="text"
            inputMode="numeric"
            className="form-input"
            value={row.price_wholesale === "" || row.price_wholesale == null ? "" : formatRupiahInput(row.price_wholesale)}
            onChange={(e) => onChange({ price_wholesale: e.target.value === "" ? "" : parseRupiahInput(e.target.value) })}
            placeholder="Kosongkan jika tidak ada"
          />
        </div>
        <div className="form-group" style={{ flex: "0 1 140px", marginBottom: 0 }}>
          <label className="form-label form-label--sm">
            Min. Grosir {row.price_wholesale ? <span className="text-danger">*</span> : null}
          </label>
          <input
            type="number"
            min="2"
            className="form-input"
            value={row.min_qty_wholesale}
            onChange={(e) => onChange({ min_qty_wholesale: e.target.value })}
            placeholder={row.price_wholesale ? "mis. 3" : "-"}
            disabled={!row.price_wholesale}
          />
          {row.price_wholesale && row.min_qty_wholesale ? (
            <div className="form-hint">
              Dihitung per baris "{row.name || "varian ini"}" — bukan dikonversi ke satuan dasar.
              Beli {row.min_qty_wholesale}× {row.name || "varian ini"} baru harga grosir aktif.
            </div>
          ) : null}
        </div>
        <div className="form-group" style={{ flex: "1 1 120px", marginBottom: 0 }}>
          <label className="form-label form-label--sm">Barcode (opsional)</label>
          <input
            className="form-input"
            value={row.barcode}
            onChange={(e) => onChange({ barcode: e.target.value })}
            placeholder="Opsional"
          />
        </div>
        {canRemove && (
          <button
            type="button"
            className="btn btn-ghost btn-icon btn-sm"
            style={{ marginTop: 22 }}
            onClick={onRemove}
            title="Hapus varian"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

function UnitConversionRow({ row, units, baseUnitName, onCreateUnit, onSelect, onQtyChange, onPriceChange, onPriceWholesaleChange, onMinQtyWholesaleChange, onClearSelection, onRemove }) {
  return (
    <div className="unit-conversion-row-block">
      <div className="unit-conversion-row">
        <div className="unit-conversion-row__unit">
          <ChipSearchSelect
            options={units}
            selectedName={row.unit_name}
            onInputChange={() => {}}
            onSelect={onSelect}
            onClear={onClearSelection}
            onCreate={onCreateUnit}
            placeholder="Cari/Pilih..."
          />
        </div>
        <span className="unit-conversion-row__equals">=</span>
        <input
          type="number"
          min="0"
          className="form-input unit-conversion-row__qty"
          value={row.conversion_qty}
          onChange={(e) => onQtyChange(e.target.value)}
          placeholder="0"
          disabled={!row.unit_id}
        />
        <span className="unit-conversion-row__base">{baseUnitName}</span>
        <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={onRemove} title="Hapus baris satuan ini">
          <X size={14} />
        </button>
      </div>

      {row.unit_id && (
        <div className="unit-conversion-row__prices">
          <div className="unit-conversion-row__price-field">
            <label className="form-label form-label--sm">
              Harga Jual / {row.unit_name} <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              className="form-input"
              value={row.price === "" || row.price == null ? "" : formatRupiahInput(row.price)}
              onChange={(e) => onPriceChange(e.target.value === "" ? "" : parseRupiahInput(e.target.value))}
              placeholder="0"
            />
          </div>
          <div className="unit-conversion-row__price-field">
            <label className="form-label form-label--sm">
              Harga Grosir / {row.unit_name} (opsional)
            </label>
            <input
              type="text"
              inputMode="numeric"
              className="form-input"
              value={row.price_wholesale === "" || row.price_wholesale == null ? "" : formatRupiahInput(row.price_wholesale)}
              onChange={(e) => onPriceWholesaleChange(e.target.value === "" ? "" : parseRupiahInput(e.target.value))}
              placeholder="Kosongkan jika tidak ada"
            />
          </div>
          <div className="unit-conversion-row__price-field">
            <label className="form-label form-label--sm">
              Min. Beli Grosir {row.price_wholesale ? <span className="text-danger">*</span> : null}
            </label>
            <input
              type="number"
              min="2"
              className="form-input"
              value={row.min_qty_wholesale}
              onChange={(e) => onMinQtyWholesaleChange(e.target.value)}
              placeholder={row.price_wholesale ? `mis. 3 ${row.unit_name}` : "-"}
              disabled={!row.price_wholesale}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Modal untuk mengelola (melihat & menghapus) master data Kategori dan
// Satuan. Kategori boleh dihapus meski masih dipakai produk (produk terkait
// otomatis jadi "Tanpa Kategori"). Satuan TIDAK boleh dihapus kalau masih
// dipakai produk manapun — tombol hapus tetap ditampilkan, tapi backend akan
// menolak dan pesan errornya ditampilkan lewat toast (lihat unitService.deleteUnit).
function CategoryUnitManagerModal({ categories, units, onDeleteCategory, onDeleteUnit, onClose }) {
  const [tab, setTab] = useState("kategori");
  const [pendingDelete, setPendingDelete] = useState(null); // { type, item }
  const [deleting, setDeleting] = useState(false);

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    if (pendingDelete.type === "kategori") await onDeleteCategory(pendingDelete.item);
    else await onDeleteUnit(pendingDelete.item);
    setDeleting(false);
    setPendingDelete(null);
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal--medium">
        <div className="modal-header">
          <h2 className="modal-title">Kelola Kategori &amp; Satuan</h2>
        </div>
        <div className="modal-body">
          <div className="product-form-tabs">
            <button type="button" className={`product-form-tab ${tab === "kategori" ? "active" : ""}`} onClick={() => setTab("kategori")}>
              Kategori
            </button>
            <button type="button" className={`product-form-tab ${tab === "satuan" ? "active" : ""}`} onClick={() => setTab("satuan")}>
              Satuan
            </button>
          </div>

          {tab === "kategori" && (
            <div className="manager-list">
              {categories.length === 0 && <div className="text-sm text-muted">Belum ada kategori</div>}
              {categories.map((c) => (
                <div className="manager-list__row" key={c.id}>
                  <div>
                    <div className="font-bold">{c.name}</div>
                    <div className="text-xs text-muted">
                      {c.product_count > 0 ? `Dipakai ${c.product_count} produk` : "Belum dipakai produk apa pun"}
                    </div>
                  </div>
                  <button className="btn btn-ghost btn-icon btn-sm" title="Hapus kategori" onClick={() => setPendingDelete({ type: "kategori", item: c })}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {tab === "satuan" && (
            <div className="manager-list">
              {units.length === 0 && <div className="text-sm text-muted">Belum ada satuan</div>}
              {units.map((u) => {
                const usage = (u.additional_usage_count || 0) + (u.base_usage_count || 0);
                return (
                  <div className="manager-list__row" key={u.id}>
                    <div>
                      <div className="font-bold">{u.name}</div>
                      <div className="text-xs text-muted">
                        {usage > 0 ? `Dipakai ${usage} produk — tidak bisa dihapus` : "Belum dipakai produk apa pun"}
                      </div>
                    </div>
                    <button className="btn btn-ghost btn-icon btn-sm" title="Hapus satuan" onClick={() => setPendingDelete({ type: "satuan", item: u })}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Tutup</button>
        </div>
      </div>

      {pendingDelete && (
        <ConfirmDialog
          title={pendingDelete.type === "kategori" ? "Hapus Kategori?" : "Hapus Satuan?"}
          message={`Hapus "${pendingDelete.item.name}"? Tindakan ini tidak bisa dibatalkan.`}
          danger
          loading={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}

function StockAdjustModal({ product, onUpdate, onClose }) {
  const [type, setType] = useState("in");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    const ok = await onUpdate(product, { quantity: parseInt(quantity), type, notes });
    setSubmitting(false);
    if (ok) onClose();
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal--small">
        <div className="modal-header"><h2 className="modal-title">Sesuaikan Stok — {product.name}</h2></div>
        <div className="modal-body">
          <div className="text-sm text-muted mb-3">Stok saat ini: <b>{formatQty(product.stock)} {product.unit}</b></div>
          <div className="form-group">
            <label className="form-label">Jenis Perubahan</label>
            <select className="form-select" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="in">Tambah Stok (masuk)</option>
              <option value="out">Kurangi Stok (keluar/rusak)</option>
              <option value="adjustment">Set Ulang ke Jumlah Tertentu</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">{type === "adjustment" ? "Jumlah Baru" : "Jumlah"}</label>
            <input type="number" className="form-input" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Catatan (opsional)</label>
            <input className="form-input" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Batal</button>
          <button className="btn btn-primary" onClick={submit} disabled={submitting}>{submitting ? "Menyimpan..." : "Simpan"}</button>
        </div>
      </div>
    </div>
  );
}