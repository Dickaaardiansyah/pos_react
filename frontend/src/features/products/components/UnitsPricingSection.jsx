// src/features/products/components/UnitsPricingSection.jsx
import BaseUnitRow from "./BaseUnitRow";

export default function UnitsPricingSection({ f, pr }) {
  return (
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
  );
}
