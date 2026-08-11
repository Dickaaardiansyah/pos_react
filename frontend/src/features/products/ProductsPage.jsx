// src/features/products/ProductsPage.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Pencil, Trash2, PackagePlus, Barcode as BarcodeIcon, Tags, X, Settings2 } from "lucide-react";
import { useProducts } from "./hooks";
import { PageLoader, EmptyState, SearchInput, Badge, ChipSearchSelect, ConfirmDialog } from "../../components/UI";
import BarcodeModal from "../../components/BarcodeModal";
import { formatRupiah, formatQty, formatRupiahInput, parseRupiahInput } from "../../utils/format";

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
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(product)}><Pencil size={14} /></button>
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


// Baris satuan dasar — pivot dari seluruh konversi satuan produk. Selalu
// tampil sebagai baris pertama di daftar Satuan, tidak bisa dihapus (setiap
// produk wajib punya satu satuan dasar), tapi tetap bisa diganti lewat chip ✕.
// Harga jual/grosir/jumlah minimum grosirnya ditampilkan langsung di sini
// (bukan field terpisah di luar daftar Satuan) supaya konsisten dengan
// satuan tambahan di bawahnya.
// Diekspor (bukan lagi lokal ke modal) supaya dipakai ulang oleh
// ProductFormPage.jsx — form Tambah/Edit Produk sekarang halaman penuh,
// bukan modal bertab lagi.
export function BaseUnitRow({
  unitName,
  units,
  onCreateUnit,
  onSelect,
  onInputChange,
  price,
  costPrice,
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

      {Number(price) > 0 && Number(costPrice) > 0 && (
        <ProfitBadge price={Number(price)} costPrice={Number(costPrice)} unitName={unitName} />
      )}
    </div>
  );
}

// Selisih Harga Eceran - Harga Modal, dihitung ulang tiap kali salah satu
// berubah (baik cost_price manual maupun otomatis dari Harga Beli ÷ Isi).
// Ditampilkan hijau kalau untung, merah kalau rugi (harga jual < modal).
export function ProfitBadge({ price, costPrice, unitName }) {
  const profit = price - costPrice;
  const markup = costPrice > 0 ? (profit / costPrice) * 100 : 0;
  const tone = profit >= 0 ? "success" : "error";
  const dot = profit >= 0 ? "🟢" : "🔴";
  return (
    <div className={`form-hint form-hint--${tone}`} style={{ marginTop: 6 }}>
      <div>{dot} Untung {formatRupiah(Math.abs(profit))} / {unitName || "satuan dasar"}{profit < 0 ? " (rugi)" : ""}</div>
      <div>{dot} Markup {markup.toFixed(1).replace(/\.0$/, "")}%</div>
    </div>
  );
}

// Bandingkan potensi untung kalau 1 batch pembelian (mis. 1 Karung = 25 kg)
// dijual habis lewat masing-masing satuan yang tersedia — supaya kelihatan
// satuan mana yang marginnya paling tebal (mis. dipecah jadi ¼ kg biasanya
// untungnya lebih besar daripada dijual utuh per Karung). Batch acuannya
// otomatis dari baris satuan tambahan dengan nilai konversi TERBESAR (biasanya
// itu satuan beli/kemasan besarnya, mis. Karung=25 dibanding 1/2 kg=0,5).
export function buildUnitProfitSummary(form) {
  const validRows = form.additional_units.filter(
    (r) => r.unit_id && Number(r.conversion_qty) > 0,
  );
  if (validRows.length === 0) return null;

  const referenceRow = validRows.reduce(
    (max, r) => (Number(r.conversion_qty) > Number(max.conversion_qty) ? r : max),
    validRows[0],
  );
  const totalQty = Number(referenceRow.conversion_qty);
  const baseCost = Number(form.cost_price);
  if (!(baseCost > 0) || !(totalQty > 0)) return null;

  const totalModal = baseCost * totalQty;

  const sellableUnits = [
    { name: form.unit || "satuan dasar", conversionQty: 1, price: Number(form.price) },
    ...validRows.map((r) => ({
      name: r.unit_name,
      conversionQty: Number(r.conversion_qty),
      price: Number(r.price),
      purchaseOnly: !!r.purchase_only,
    })),
  ].filter((u) => u.price > 0 && !u.purchaseOnly);

  if (sellableUnits.length === 0) return null;

  const lines = sellableUnits.map((u) => {
    const unitsFit = totalQty / u.conversionQty;
    const revenue = unitsFit * u.price;
    const profit = revenue - totalModal;
    const markup = totalModal > 0 ? (profit / totalModal) * 100 : 0;
    return {
      name: u.name,
      price: u.price,
      isWholeBatchUnit: u.conversionQty === totalQty,
      unitsFit,
      revenue,
      profit,
      markup,
    };
  });

  return {
    referenceUnitName: referenceRow.unit_name,
    baseUnitName: form.unit || "satuan dasar",
    totalQty,
    totalModal,
    lines,
  };
}

export function UnitProfitSummary({ form }) {
  const summary = buildUnitProfitSummary(form);
  if (!summary) return null;

  return (
    <div className="unit-profit-summary">
      <div className="unit-profit-summary__title">
        Kesimpulan setara 1 {summary.referenceUnitName} ({formatQty(summary.totalQty)} {summary.baseUnitName})
      </div>
      <div className="unit-profit-summary__modal">Modal: {formatRupiah(summary.totalModal)}</div>
      {summary.lines.map((line) => {
        const tone = line.profit >= 0 ? "success" : "error";
        const dot = line.profit >= 0 ? "🟢" : "🔴";
        const desc = line.isWholeBatchUnit
          ? `Jika terjual sebagai ${line.name}`
          : `Jika seluruhnya dijual eceran @ ${formatRupiah(line.price)}/${line.name}`;
        return (
          <div key={line.name} className={`unit-profit-summary__line form-hint--${tone}`}>
            {dot} {desc}: {formatRupiah(line.revenue)} → {line.profit >= 0 ? "Untung" : "Rugi"}{" "}
            {formatRupiah(Math.abs(line.profit))} (Markup {line.markup.toFixed(1).replace(/\.0$/, "")}%)
          </div>
        );
      })}
    </div>
  );
}

