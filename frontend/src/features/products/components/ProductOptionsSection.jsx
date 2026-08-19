// src/features/products/components/ProductOptionsSection.jsx
import { Plus } from "lucide-react";
import UnitConversionRow from "./UnitConversionRow";
import VariantRow from "./VariantRow";
import UnitProfitSummary from "./UnitProfitSummary";
import { getAvailableUnitsForRow } from "../utils/productFormHelper";

// Menentukan apa yang muncul di popup kasir saat produk ini diklik: tanpa
// opsi (langsung masuk keranjang), satuan tambahan (mis. Pcs/Lusin/Box),
// atau varian (mis. Es/Panas/Biasa) — saling eksklusif, lihat validasi di
// hooks.js (useProductForm.submit).
export default function ProductOptionsSection({ f, pr }) {
  return (
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
  );
}
