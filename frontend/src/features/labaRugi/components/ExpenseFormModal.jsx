// src/features/labaRugi/components/ExpenseFormModal.jsx
// ─────────────────────────────────────────────────────────────────────────────
// PRESENTATION — Modal catat/edit biaya operasional.
//
// Sumber dana (payment_source: 'laci' | 'kantor') HANYA relevan saat MENCATAT
// biaya baru — accountingService.updateExpense tidak menyentuh shift/sumber
// dana sama sekali (cuma expense_date/category/description/amount), jadi
// field ini disembunyikan saat mode edit.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { RupiahInput } from "../../../components/UI";
import { EMPTY_EXPENSE_FORM } from "../hooks";
import { journalApi } from "../../journal/api";
import { cashRegisterApi } from "../../cashRegister/api";
import { queryKeys } from "../../../lib/queryClient";

function formatRupiah(n) {
  return Number(n || 0).toLocaleString("id-ID");
}

export default function ExpenseFormModal({ categories, editExpense, onSubmit, onClose }) {
  const isEdit = !!editExpense;
  const [form, setForm] = useState(
    isEdit
      ? { ...editExpense }
      : { ...EMPTY_EXPENSE_FORM, payment_source: "laci", shift_id: "", target_account: "kas" },
  );
  const [submitting, setSubmitting] = useState(false);

  function setField(name, value) { setForm((f) => ({ ...f, [name]: value })); }

  // ── Sumber dana (hanya saat catat baru) ──────────────────────────────────
  const cashBalancesQuery = useQuery({
    queryKey: queryKeys.journalCashBalances(),
    queryFn: () => journalApi.getCashBalances(),
    enabled: !isEdit && form.payment_source === "kantor",
  });
  const openShiftsQuery = useQuery({
    queryKey: queryKeys.cashRegisterOpenShifts(),
    queryFn: () => cashRegisterApi.getOpenShifts(),
    enabled: !isEdit && form.payment_source === "laci",
  });
  const openShifts = openShiftsQuery.data?.data ?? [];

  useEffect(() => {
    if (isEdit || form.payment_source !== "laci") return;
    if (openShifts.length === 1 && !form.shift_id) {
      setForm((f) => ({ ...f, shift_id: String(openShifts[0].id) }));
    }
    if (form.shift_id && !openShifts.some((sh) => String(sh.id) === form.shift_id)) {
      setForm((f) => ({ ...f, shift_id: "" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.payment_source, openShifts.length]);

  const selectedShift = openShifts.find((sh) => String(sh.id) === form.shift_id);
  const cashBalances = cashBalancesQuery.data?.data ?? null;
  const balanceLoading =
    (form.payment_source === "kantor" && cashBalancesQuery.isLoading) ||
    (form.payment_source === "laci" && openShiftsQuery.isLoading);
  const availableBalance =
    form.payment_source === "laci"
      ? selectedShift
        ? Number(selectedShift.expected_balance)
        : null
      : cashBalances
        ? Number(cashBalances[form.target_account] ?? 0)
        : null;

  async function submit() {
    if (!isEdit && form.payment_source === "laci" && !form.shift_id) {
      return; // tombol sudah disabled untuk kasus ini, jaga-jaga saja
    }
    setSubmitting(true);
    const ok = await onSubmit(form);
    setSubmitting(false);
    if (ok) onClose();
  }

  const insufficientBalance =
    !isEdit &&
    availableBalance !== null &&
    availableBalance < Number(form.amount || 0);
  const canSubmit =
    isEdit ||
    (form.payment_source === "kantor" ||
      (form.payment_source === "laci" && !!form.shift_id));

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal--small">
        <div className="modal-header"><h2 className="modal-title">{isEdit ? "Edit Biaya" : "Catat Biaya Operasional"}</h2></div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Tanggal</label>
            <input type="date" className="form-input" value={form.expense_date} onChange={(e) => setField("expense_date", e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Kategori</label>
            <select className="form-select" value={form.category} onChange={(e) => setField("category", e.target.value)}>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Keterangan</label>
            <input className="form-input" value={form.description || ""} onChange={(e) => setField("description", e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Jumlah (Rp)</label>
            <RupiahInput value={form.amount} onChange={(v) => setField("amount", v)} />
          </div>

          {!isEdit && (
            <div className="form-group">
              <label className="form-label">Sumber Dana</label>
              <select
                className="form-select"
                value={form.payment_source}
                onChange={(e) => setField("payment_source", e.target.value)}
              >
                <option value="laci">Kas Laci (laci kasir yang sedang terbuka)</option>
                <option value="kantor">Kas Kantor</option>
              </select>

              {form.payment_source === "laci" ? (
                <>
                  <div className="text-xs text-muted mt-1 mb-2">
                    Diambil dari sesi kas kasir yang sedang terbuka. Ditolak kalau tidak ada sesi kas aktif atau saldo laci tidak cukup.
                  </div>
                  {openShifts.length > 1 && (
                    <select
                      className="form-select mb-2"
                      value={form.shift_id}
                      onChange={(e) => setField("shift_id", e.target.value)}
                    >
                      <option value="">Pilih laci...</option>
                      {openShifts.map((sh) => (
                        <option key={sh.id} value={sh.id}>
                          {sh.cashier_name || sh.opened_by} — {formatRupiah(sh.expected_balance)}
                        </option>
                      ))}
                    </select>
                  )}
                  {balanceLoading ? (
                    <div className="text-xs text-muted mb-2">Memuat saldo laci...</div>
                  ) : openShifts.length === 0 ? (
                    <div className="text-xs text-danger mb-2">
                      Tidak ada sesi kas (laci) yang sedang terbuka.
                    </div>
                  ) : selectedShift ? (
                    <div className={`statement-row mb-2 ${insufficientBalance ? "text-danger" : ""}`}>
                      <span>Saldo Laci ({selectedShift.cashier_name || selectedShift.opened_by})</span>
                      <span className="statement-value">{formatRupiah(availableBalance)}</span>
                    </div>
                  ) : null}
                </>
              ) : (
                <>
                  <div className="text-xs text-muted mt-1 mb-2">
                    Tidak tertaut ke laci kasir manapun. Ditolak kalau saldo Kas Kantor tidak cukup.
                  </div>
                  {balanceLoading ? (
                    <div className="text-xs text-muted mb-2">Memuat saldo...</div>
                  ) : cashBalances ? (
                    <div className={`statement-row mb-2 ${insufficientBalance ? "text-danger" : ""}`}>
                      <span>Saldo Kas Kantor</span>
                      <span className="statement-value">{formatRupiah(availableBalance)}</span>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Batal</button>
          <button className="btn btn-primary" onClick={submit} disabled={submitting || !canSubmit}>{submitting ? "Menyimpan..." : "Simpan"}</button>
        </div>
      </div>
    </div>
  );
}