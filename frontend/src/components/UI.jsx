// src/components/UI.jsx
// ─────────────────────────────────────────────────────────────────────────────
// VIEW LAYER — komponen UI generik yang dipakai berbagai halaman. Murni
// presentasional: tidak ada pemanggilan model/API di sini. Semua gaya visual
// diambil dari class CSS semantik (lihat src/styles/components.css),
// bukan dari inline style seperti pada versi sebelumnya.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { X, AlertTriangle, CheckCircle, Info, Search, Plus } from "lucide-react";
import { formatRupiahInput, parseRupiahInput } from "../utils/format";

export function Spinner({ size = 20, tone = "accent" }) {
  return <div className={`ui-spinner ui-spinner--${tone}`} style={{ width: size, height: size }} />;
}

export function PageLoader({ text = "Memuat..." }) {
  return (
    <div className="ui-page-loader">
      <Spinner size={32} />
      <div className="ui-page-loader__text">{text}</div>
    </div>
  );
}

/**
 * Input uang generik: tampil terformat ala Rupiah saat mengetik ("5.000"),
 * tapi meneruskan nilai NUMBER (atau "" kalau kosong) lewat onChange — jadi
 * pemanggil tidak perlu peduli parsing/format sendiri. Dipakai di semua
 * field nominal (diskon, pembayaran, harga beli, piutang/hutang, jurnal,
 * beban, kas kecil, dll.) supaya konsisten di seluruh aplikasi.
 *
 * onChange menerima (value: number | "") — bukan event — supaya drop-in
 * ganti dari <input type="number" ... onChange={(e) => setX(e.target.value)} />
 * cukup jadi <RupiahInput ... onChange={(v) => setX(v)} />.
 */
export function RupiahInput({ value, onChange, className = "form-input", placeholder = "0", ...props }) {
  const display = value === "" || value === null || value === undefined ? "" : formatRupiahInput(value);
  return (
    <input
      type="text"
      inputMode="numeric"
      className={className}
      placeholder={placeholder}
      value={display}
      onChange={(e) => onChange(e.target.value === "" ? "" : parseRupiahInput(e.target.value))}
      {...props}
    />
  );
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="ui-empty-state">
      {Icon && <Icon size={48} className="ui-empty-state__icon" />}
      <div className="ui-empty-state__title">{title}</div>
      {description && <div className="ui-empty-state__description">{description}</div>}
      {action}
    </div>
  );
}

export function ConfirmDialog({ title, message, onConfirm, onCancel, danger = false, loading = false }) {
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal modal--small">
        <div className="modal-header">
          <div className="ui-confirm-dialog__heading">
            <AlertTriangle size={18} className={danger ? "ui-icon-danger" : "ui-icon-warning"} />
            <h2 className="modal-title">{title}</h2>
          </div>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onCancel}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <p className="ui-confirm-dialog__message">{message}</p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onCancel} disabled={loading}>Batal</button>
          <button className={`btn ${danger ? "btn-danger" : "btn-primary"}`} onClick={onConfirm} disabled={loading}>
            {loading ? <Spinner size={16} tone="white" /> : null}
            {loading ? "Memproses..." : "Konfirmasi"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function StatCard({ icon: Icon, tone = "blue", label, value, change, changeTone = "neutral", valueTone, onClick, tooltip }) {
  const clickable = typeof onClick === "function";
  return (
    <div
      className={`stat-card${clickable ? " stat-card--clickable" : ""}`}
      data-tone={tone}
      onClick={onClick}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === "Enter") onClick(e); } : undefined}
    >
      <div className={`stat-icon stat-icon--${tone}`}>
        <Icon size={20} />
      </div>
      <div className="stat-info">
        <div className="label">
          {label}
          {tooltip && (
            <Info
              size={12}
              className="stat-info__tooltip-icon"
              title={tooltip}
              aria-label={tooltip}
            />
          )}
        </div>
        <div className={`value${valueTone ? ` value--${valueTone}` : ""}`}>{value}</div>
        {change && <div className={`change change--${changeTone}`}>{change}</div>}
      </div>
    </div>
  );
}

