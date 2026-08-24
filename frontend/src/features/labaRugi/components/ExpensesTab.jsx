// src/features/labaRugi/components/ExpensesTab.jsx
// ─────────────────────────────────────────────────────────────────────────────
// PRESENTATION — Tab "Biaya Operasional": filter tanggal, tabel biaya, dan
// tombol catat/edit yang membuka ExpenseFormModal.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { EmptyState, SectionHeader } from "../../../components/UI";
import { formatRupiah, formatDate } from "../../../utils/format";
import ExpenseFormModal from "./ExpenseFormModal";

export default function ExpensesTab({ lr }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const highlightRef = useRef(null);

  function openCreate() { setEditing(null); setShowForm(true); }
  function openEdit(expense) { setEditing(expense); setShowForm(true); }

  const totalExpense = lr.expenses.reduce((s, e) => s + Number(e.amount), 0);

  // FIX (revisi dosen — poin 1, traceability jurnal → transaksi asal): kalau
  // datang dari link "lihat transaksi" di Jurnal Umum, scroll & tandai baris
  // biaya yang dimaksud supaya langsung kelihatan tanpa perlu dicari manual.
  useEffect(() => {
    if (lr.highlightExpenseId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [lr.highlightExpenseId, lr.expenses]);

  return (
    <div>
      <div className="filter-bar">
        <input type="date" className="form-input" value={lr.startDate} onChange={(e) => lr.setStartDate(e.target.value)} />
        <span className="text-muted text-sm">s/d</span>
        <input type="date" className="form-input" value={lr.endDate} onChange={(e) => lr.setEndDate(e.target.value)} />
      </div>

      <SectionHeader
        title={`Biaya Operasional (Total: ${formatRupiah(totalExpense)})`}
        subtitle="Sewa, gaji, listrik, dan biaya lain di luar HPP"
        action={<button className="btn btn-primary btn-sm" onClick={openCreate}><Plus size={14} /> Catat Biaya</button>}
      />

      {lr.expenses.length === 0 ? (
        <EmptyState title="Belum ada catatan biaya" description="Tambahkan biaya operasional untuk periode ini" />
      ) : (
        <div className="table-container">
          <table>
            <thead><tr><th>Tanggal</th><th>Kategori</th><th>Keterangan</th><th>Jumlah</th><th></th></tr></thead>
            <tbody>
              {lr.expenses.map((e) => {
                const isHighlighted = lr.highlightExpenseId === e.id;
                return (
                  <tr
                    key={e.id}
                    ref={isHighlighted ? highlightRef : null}
                    style={isHighlighted ? { outline: "2px solid var(--accent-blue, #3b82f6)", background: "rgba(59,130,246,0.08)" } : undefined}
                  >
                    <td className="text-sm">{formatDate(e.expense_date)}</td>
                    <td>{lr.categories.find((c) => c.id === e.category)?.label || e.category}</td>
                    <td className="text-sm">{e.description || "-"}</td>
                    <td className="font-mono font-bold">{formatRupiah(e.amount)}</td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(e)}><Pencil size={14} /></button>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => lr.removeExpense(e)}><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <ExpenseFormModal
          categories={lr.categories}
          editExpense={editing}
          onSubmit={editing ? (payload) => lr.updateExpense(editing.id, payload) : lr.createExpense}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}