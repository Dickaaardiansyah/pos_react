// src/components/ShiftModals.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Modal-modal seputar sesi kas (shift) yang dipakai bersama oleh beberapa
// tempat: Sidebar (tombol "Selesai Shift"), halaman Kasir (gerbang awal),
// dan halaman Kas Kecil/Biaya. Disatukan di sini supaya perilakunya konsisten
// di mana pun dipicu.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { X, Delete, Lock, CheckCircle2 } from "lucide-react";
import { formatRupiah } from "../utils/format";
import { AlertBanner, RupiahInput } from "./UI";

// ─── Buka Kas — input modal awal lewat keypad, mirip aplikasi kasir POS ────
export function OpenShiftModal({ opening, onSubmit, onClose }) {
  const [digits, setDigits] = useState(""); // string angka mentah, tanpa format

  const amount = digits === "" ? 0 : Number(digits);

  function press(d) {
    if (digits.length >= 12) return; // batas wajar, cegah overflow tampilan
    setDigits((prev) => (prev === "0" ? d : prev + d));
  }
  function backspace() {
    setDigits((prev) => prev.slice(0, -1));
  }
  function clearAll() {
    setDigits("");
  }

  async function handleSubmit() {
    if (amount <= 0) return;
    const ok = await onSubmit({ openingBalance: amount, openingNotes: "" });
    if (ok) onClose();
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal--small numpad-modal">
        <div className="modal-header">
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} disabled={opening}><X size={18} /></button>
          <h2 className="modal-title">Masukkan Modal</h2>
          <span style={{ width: 34 }} />
        </div>

        <div className="modal-body">
          <div className="numpad-display">
            <div className="numpad-display__label">Masukkan Modal</div>
            <div className="numpad-display__value">{formatRupiah(amount)}</div>
          </div>
        </div>

        <div className="numpad">
          <button className="numpad__key" onClick={() => press("1")}>1</button>
          <button className="numpad__key" onClick={() => press("2")}>2</button>
          <button className="numpad__key" onClick={() => press("3")}>3</button>
          <button className="numpad__key numpad__key--muted" onClick={clearAll}>C</button>

          <button className="numpad__key" onClick={() => press("4")}>4</button>
          <button className="numpad__key" onClick={() => press("5")}>5</button>
          <button className="numpad__key" onClick={() => press("6")}>6</button>
          <button className="numpad__key numpad__key--muted" onClick={backspace}><Delete size={18} /></button>

          <button className="numpad__key" onClick={() => press("7")}>7</button>
          <button className="numpad__key" onClick={() => press("8")}>8</button>
          <button className="numpad__key" onClick={() => press("9")}>9</button>
          <button
            className="numpad__key numpad__key--action"
            onClick={handleSubmit}
            disabled={amount <= 0 || opening}
          >
            {opening ? "..." : "Lanjut"}
          </button>

          <button className="numpad__key numpad__key--wide" onClick={() => press("000")}>000</button>
          <button className="numpad__key" onClick={() => press("0")}>0</button>
        </div>
      </div>
    </div>
  );
}

// ─── Tutup Kas — rekonsiliasi kas fisik vs sistem ───────────────────────────
export function CloseShiftModal({ shift, closing, onSubmit, onClose }) {
  const [physical, setPhysical] = useState("");
  const [notes, setNotes] = useState("");

  const previewDifference = physical === "" ? null : Number(physical) - shift.expected_balance;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal--small">
        <div className="modal-header">
          <h2 className="modal-title">Tutup Kas — Selesai Shift</h2>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="statement-row"><span>Estimasi Saldo Sistem</span><span className="statement-value">{formatRupiah(shift.expected_balance)}</span></div>
          <div className="divider" />
          <div className="form-group">
            <label className="form-label">Hasil Hitung Kas Fisik (Rp)</label>
            <RupiahInput placeholder="Hitung uang tunai di laci" value={physical} onChange={(v) => setPhysical(v)} autoFocus />
          </div>
          {previewDifference !== null && (
            <div className={`statement-row ${previewDifference === 0 ? "" : previewDifference > 0 ? "statement-row--positive" : "statement-row--negative"}`}>
              <span>Selisih</span>
              <span className="statement-value">{previewDifference > 0 ? "+" : ""}{formatRupiah(previewDifference)}</span>
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Catatan (opsional)</label>
            <input className="form-input" placeholder="Mis. Selisih karena pembulatan kembalian" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={closing}>Batal</button>
          <button className="btn btn-primary" onClick={() => onSubmit({ closingBalancePhysical: physical, closingNotes: notes })} disabled={closing}>
            <Lock size={16} /> {closing ? "Menutup..." : "Tutup Kas"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Hasil rekonsiliasi setelah tutup kas ───────────────────────────────────
export function CloseResultModal({ shift, onClose }) {
  const diff = Number(shift.difference);
  const isMatch = diff === 0;
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal--small">
        <div className="modal-header">
          <h2 className="modal-title">Hasil Tutup Kas — {shift.shift_code}</h2>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <AlertBanner
            type={isMatch ? "success" : "warning"}
            title={isMatch ? "Kas Sesuai" : "Kas Tidak Sesuai"}
            message={
              isMatch
                ? "Saldo fisik sama persis dengan saldo sistem."
                : diff > 0
                  ? `Kas fisik lebih ${formatRupiah(Math.abs(diff))} dari saldo sistem.`
                  : `Kas fisik kurang ${formatRupiah(Math.abs(diff))} dari saldo sistem.`
            }
          />
          <div className="statement-row"><span>Modal Awal</span><span className="statement-value">{formatRupiah(shift.opening_balance)}</span></div>
          <div className="statement-row"><span>Total Penjualan Tunai</span><span className="statement-value">{formatRupiah(shift.total_cash_sales)}</span></div>
          <div className="statement-row"><span>Total Kas Masuk</span><span className="statement-value text-positive">+{formatRupiah(shift.total_cash_in)}</span></div>
          <div className="statement-row"><span>Total Kas Keluar</span><span className="statement-value text-negative">-{formatRupiah(shift.total_cash_out)}</span></div>
          <div className="statement-row statement-row--total"><span>Saldo Sistem</span><span className="statement-value">{formatRupiah(shift.closing_balance_system)}</span></div>
          <div className="statement-row"><span>Kas Fisik</span><span className="statement-value">{formatRupiah(shift.closing_balance_physical)}</span></div>
          <div className={`statement-row ${isMatch ? "" : diff > 0 ? "statement-row--positive" : "statement-row--negative"}`}>
            <span>Selisih</span><span className="statement-value">{diff > 0 ? "+" : ""}{formatRupiah(diff)}</span>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary w-full" onClick={onClose}><CheckCircle2 size={16} /> Selesai</button>
        </div>
      </div>
    </div>
  );
}