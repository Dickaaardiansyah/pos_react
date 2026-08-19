// src/features/products/components/VariantRow.jsx
import { X } from "lucide-react";
import { formatRupiahInput, parseRupiahInput } from "../../../utils/format";

export default function VariantRow({ row, onChange, onRemove, canRemove }) {
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
