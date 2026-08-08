// src/features/purchase/PurchasePage.jsx
import { useState } from "react";
import { Plus, Trash2, Eye, X, Truck, Paperclip, FileText } from "lucide-react";
import { usePurchase, usePurchaseForm } from "./hooks";
import { purchaseApi as purchaseModel } from "./api";
import { PageLoader, EmptyState, SearchInput, Pagination, Badge, RupiahInput } from "../../components/UI";
import { formatRupiah, formatDate, formatQty } from "../../utils/format";
import toast from "react-hot-toast";

const TABS = [
  { id: "list", label: "Riwayat Pembelian" },
  { id: "new", label: "Pembelian Baru" },
  { id: "suppliers", label: "Supplier" },
];

const MAX_NOTA_SIZE = 5 * 1024 * 1024;
const ALLOWED_NOTA_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

const PAYABLE_STATUS_BADGE = { belum_lunas: "red", sebagian: "orange", lunas: "green" };
const PAYABLE_STATUS_LABEL = { belum_lunas: "Belum Lunas", sebagian: "Sebagian", lunas: "Lunas" };

export default function Purchase() {
  const pu = usePurchase();

  if (pu.loading) return <PageLoader text="Memuat data pembelian..." />;

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Pembelian Stok</div>
          <div className="page-subtitle">Catat barang masuk dari supplier</div>
        </div>
      </div>

      <div className="page-body">
        <div className="tab-nav">
          {TABS.map((t) => (
            <button key={t.id} className={`tab-btn ${pu.tab === t.id ? "active" : ""}`} onClick={() => pu.setTab(t.id)}>{t.label}</button>
          ))}
        </div>

        {pu.tab === "list" && <PurchaseList pu={pu} />}
        {pu.tab === "new" && <NewPurchaseForm products={pu.products} suppliers={pu.suppliers} onSuccess={pu.reload} />}
        {pu.tab === "suppliers" && <SupplierList suppliers={pu.suppliers} onReload={pu.reload} />}
      </div>

      {pu.selected && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && pu.setSelected(null)}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Detail Pembelian</h2>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => pu.setSelected(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="statement-row"><span>Kode</span><span className="font-mono">{pu.selected.purchase_code}</span></div>
              <div className="statement-row"><span>Tanggal</span><span>{formatDate(pu.selected.purchase_date)}</span></div>
              <div className="statement-row"><span>Supplier</span><span>{pu.selected.supplier_name || pu.selected.supplier_name_ref || "-"}</span></div>
              <div className="statement-row">
                <span>Cara Bayar</span>
                <span>
                  <Badge variant={pu.selected.payment_method === "kredit" ? "orange" : "green"}>
                    {pu.selected.payment_method === "kredit" ? "Kredit" : "Tunai"}
                  </Badge>
                </span>
              </div>
              {pu.selected.payment_method === "kredit" && (
                <>
                  <div className="statement-row"><span>Jatuh Tempo</span><span>{formatDate(pu.selected.due_date)}</span></div>
                  <div className="statement-row">
                    <span>Status Hutang</span>
                    <span>
                      {pu.selected.payable_status ? (
                        <Badge variant={PAYABLE_STATUS_BADGE[pu.selected.payable_status]}>{PAYABLE_STATUS_LABEL[pu.selected.payable_status]}</Badge>
                      ) : "-"}
                    </span>
                  </div>
                </>
              )}
              {pu.selected.nota_url && (
                <div className="statement-row">
                  <span>Nota Supplier</span>
                  <a className="purchase-nota-preview" href={pu.selected.nota_url} target="_blank" rel="noreferrer">
                    <FileText size={14} /> Lihat file
                  </a>
                </div>
              )}
              <div className="divider" />
              {pu.selected.items?.map((item) => (
                <div key={item.id} className="statement-row">
                  <span>{item.product_name} x{formatQty(item.quantity)}</span>
                  <span className="statement-value">{formatRupiah(item.subtotal_cost)}</span>
                </div>
              ))}
              <div className="divider" />
              <div className="statement-row statement-row--total"><span>Total Biaya</span><span className="statement-value">{formatRupiah(pu.selected.total_cost)}</span></div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => pu.setSelected(null)}>Tutup</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PurchaseList({ pu }) {
  if (pu.purchases.length === 0) return <EmptyState icon={Truck} title="Belum ada pembelian" description="Catat pembelian stok pertama Anda" />;
  return (
    <>
      <div className="table-container">
        <table>
          <thead><tr><th>Kode</th><th>Tanggal</th><th>Supplier</th><th>Total Item</th><th>Total Biaya</th><th>Cara Bayar</th><th>Nota</th><th></th></tr></thead>
          <tbody>
            {pu.purchases.map((p) => (
              <tr key={p.id}>
                <td className="font-mono text-xs">{p.purchase_code}</td>
                <td className="text-sm">{formatDate(p.purchase_date)}</td>
                <td>{p.supplier_name || p.supplier_name_ref || "-"}</td>
                <td>{formatQty(p.total_qty)}</td>
                <td className="font-mono font-bold">{formatRupiah(p.total_cost)}</td>
                <td>
                  {p.payment_method === "kredit" ? (
                    <Badge variant={PAYABLE_STATUS_BADGE[p.payable_status] || "orange"}>
                      Kredit{p.payable_status ? ` • ${PAYABLE_STATUS_LABEL[p.payable_status]}` : ""}
                    </Badge>
                  ) : (
                    <Badge variant="green">Tunai</Badge>
                  )}
                </td>
                <td>{p.nota_url ? <a href={p.nota_url} target="_blank" rel="noreferrer" title="Lihat nota"><FileText size={14} /></a> : <span className="text-muted text-xs">-</span>}</td>
                <td><button className="btn btn-ghost btn-icon btn-sm" onClick={() => pu.viewDetail(p.id)}><Eye size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={pu.page} totalPages={Math.max(1, Math.ceil(pu.total / 20))} total={pu.total} limit={20} onPageChange={pu.setPage} />
    </>
  );
}

function NewPurchaseForm({ products, suppliers, onSuccess }) {
  const f = usePurchaseForm(products, onSuccess);
  const [search, setSearch] = useState("");

  const filteredProducts = products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

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
      <div className="card">
        <div className="chart-card__title">Pilih Produk</div>
        <SearchInput value={search} onChange={setSearch} placeholder="Cari produk..." className="mb-3 w-full" />
        <div className="purchase-product-list">
          {filteredProducts.map((p) => (
            <div key={p.id} className="cart-item" style={{ cursor: "pointer" }} onClick={() => f.addItem(p)}>
              <div style={{ flex: 1 }}>
                <div className="cart-item-name">{p.name}</div>
                <div className="cart-item-price">Modal: {formatRupiah(p.cost_price)} • Stok: {formatQty(p.stock)} {p.unit}</div>
              </div>
              <Plus size={16} />
            </div>
          ))}
        </div>
      </div>

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
          f.items.map((item) => {
            const hasPackaging = item.additional_units?.length > 0;
            const conv = f.conversionOf(item);
            const baseQty = f.baseQtyOf(item);
            const purchaseUnitLabel = item.purchase_unit_id
              ? item.additional_units.find((u) => String(u.unit_id) === String(item.purchase_unit_id))?.unit_name
              : item.base_unit;
            return (
              <div key={item.product_id} className="purchase-item-row">
                <div style={{ flex: 1, width: "100%" }}>
                  <div className="cart-item-name">{item.product_name}</div>
                  <div className="purchase-item-fields">
                    {hasPackaging && (
                      <div className="purchase-item-field">
                        <label>Satuan Beli</label>
                        <select
                          className="form-select"
                          value={item.purchase_unit_id}
                          onChange={(e) => f.updatePurchaseUnit(item.product_id, e.target.value)}
                        >
                          <option value="">{item.base_unit} (satuan dasar)</option>
                          {item.additional_units.map((u) => (
                            <option key={u.unit_id} value={u.unit_id}>
                              {u.unit_name} (1 = {u.conversion_qty} {item.base_unit})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="purchase-item-field">
                      <label>Qty {hasPackaging ? `(${purchaseUnitLabel})` : ""}</label>
                      <input
                        type="number" step="0.001" min="0" className="form-input"
                        value={item.purchase_qty}
                        onChange={(e) => f.updateItem(item.product_id, "purchase_qty", e.target.value)}
                      />
                    </div>
                    <div className="purchase-item-field">
                      <label>Harga Modal / {purchaseUnitLabel}</label>
                      <RupiahInput value={item.unit_cost} onChange={(v) => f.updateItem(item.product_id, "unit_cost", v)} />
                    </div>
                    <div className="purchase-item-field">
                      <label>Kadaluarsa</label>
                      <input type="date" className="form-input" value={item.expiry_date || ""} onChange={(e) => f.updateItem(item.product_id, "expiry_date", e.target.value)} />
                    </div>
                  </div>
                  {conv !== 1 && (
                    <div className="text-xs text-muted mt-1">
                      = {formatQty(baseQty)} {item.base_unit} ditambahkan ke stok
                    </div>
                  )}
                </div>
                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => f.removeItem(item.product_id)}><Trash2 size={14} /></button>
              </div>
            );
          })
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

function SupplierList({ suppliers, onReload }) {
  const [form, setForm] = useState({ name: "", phone: "", address: "" });
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!form.name) { toast.error("Nama supplier wajib diisi"); return; }
    setSubmitting(true);
    try {
      await purchaseModel.createSupplier(form);
      toast.success("Supplier ditambahkan");
      setForm({ name: "", phone: "", address: "" });
      onReload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid-2">
      <div className="card">
        <div className="chart-card__title">Tambah Supplier</div>
        <div className="form-group">
          <label className="form-label">Nama Supplier</label>
          <input className="form-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">No. Telepon</label>
          <input className="form-input" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Alamat</label>
          <textarea className="form-textarea" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
        </div>
        <button className="btn btn-primary w-full" onClick={submit} disabled={submitting}>{submitting ? "Menyimpan..." : "Tambah Supplier"}</button>
      </div>

      <div className="card">
        <div className="chart-card__title">Daftar Supplier ({suppliers.length})</div>
        {suppliers.length === 0 ? <EmptyState icon={Truck} title="Belum ada supplier" /> : (
          suppliers.map((s) => (
            <div key={s.id} className="cart-item">
              <div style={{ flex: 1 }}>
                <div className="cart-item-name">{s.name}</div>
                <div className="cart-item-price">{s.phone || "-"}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}