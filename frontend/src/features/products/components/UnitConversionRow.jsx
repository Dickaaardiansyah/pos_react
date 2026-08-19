// src/features/products/components/UnitConversionRow.jsx
import { X } from "lucide-react";
import { ChipSearchSelect } from "../../../components/UI";
import { formatRupiahInput, parseRupiahInput } from "../../../utils/format";
import { CONVERSION_QTY_OPTIONS } from "../utils/productFormHelper";
import ProfitBadge from "./ProfitBadge";

// Setiap satuan tambahan (mis. BOX, LUSIN) punya harga jual sendiri —
// bukan cuma faktor konversi — persis seperti "Def. Hrg Jual Satuan #1/#2"
// pada referensi. Baris harga hanya muncul begitu satuannya sudah dipilih.
export default function UnitConversionRow({
  row,
  units,
  baseUnitName,
  baseCostPrice,
  onCreateUnit,
  onSelect,
  onQtyChange,
  onPriceChange,
  onPriceWholesaleChange,
  onMinQtyWholesaleChange,
  onTogglePurchaseOnly,
  onClearSelection,
  onRemove,
}) {
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
