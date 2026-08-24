// src/features/customers/components/CustomerTable.jsx
// ─────────────────────────────────────────────────────────────────────────────
// PRESENTATION — Tabel daftar pelanggan dengan aksi edit & hapus.
// ─────────────────────────────────────────────────────────────────────────────
import { Pencil, Trash2, Phone, Mail } from "lucide-react";

export default function CustomerTable({ customers, onEdit, onRemove }) {
  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th>Nama</th><th>Telepon</th><th>Email</th><th>Alamat</th><th></th>
          </tr>
        </thead>
        <tbody>
          {customers.map((c) => (
            <tr key={c.id}>
              <td className="font-bold">{c.name}</td>
              <td>{c.phone ? <span className="flex items-center gap-1"><Phone size={12} />{c.phone}</span> : "-"}</td>
              <td>{c.email ? <span className="flex items-center gap-1"><Mail size={12} />{c.email}</span> : "-"}</td>
              <td className="text-sm text-muted">{c.address || "-"}</td>
              <td>
                <div className="flex gap-2">
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => onEdit(c)}><Pencil size={14} /></button>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => onRemove(c)}><Trash2 size={14} /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}