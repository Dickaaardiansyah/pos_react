// src/features/stockOpname/components/NewOpnameForm.jsx
import { useStockOpnameForm } from "../hooks";
import { formatRupiah } from "../../../utils/format";
import OpnameProductPicker from "./OpnameProductPicker";
import OpnameItemsTable from "./OpnameItemsTable";

export default function NewOpnameForm({ onSuccess }) {
  const f = useStockOpnameForm(onSuccess);
  const selectedIds = new Set(f.items.map((i) => i.product_id));

  return (
    <div>
      <div className="grid-2 mb-4">
        <div className="card">
          <div className="chart-card__title">Informasi Sesi</div>
          <div className="form-group">
            <label className="form-label">Tanggal Stock Opname</label>
            <input type="date" className="form-input" value={f.opnameDate} onChange={(e) => f.setOpnameDate(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Catatan (opsional)</label>
            <input className="form-input" value={f.notes} onChange={(e) => f.setNotes(e.target.value)} placeholder="Mis. Opname akhir bulan" />
          </div>
        </div>

        <div className="card">
          <div className="chart-card__title">Ringkasan Selisih</div>
          <div className="statement-row"><span>Produk Diperiksa</span><span className="statement-value">{f.items.length}</span></div>
          <div className="statement-row"><span>Produk Selisih</span><span className="statement-value">{f.totalSelisihItems}</span></div>
          <div className="statement-row"><span>Total Selisih Qty</span><span className="statement-value">{f.totalDifferenceQty > 0 ? "+" : ""}{f.totalDifferenceQty}</span></div>
          <div className="statement-row statement-row--total">
            <span>Total Nilai Selisih</span>
            <span className="statement-value">{formatRupiah(f.totalDifferenceValue)}</span>
          </div>
        </div>
      </div>

      <OpnameProductPicker
        products={f.products}
        loading={f.loadingProducts}
        selectedIds={selectedIds}
        onAddItem={f.addItem}
        onAddAllVisible={f.addAllVisible}
      />

      <div className="card">
        <div className="chart-card__title">Daftar Pemeriksaan Stok</div>
        <OpnameItemsTable items={f.items} onUpdateItem={f.updateItem} onRemoveItem={f.removeItem} />

        <button className="btn btn-primary btn-lg w-full mt-4" onClick={f.submit} disabled={f.submitting || f.items.length === 0}>
          {f.submitting ? "Menyimpan..." : "Simpan Stock Opname"}
        </button>
      </div>
    </div>
  );
}
