// src/features/products/components/BaseUnitRow.jsx
import { ChipSearchSelect } from "../../../components/UI";
import { formatRupiahInput, parseRupiahInput } from "../../../utils/format";
import ProfitBadge from "./ProfitBadge";

// Baris satuan dasar — pivot dari seluruh konversi satuan produk. Selalu
// tampil sebagai baris pertama di daftar Satuan, tidak bisa dihapus (setiap
// produk wajib punya satu satuan dasar), tapi tetap bisa diganti lewat chip ✕.
// Harga jual/grosir/jumlah minimum grosirnya ditampilkan langsung di sini
// (bukan field terpisah di luar daftar Satuan) supaya konsisten dengan
// satuan tambahan di bawahnya.
export default function BaseUnitRow({
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
