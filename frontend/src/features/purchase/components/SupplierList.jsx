// src/features/purchase/components/SupplierList.jsx
import { useState } from "react";
import { Truck } from "lucide-react";
import toast from "react-hot-toast";
import { EmptyState, SearchInput } from "../../../components/UI";
import { purchaseApi } from "../api";

export default function SupplierList({ suppliers, onReload }) {
  const [form, setForm] = useState({ name: "", phone: "", address: "" });
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");

  const filteredSuppliers = search
    ? suppliers.filter(
        (s) =>
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          (s.phone || "").toLowerCase().includes(search.toLowerCase()),
      )
    : suppliers;

  async function submit() {
    if (!form.name) { toast.error("Nama supplier wajib diisi"); return; }
    setSubmitting(true);
    try {
      await purchaseApi.createSupplier(form);
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
        {suppliers.length > 0 && (
          <SearchInput value={search} onChange={setSearch} placeholder="Cari nama atau telepon supplier..." className="mb-3 w-full" />
        )}
        {suppliers.length === 0 ? (
          <EmptyState icon={Truck} title="Belum ada supplier" />
        ) : filteredSuppliers.length === 0 ? (
          <EmptyState icon={Truck} title="Tidak ditemukan" description={`Tidak ada supplier yang cocok dengan "${search}"`} />
        ) : (
          filteredSuppliers.map((s) => (
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