export function Badge({ children, variant = "blue" }) {
  return <span className={`badge badge-${variant}`}>{children}</span>;
}

export function SectionHeader({ title, subtitle, action }) {
  return (
    <div className="ui-section-header">
      <div>
        <div className="ui-section-header__title">{title}</div>
        {subtitle && <div className="ui-section-header__subtitle">{subtitle}</div>}
      </div>
      {action}
    </div>
  );
}

const ALERT_CONFIG = {
  info: { tone: "info", Icon: Info },
  success: { tone: "success", Icon: CheckCircle },
  warning: { tone: "warning", Icon: AlertTriangle },
  danger: { tone: "danger", Icon: AlertTriangle },
};

export function AlertBanner({ type = "info", title, message, onClose }) {
  const { tone, Icon } = ALERT_CONFIG[type];
  return (
    <div className={`ui-alert-banner ui-alert-banner--${tone}`}>
      <Icon size={16} className="ui-alert-banner__icon" />
      <div className="ui-alert-banner__body">
        {title && <div className="ui-alert-banner__title">{title}</div>}
        <div className="ui-alert-banner__message">{message}</div>
      </div>
      {onClose && (
        <button onClick={onClose} className="ui-alert-banner__close"><X size={14} /></button>
      )}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = "Cari...", className = "" }) {
  return (
    <div className={`ui-search-input ${className}`}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="ui-search-input__icon">
        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
      </svg>
      <input
        className="form-input ui-search-input__field"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

export function Pagination({ page, totalPages, total, limit, onPageChange }) {
  if (totalPages <= 1) return null;
  return (
    <div className="ui-pagination">
      <span className="ui-pagination__summary">
        Menampilkan {(page - 1) * limit + 1}–{Math.min(page * limit, total)} dari {total} data
      </span>
      <div className="ui-pagination__controls">
        <button className="btn btn-ghost btn-sm" onClick={() => onPageChange(1)} disabled={page === 1}>«</button>
        <button className="btn btn-ghost btn-sm" onClick={() => onPageChange(page - 1)} disabled={page === 1}>‹</button>
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          let p;
          if (totalPages <= 5) p = i + 1;
          else if (page <= 3) p = i + 1;
          else if (page >= totalPages - 2) p = totalPages - 4 + i;
          else p = page - 2 + i;
          return (
            <button key={p} className={`btn btn-sm ${p === page ? "btn-primary" : "btn-ghost"}`} onClick={() => onPageChange(p)}>{p}</button>
          );
        })}
        <button className="btn btn-ghost btn-sm" onClick={() => onPageChange(page + 1)} disabled={page === totalPages}>›</button>
        <button className="btn btn-ghost btn-sm" onClick={() => onPageChange(totalPages)} disabled={page === totalPages}>»</button>
      </div>
    </div>
  );
}

/**
 * Varian SearchCreateSelect yang menampilkan pilihan yang sudah terpilih
 * sebagai "chip" (mis. [ PCS ✕ ]) alih-alih teks polos di dalam input —
 * dipakai pada daftar Satuan Produk supaya setiap baris terasa konsisten:
 * belum dipilih → tampil kotak cari, sudah dipilih → tampil chip dengan
 * tombol ✕ untuk mengganti pilihan (lihat referensi UX satuan/konversi).
 */
