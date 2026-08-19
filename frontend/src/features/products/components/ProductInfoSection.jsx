// src/features/products/components/ProductInfoSection.jsx
import { Sparkles } from "lucide-react";
import { SearchCreateSelect } from "../../../components/UI";

export default function ProductInfoSection({ f, pr, categoryQuery, onCategoryQueryChange, onSelectCategory }) {
  return (
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
            onInputChange={(text) => { onCategoryQueryChange(text); f.setField("category_id", ""); }}
            onSelect={onSelectCategory}
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
  );
}
