// src/features/customers/CustomersPage.jsx
// ─────────────────────────────────────────────────────────────────────────────
// VIEW LAYER — Pelanggan: daftar, tambah, edit, dan hapus data pelanggan.
// Halaman ini hanya menyusun tata letak & state UI untuk buka/tutup modal —
// seluruh state data ada di useCustomers/useCustomerForm.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { Plus, Users } from "lucide-react";
import { useCustomers } from "./hooks";
import { PageLoader, EmptyState, SearchInput } from "../../components/UI";
import CustomerTable from "./components/CustomerTable";
import CustomerFormModal from "./components/CustomerFormModal";

export default function Customers() {
  const cp = useCustomers();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  function openCreate() { setEditing(null); setShowForm(true); }
  function openEdit(customer) { setEditing(customer); setShowForm(true); }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Pelanggan</div>
          <div className="page-subtitle">{cp.customers.length} pelanggan terdaftar</div>
        </div>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={16} /> Tambah Pelanggan</button>
      </div>

      <div className="page-body">
        <div className="filter-bar">
          <SearchInput value={cp.search} onChange={cp.setSearch} placeholder="Cari nama, telepon, atau email..." className="w-full" />
        </div>

        {cp.loading ? (
          <PageLoader text="Memuat pelanggan..." />
        ) : cp.customers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Belum ada pelanggan"
            description="Tambahkan data pelanggan pertama Anda"
            action={<button className="btn btn-primary" onClick={openCreate}>Tambah Pelanggan</button>}
          />
        ) : (
          <CustomerTable customers={cp.customers} onEdit={openEdit} onRemove={cp.removeCustomer} />
        )}
      </div>

      {showForm && (
        <CustomerFormModal
          editCustomer={editing}
          onSuccess={cp.reload}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}