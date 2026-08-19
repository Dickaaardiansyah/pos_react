// src/features/products/components/InitialPurchaseSection.jsx
import { ChipSearchSelect } from "../../../components/UI";
import { formatRupiahInput, parseRupiahInput } from "../../../utils/format";

// Khusus tambah produk baru — sekali produk punya histori Pembelian, Harga
// Modal dihitung otomatis dari rata-rata bergerak. Kalau panel ini tetap
// ditampilkan saat Edit, fieldnya selalu kosong padahal Harga Modal sudah
// valid dari histori — dulu ini bikin admin isi ulang dan tanpa sadar
// menimpa Harga Modal yang benar. Koreksi Harga Modal saat edit cukup lewat
// field Harga Modal langsung (lihat CostPriceField).
export default function InitialPurchaseSection({ f, pr }) {
  return (
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
  );
}