export function ChipSearchSelect({
  options,
  selectedName,
  onInputChange,
  onSelect,
  onClear,
  onCreate,
  placeholder = "Cari/Pilih...",
  disabled = false,
}) {
  // BUG SEBELUMNYA: komponen ini selalu mengirim value="" (hardcoded) ke
  // SearchCreateSelect, jadi kotak inputnya "dikunci" React ke string kosong
  // di setiap render — user mengetik tapi karakternya langsung hilang lagi
  // (terasa seperti "tidak bisa diketik"), dan tombol "Simpan sebagai data
  // baru?" juga tidak pernah muncul karena query yang dibaca selalu kosong.
  // Pada Satuan Dasar (BaseUnitRow), masalahnya beda tapi akar sama: setiap
  // ketikan langsung ditulis ke `selectedName` lewat onInputChange, sehingga
  // komponen langsung "terkunci" balik ke tampilan chip setelah 1 karakter.
  //
  // Perbaikan: simpan teks yang sedang diketik (`query`) dan status
  // "sedang mengedit" (`editing`) di state lokal komponen ini sendiri, lepas
  // dari `selectedName` yang dikirim parent. Chip hanya ditampilkan kalau ada
  // selectedName DAN user tidak sedang mengedit — bukan setiap kali
  // selectedName berubah.
  const [editing, setEditing] = useState(!selectedName);
  const [query, setQuery] = useState(selectedName || "");

  useEffect(() => {
    if (!editing) setQuery(selectedName || "");
  }, [selectedName, editing]);

  function handleInputChange(text) {
    setQuery(text);
    onInputChange(text);
  }

  function handleSelect(option) {
    setEditing(false);
    setQuery(option.name);
    onSelect(option);
  }

  function startEditing() {
    setEditing(true);
    setQuery("");
    onInputChange("");
    onClear();
  }

  if (selectedName && !editing) {
    return (
      <div className="chip-search-select">
        <span className="chip-search-select__chip">
          {selectedName}
          {!disabled && (
            <button type="button" onClick={startEditing} className="chip-search-select__chip-remove">
              <X size={12} />
            </button>
          )}
        </span>
      </div>
    );
  }
  return (
    <SearchCreateSelect
      options={options}
      value={query}
      onInputChange={handleInputChange}
      onSelect={handleSelect}
      onCreate={onCreate}
      placeholder={placeholder}
      disabled={disabled}
    />
  );
}

/**
 * Kombobox "cari atau buat data baru" — dipakai untuk field Kategori & Satuan
 * pada form Produk supaya admin tidak perlu pindah halaman hanya untuk
 * menambah satu kategori/satuan baru (lihat referensi UX: ketik nama, kalau
 * belum ada tampilkan tombol "Simpan '...' sebagai data baru?").
 *
 * @param {Array<{id:number,name:string}>} options
 * @param {string} value - nama yang sedang terpilih/diketik (controlled dari parent)
 * @param {(text:string)=>void} onInputChange - dipanggil setiap kali teks berubah
 * @param {(option:{id:number,name:string})=>void} onSelect - dipanggil saat memilih data yang sudah ada
 * @param {(name:string)=>Promise<{id:number,name:string}>} onCreate - simpan data baru ke server
 */
export function SearchCreateSelect({
  options,
  value,
  onInputChange,
  onSelect,
  onCreate,
  placeholder = "Cari...",
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    function handleOutsideClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const query = (value || "").trim();
  const filtered = query
    ? options.filter((o) => o.name.toLowerCase().includes(query.toLowerCase()))
    : options;
  const exactMatch = options.some((o) => o.name.toLowerCase() === query.toLowerCase());

  function handleSelect(option) {
    onSelect(option);
    setOpen(false);
  }

  async function handleCreate() {
    if (!query || creating) return;
    setCreating(true);
    try {
      const created = await onCreate(query);
      handleSelect(created);
    } catch (e) {
      // biarkan pemanggil (presenter) yang menampilkan toast error
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="search-create-select" ref={wrapRef}>
      <div className="search-create-select__input-wrap">
        <input
          className="form-input"
          value={value || ""}
          onChange={(e) => { onInputChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
        />
        <Search size={14} className="search-create-select__icon" />
      </div>
      {open && !disabled && (
        <div className="search-create-select__dropdown">
          {filtered.length > 0 ? (
            <div className="search-create-select__list">
              {filtered.map((o) => (
                <button
                  type="button"
                  key={o.id}
                  className="search-create-select__item"
                  onClick={() => handleSelect(o)}
                >
                  {o.name}
                </button>
              ))}
            </div>
          ) : (
            <div className="search-create-select__empty">Tidak ditemukan data yang cocok</div>
          )}
          {query && !exactMatch && (
            <button
              type="button"
              className="search-create-select__create"
              onClick={handleCreate}
              disabled={creating}
            >
              <Plus size={14} />
              {creating ? "Menyimpan..." : `Simpan "${query}" sebagai data baru?`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}