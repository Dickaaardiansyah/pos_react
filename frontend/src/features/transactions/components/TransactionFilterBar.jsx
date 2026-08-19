// src/features/transactions/components/TransactionFilterBar.jsx
import { Calendar, CalendarDays, Circle } from "lucide-react";
import { SearchInput } from "../../../components/UI";

const QUICK_FILTERS = [
  { value: "today", label: "Hari Ini", icon: Calendar },
  { value: "all", label: "Semua", icon: CalendarDays },
  { value: "custom", label: "Custom", icon: Circle },
];

export default function TransactionFilterBar({
  search,
  onSearchChange,
  quickFilter,
  onQuickFilterChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  paymentMethod,
  onPaymentMethodChange,
  statusFilter,
  onStatusFilterChange,
  onReset,
}) {
  return (
    <div className="filter-bar">
      <SearchInput
        value={search}
        onChange={onSearchChange}
        placeholder="Cari kode transaksi, kasir, atau nama pelanggan..."
        className="w-full"
      />

      <div className="quick-filter-group">
        {QUICK_FILTERS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            className={`quick-filter-btn${quickFilter === value ? " quick-filter-btn--active" : ""}`}
            onClick={() => onQuickFilterChange(value)}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {quickFilter === "custom" && (
        <>
          <input type="date" className="form-input" value={startDate} onChange={(e) => onStartDateChange(e.target.value)} />
          <input type="date" className="form-input" value={endDate} onChange={(e) => onEndDateChange(e.target.value)} />
        </>
      )}

      <select className="form-select tx-method-select" value={paymentMethod} onChange={(e) => onPaymentMethodChange(e.target.value)}>
        <option value="">Semua Metode</option>
        <option value="cash">Tunai</option>
        <option value="debit">Debit/Kredit</option>
        <option value="qris">QRIS</option>
      </select>

      <select className="form-select tx-method-select" value={statusFilter} onChange={(e) => onStatusFilterChange(e.target.value)}>
        <option value="completed">Selesai</option>
        <option value="cancelled">Dibatalkan</option>
        <option value="all">Semua Status</option>
      </select>

      <button className="btn btn-ghost btn-sm" onClick={onReset}>Reset</button>
    </div>
  );
}