// Setiap satuan tambahan (mis. BOX, LUSIN) punya harga jual sendiri —
// bukan cuma faktor konversi — persis seperti "Def. Hrg Jual Satuan #1/#2"
// pada referensi. Baris harga hanya muncul begitu satuannya sudah dipilih.

export function VariantRow({ row, onChange, onRemove, canRemove }) {
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

// Satuan dasar (Harga & Satuan) dan satuan yang sudah dipakai di baris lain
// tidak boleh muncul lagi di dropdown "Cari/Pilih..." baris ini — supaya
// user tidak bisa pilih satuan yang sama dua kali (sebelumnya bug: "kg"
// yang sudah jadi satuan dasar masih muncul lagi di daftar pilihan).
export function getAvailableUnitsForRow(units, form, currentIndex) {
  const taken = new Set(
    [
      form.unit,
      ...form.additional_units
        .filter((_, i) => i !== currentIndex)
        .map((r) => r.unit_name),
    ]
      .filter(Boolean)
      .map((n) => n.trim().toLowerCase()),
  );
  return units.filter((u) => !taken.has((u.name || "").trim().toLowerCase()));
}

// Pilihan cepat untuk kolom nilai konversi (mis. "= 0,5 kg") — dropdown murni
// tanpa isi manual, supaya user awam tidak perlu tahu bentuk desimal dari
// pecahan seperti ¼ atau ½. Mencakup pecahan satuan dasar (jual eceran lebih
// kecil, mis. ½ kg) sampai kelipatan umum (jual dalam kemasan besar, mis.
// Karung = 25 kg).
const CONVERSION_QTY_OPTIONS = [
  { label: "¼", value: 0.25 },
  { label: "½", value: 0.5 },
  { label: "¾", value: 0.75 },
  { label: "1", value: 1 },
  { label: "2", value: 2 },
  { label: "3", value: 3 },
  { label: "4", value: 4 },
  { label: "5", value: 5 },
  { label: "6", value: 6 },
  { label: "8", value: 8 },
  { label: "10", value: 10 },
  { label: "12", value: 12 },
  { label: "15", value: 15 },
  { label: "20", value: 20 },
  { label: "24", value: 24 },
  { label: "25", value: 25 },
  { label: "30", value: 30 },
  { label: "50", value: 50 },
  { label: "100", value: 100 },
];

export function UnitConversionRow({ row, units, baseUnitName, baseCostPrice, onCreateUnit, onSelect, onQtyChange, onPriceChange, onPriceWholesaleChange, onMinQtyWholesaleChange, onTogglePurchaseOnly, onClearSelection, onRemove }) {
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
        <select
          className="form-select unit-conversion-row__qty"
          value={row.conversion_qty === "" || row.conversion_qty == null ? "" : row.conversion_qty}
          onChange={(e) => onQtyChange(e.target.value === "" ? "" : Number(e.target.value))}
          disabled={!row.unit_id}
        >
          <option value="">Pilih...</option>
          {/* Kalau produk lama punya nilai konversi di luar daftar preset
              (mis. diinput manual sebelum field ini jadi dropdown), tetap
              ditampilkan sebagai pilihan supaya tidak terlihat kosong. */}
          {row.conversion_qty &&
            !CONVERSION_QTY_OPTIONS.some((opt) => opt.value === Number(row.conversion_qty)) && (
              <option value={row.conversion_qty}>{row.conversion_qty}</option>
            )}
          {CONVERSION_QTY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <span className="unit-conversion-row__base">{baseUnitName}</span>
        <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={onRemove} title="Hapus baris satuan ini">
          <X size={14} />
        </button>
      </div>

      {row.unit_id && (
        <>
          <label className="form-hint" style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={!row.purchase_only}
              onChange={(e) => onTogglePurchaseOnly(!e.target.checked)}
            />
            Jual satuan {row.unit_name} ini ke pembeli (tampil di kasir)
            {row.purchase_only && (
              <span className="text-muted"> — saat ini disembunyikan, cuma dipakai untuk konversi Pembelian</span>
            )}
          </label>
          <div className="unit-conversion-row__prices">
            <div className="unit-conversion-row__price-field">
              <label className="form-label form-label--sm">
                Harga Jual / {row.unit_name} {!row.purchase_only && <span className="text-danger">*</span>}
              </label>
              <input
                type="text"
                inputMode="numeric"
                className="form-input"
                value={row.price === "" || row.price == null ? "" : formatRupiahInput(row.price)}
                onChange={(e) => onPriceChange(e.target.value === "" ? "" : parseRupiahInput(e.target.value))}
                placeholder={row.purchase_only ? "Kosongkan jika tidak dijual satuan ini" : "0"}
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

        {/* Modal per satuan ini = Harga Modal satuan dasar × nilai konversi
            (mis. Harga Modal 14.000/kg, satuan "1/2 kg" konversi 0,5 → modal
            7.000). Dihitung ulang otomatis, sama seperti indikator untung di
            satuan dasar. */}
        {!row.purchase_only && Number(row.price) > 0 && Number(baseCostPrice) > 0 && Number(row.conversion_qty) > 0 && (
          <ProfitBadge
            price={Number(row.price)}
            costPrice={Number(baseCostPrice) * Number(row.conversion_qty)}
            unitName={row.unit_name}
          />
        )}
        </>
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