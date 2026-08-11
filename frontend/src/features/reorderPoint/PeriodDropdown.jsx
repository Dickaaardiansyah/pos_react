// src/features/reorderPoint/PeriodDropdown.jsx
// ─────────────────────────────────────────────────────────────────────────────
// VIEW LAYER — dropdown kecil "Ubah periode" di halaman Rekomendasi Restock.
// Defaultnya sistem yang memilih periode (mode Otomatis, lihat hooks.js &
// productService.pickReorderWindow di backend). Dropdown ini cuma dipakai
// kalau user mau OVERRIDE manual ke periode tertentu.
// ─────────────────────────────────────────────────────────────────────────────
import { useRef, useState, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

const OPTIONS = [
  { value: null, label: "Otomatis (disarankan)" },
  { value: 7, label: "7 hari terakhir" },
  { value: 14, label: "14 hari terakhir" },
  { value: 30, label: "30 hari terakhir" },
  { value: 60, label: "60 hari terakhir" },
  { value: 90, label: "90 hari terakhir" },
];

export default function PeriodDropdown({ days, onChange }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="rop-period-dropdown" ref={wrapperRef}>
      <button type="button" className="rop-period-dropdown__trigger" onClick={() => setOpen((v) => !v)}>
        Ubah periode <ChevronDown size={14} />
      </button>
      {open && (
        <div className="rop-period-dropdown__panel">
          {OPTIONS.map((opt) => (
            <button
              key={opt.label}
              type="button"
              className={`rop-period-dropdown__option ${days === opt.value ? "rop-period-dropdown__option--active" : ""}`}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
            >
              {opt.label}
              {days === opt.value && <Check size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}