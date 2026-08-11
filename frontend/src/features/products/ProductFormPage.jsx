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
import { ArrowLeft, Plus, Sparkles } from "lucide-react";
import { useProducts, useProductForm } from "./hooks";
import { PageLoader, SearchCreateSelect, ChipSearchSelect } from "../../components/UI";
import { formatRupiah, formatQty, formatRupiahInput, parseRupiahInput } from "../../utils/format";
import {
  BaseUnitRow,
  UnitConversionRow,
  UnitProfitSummary,
  VariantRow,
  getAvailableUnitsForRow,
} from "./ProductsPage";

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
  // <ProductFormFields> di bawah, setelah editProduct ini siap — kalau
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
    <ProductFormFields
      key={isEdit ? id : "create"}
      isEdit={isEdit}
      editProduct={editProduct}
      pr={pr}
      goBack={goBack}
    />
  );
}

function ProductFormFields({ isEdit, editProduct, pr, goBack }) {
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
                    options={pr.categories}
                    value={categoryQuery}
                    onInputChange={(text) => { setCategoryQuery(text); f.setField("category_id", ""); }}
                    onSelect={selectCategory}
                    onCreate={pr.addCategory}
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

          {activeTab === "harga" && (
            <>
              {/* ─── Harga & Satuan ─────────────────────────────────────── */}
              {/* Khusus tambah produk baru — sekali produk punya histori
                  Pembelian, Harga Modal dihitung otomatis dari rata-rata
                  bergerak. Kalau panel ini tetap ditampilkan saat Edit,
                  fieldnya selalu kosong padahal Harga Modal sudah valid dari
                  histori — dulu ini bikin admin isi ulang dan tanpa sadar
                  menimpa Harga Modal yang benar. Koreksi Harga Modal saat
                  edit cukup lewat field Harga Modal langsung di bawah. */}
              {!editProduct && (
                <div className="form-group">
                  <label className="form-label">Info Pembelian Awal (opsional)</label>
                  <div className="form-hint mb-2">
                    Isi ini kalau kamu beli dalam satuan besar (mis. Karung) tapi jual dalam satuan
                    kecil (mis. Kg). Modal per {f.form.unit || "satuan dasar"} di bawah akan dihitung
                    otomatis: Harga Beli ÷ Isi. Satuan pembelian ini juga otomatis tersedia lagi di
                    dropdown &quot;Satuan Beli&quot; saat input Pembelian berikutnya.
                  </div>
                  <div className="grid-3">
                    <div className="unit-conversion-row__unit">
                      <ChipSearchSelect
                        options={pr.units}
                        selectedName={f.form.initial_purchase_unit_name}
                        onInputChange={(text) =>
                          f.setInitialPurchase({ initial_purchase_unit_id: null, initial_purchase_unit_name: text })
                        }
                        onSelect={(option) =>
                          f.setInitialPurchase({
                            initial_purchase_unit_id: option.id,
                            initial_purchase_unit_name: option.name,
                          })
                        }
                        onClear={() => f.setInitialPurchase({ initial_purchase_unit_id: null, initial_purchase_unit_name: "" })}
                        onCreate={pr.addUnit}
                        placeholder="Satuan Beli (mis. Karung)"
                      />
                    </div>
                    <input
                      type="text"
                      inputMode="numeric"
                      className="form-input"
                      placeholder={`Isi (${f.form.unit || "satuan dasar"})`}
                      value={f.form.initial_purchase_conversion_qty}
                      onChange={(e) =>
                        f.setInitialPurchase({ initial_purchase_conversion_qty: e.target.value.replace(/[^0-9.]/g, "") })
                      }
                    />
                    <input
                      type="text"
                      inputMode="numeric"
                      className="form-input"
                      placeholder="Harga Beli (total, mis. 350.000)"
                      value={
                        f.form.initial_purchase_price === "" || f.form.initial_purchase_price == null
                          ? ""
                          : formatRupiahInput(f.form.initial_purchase_price)
                      }
                      onChange={(e) =>
                        f.setInitialPurchase({
                          initial_purchase_price: e.target.value === "" ? "" : parseRupiahInput(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>
              )}

              {editProduct && (
                <div className="form-hint mb-2">
                  Mau koreksi konversi satuan pembelian (mis. Karung = 25 kg)? Atur di bagian{" "}
                  <b>Opsi Produk</b> di bawah → Satuan Tambahan. Harga Modal di bawah ini sudah
                  dihitung otomatis dari rata-rata bergerak riwayat Pembelian — ubah manual hanya
                  kalau memang perlu koreksi.
                </div>
              )}

              <div className="form-group">
                <label className="form-label">
                  Harga Modal {f.form.cost_price !== "" && f.form.initial_purchase_unit_id && <span title="Otomatis dari Harga Beli ÷ Isi">🔒</span>}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="form-input"
                  disabled={f.form.initial_purchase_unit_id && f.form.cost_price !== ""}
                  value={f.form.cost_price === "" || f.form.cost_price == null ? "" : formatRupiahInput(f.form.cost_price)}
                  onChange={(e) => f.setField("cost_price", e.target.value === "" ? "" : parseRupiahInput(e.target.value))}
                />
                <div className="form-hint">
                  {f.form.initial_purchase_unit_id ? (
                    f.form.cost_price !== "" ? (
                      <>Otomatis dari Harga Beli ÷ Isi di atas. Kosongkan Satuan Beli kalau mau isi manual.</>
                    ) : (
                      <>Lengkapi Isi &amp; Harga Beli di atas dulu supaya Modal terhitung otomatis — atau kosongkan
                      Satuan Beli untuk isi Modal manual di sini.</>
                    )
                  ) : (
                    <>Dipakai untuk hitung laba &amp; laporan Laba Rugi. Nilai ini normalnya dihitung otomatis
                    sebagai rata-rata bergerak setiap ada pembelian masuk — ubah manual di sini hanya untuk
                    koreksi data awal, karena perubahan manual akan ikut jadi dasar perhitungan rata-rata
                    pembelian berikutnya.</>
                  )}
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
                    units={pr.units}
                    onCreateUnit={pr.addUnit}
                    onSelect={f.selectBaseUnit}
                    onInputChange={(text) => f.setField("unit", text)}
                    price={f.form.price}
                    costPrice={f.form.cost_price}
                    priceWholesale={f.form.price_wholesale}
                    minQtyWholesale={f.form.min_qty_wholesale}
                    onPriceChange={(price) => f.setField("price", price)}
                    onPriceWholesaleChange={(price_wholesale) => f.setField("price_wholesale", price_wholesale)}
                    onMinQtyWholesaleChange={(min_qty_wholesale) => f.setField("min_qty_wholesale", min_qty_wholesale)}
                  />
                </div>
                {f.optionMode === "unit" && (
                  <div className="form-hint mt-2">
                    Satuan tambahan (BOX, LUSIN, dll.) diatur di bagian <b>Opsi Produk</b> di bawah.
                  </div>
                )}
              </div>

              {/* ─── Opsi Produk (digabung di tab ini) ─────────────────── */}
              <div className="product-form-section">
                <div className="product-form-section__title">Opsi Produk</div>
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

                {f.optionMode === "unit" && (
                  <div className="form-group mt-3">
                    <label className="form-label">Satuan tambahan</label>
                    <div className="form-hint mb-2">
                      Baris pertama di atas otomatis jadi satuan dasar (dipakai mencatat stok).
                      Tambahkan satuan lain di sini beserta konversi &amp; harganya — mis. BOX = 12
                      berarti 1 BOX setara 12 satuan dasar.
                    </div>
                    <div className="unit-conversion-list">
                      {f.form.additional_units.map((row, index) => (
                        <UnitConversionRow
                          key={index}
                          row={row}
                          units={getAvailableUnitsForRow(pr.units, f.form, index)}
                          baseUnitName={f.form.unit || "satuan dasar"}
                          baseCostPrice={f.form.cost_price}
                          onCreateUnit={pr.addUnit}
                          onSelect={(option) => f.selectAdditionalUnit(index, option)}
                          onQtyChange={(qty) => f.updateUnitRow(index, { conversion_qty: qty })}
                          onPriceChange={(price) => f.updateUnitRow(index, { price })}
                          onPriceWholesaleChange={(price_wholesale) => f.updateUnitRow(index, { price_wholesale })}
                          onMinQtyWholesaleChange={(min_qty_wholesale) => f.updateUnitRow(index, { min_qty_wholesale })}
                          onTogglePurchaseOnly={(purchase_only) => f.updateUnitRow(index, { purchase_only })}
                          onClearSelection={() => f.clearUnitRowSelection(index)}
                          onRemove={() => f.removeUnitRow(index)}
                        />
                      ))}
                    </div>
                    <button type="button" className="btn btn-ghost btn-sm mt-2" onClick={f.addUnitRow}>
                      <Plus size={14} /> Tambah Satuan
                    </button>
                    <UnitProfitSummary form={f.form} />
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
              </div>

              {/* ─── Stok (digabung di tab ini) ────────────────────────── */}
              <div className="product-form-section">
                <div className="product-form-section__title">Stok</div>
                <div className="grid-2">
                  {!editProduct && (
                    <div className="form-group">
                      <label className="form-label">
                        Stok Awal {f.form.unit ? `(dalam ${f.form.unit})` : ""}
                      </label>
                      <div className="input-with-suffix">
                        <input
                          type="number"
                          min="0"
                          className="form-input"
                          value={f.form.stock}
                          onChange={(e) => { setStockInPurchaseUnit(""); f.setField("stock", e.target.value); }}
                        />
                        {f.form.unit && <span className="input-with-suffix__suffix">{f.form.unit}</span>}
                      </div>
                      <div className="form-hint">
                        Stok selalu dicatat dalam satuan dasar ({f.form.unit || "satuan dasar"}), bukan
                        satuan pembelian.
                      </div>

                      {f.form.initial_purchase_unit_id && f.form.initial_purchase_conversion_qty ? (
                        <div className="mt-2">
                          <label className="form-label form-label--sm">
                            Atau isi dalam satuan pembelian ({f.form.initial_purchase_unit_name})
                          </label>
                          <div className="input-with-suffix">
                            <input
                              type="number"
                              min="0"
                              className="form-input"
                              value={stockInPurchaseUnit}
                              onChange={(e) => handleStockInPurchaseUnitChange(e.target.value)}
                              placeholder={`mis. 6 ${f.form.initial_purchase_unit_name}`}
                            />
                            <span className="input-with-suffix__suffix">{f.form.initial_purchase_unit_name}</span>
                          </div>
                          {stockInPurchaseUnit && Number(stockInPurchaseUnit) > 0 && (
                            <div className="form-hint">
                              = {formatQty(f.form.stock)} {f.form.unit} (1 {f.form.initial_purchase_unit_name} = {formatQty(f.form.initial_purchase_conversion_qty)} {f.form.unit})
                            </div>
                          )}
                        </div>
                      ) : null}
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
              </div>
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