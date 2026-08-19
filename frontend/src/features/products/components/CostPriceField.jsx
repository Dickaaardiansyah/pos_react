// src/features/products/components/CostPriceField.jsx
import { formatRupiah, formatRupiahInput, parseRupiahInput } from "../../../utils/format";

export default function CostPriceField({ f, editProduct }) {
  return (
    <>
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
    </>
  );
}
