// src/features/products/components/StockSection.jsx
import { formatQty } from "../../../utils/format";

export default function StockSection({
  f,
  editProduct,
  stockInPurchaseUnit,
  onStockInPurchaseUnitChange,
  onStockChange,
}) {
  return (
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
                onChange={(e) => onStockChange(e.target.value)}
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
                    onChange={(e) => onStockInPurchaseUnitChange(e.target.value)}
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
  );
}
