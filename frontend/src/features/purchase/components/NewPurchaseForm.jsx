// src/features/purchase/components/NewPurchaseForm.jsx
import { Paperclip, X } from "lucide-react";
import toast from "react-hot-toast";
import { usePurchaseForm } from "../hooks";
import { formatRupiah } from "../../../utils/format";
import PurchaseProductPicker from "./PurchaseProductPicker";
import PurchaseItemRow from "./PurchaseItemRow";

const MAX_NOTA_SIZE = 5 * 1024 * 1024;
const ALLOWED_NOTA_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export default function NewPurchaseForm({ products, suppliers, onSuccess }) {
  const f = usePurchaseForm(products, onSuccess);

  function handleSupplierChange(id) {
    f.setSupplierId(id);
    const supplier = suppliers.find((s) => String(s.id) === String(id));
    f.setSupplierName(supplier ? supplier.name : "");
  }

  function handleNotaChange(fileList) {
    const file = fileList?.[0];
    if (!file) { f.setNotaFile(null); return; }
    if (!ALLOWED_NOTA_TYPES.includes(file.type)) {
      toast.error("Format nota harus JPG, PNG, WEBP, atau PDF");
      return;
    }
    if (file.size > MAX_NOTA_SIZE) {
      toast.error("Ukuran file nota maksimal 5MB");
      return;
    }
    f.setNotaFile(file);
  }

  return (
    <div className="grid-2">
      <PurchaseProductPicker products={products} onAddItem={f.addItem} />

      <div className="card">
        <div className="chart-card__title">Detail Pembelian</div>
        <div className="form-group">
          <label className="form-label">Supplier</label>
          <select className="form-select" value={f.supplierId} onChange={(e) => handleSupplierChange(e.target.value)}>
            <option value="">Tanpa Supplier</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Tanggal Pembelian</label>
          <input type="date" className="form-input" value={f.purchaseDate} onChange={(e) => f.setPurchaseDate(e.target.value)} />
        </div>

        <div className="form-group">
          <label className="form-label">Cara Bayar</label>
          <div className="btn-group" style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className={`btn btn-sm ${f.paymentMethod === "tunai" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => f.setPaymentMethod("tunai")}
            >
              Tunai
            </button>
            <button
              type="button"
              className={`btn btn-sm ${f.paymentMethod === "kredit" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => f.setPaymentMethod("kredit")}
            >
              Kredit (Hutang)
            </button>
          </div>
          {f.paymentMethod === "kredit" && (
            <div className="text-xs text-muted mt-1">
              Stok tetap bertambah, kas tidak berkurang. Faktur hutang otomatis dibuat berstatus Belum Lunas.
            </div>
          )}
        </div>

        {f.paymentMethod === "tunai" && (
          <div className="form-group">
            <label className="form-label">Sumber Dana</label>
            <select
              className="form-select"
              value={f.paymentSource}
              onChange={(e) => f.setPaymentSource(e.target.value)}
            >
              <option value="laci">Kas Laci (Kasir yang sedang login)</option>
              <option value="kantor">Kas / Bank Kantor</option>
            </select>
            {f.paymentSource === "laci" ? (
              <div className="text-xs text-muted mt-1">
                Diambil dari sesi kas yang sedang terbuka. Pembelian ditolak kalau tidak ada sesi kas aktif atau saldo laci tidak cukup.
              </div>
            ) : (
              <div className="text-xs text-muted mt-1">
                Tidak tertaut ke laci kasir manapun. Pembelian ditolak kalau saldo akun yang dipilih tidak cukup.
              </div>
            )}
          </div>
        )}

        {f.paymentMethod === "tunai" && f.paymentSource === "kantor" && (
          <div className="form-group">
            <label className="form-label">Akun</label>
            <select
              className="form-select"
              value={f.targetAccount}
              onChange={(e) => f.setTargetAccount(e.target.value)}
            >
              <option value="kas">Kas</option>
              <option value="bank">Bank / Non-Tunai</option>
            </select>
          </div>
        )}

        {f.paymentMethod === "kredit" && (
          <div className="form-group">
            <label className="form-label">Jatuh Tempo Hutang</label>
            <input type="date" className="form-input" value={f.dueDate} onChange={(e) => f.setDueDate(e.target.value)} />
          </div>
        )}

        <div className="divider" />

        {f.items.length === 0 ? (
          <div className="text-sm text-muted">Belum ada produk dipilih</div>
        ) : (
          f.items.map((item) => (
            <PurchaseItemRow
              key={item.product_id}
              item={item}
              conversion={f.conversionOf(item)}
              baseQty={f.baseQtyOf(item)}
              onUpdateItem={f.updateItem}
              onUpdatePurchaseUnit={f.updatePurchaseUnit}
              onRemoveItem={f.removeItem}
            />
          ))
        )}

        <div className="divider" />
        <div className="statement-row"><span>Total Qty</span><span className="statement-value">{f.totalQty}</span></div>
        <div className="statement-row statement-row--total"><span>Total Biaya</span><span className="statement-value">{formatRupiah(f.totalCost)}</span></div>

        <div className="divider" />
        <div className="chart-card__title">Nota Supplier (opsional)</div>
        <div className="purchase-nota-upload">
          <label className="btn btn-ghost btn-sm" style={{ cursor: "pointer" }}>
            <Paperclip size={14} /> Unggah Nota
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              style={{ display: "none" }}
              onChange={(e) => handleNotaChange(e.target.files)}
            />
          </label>
          {f.notaFile ? (
            <>
              <span className="purchase-nota-filename">{f.notaFile.name}</span>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => f.setNotaFile(null)}><X size={14} /></button>
            </>
          ) : (
            <span className="purchase-nota-hint">Belum ada file — boleh dikosongkan</span>
          )}
        </div>

        <button className="btn btn-primary btn-lg w-full mt-3" onClick={() => f.submit()} disabled={f.submitting || f.items.length === 0}>
          {f.submitting ? "Menyimpan..." : "Simpan Pembelian"}
        </button>
      </div>
    </div>
  );
}