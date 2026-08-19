// src/features/reports/components/ReportFilterBar.jsx
import { QUICK_RANGE_OPTIONS, PERIOD_OPTIONS } from "../hooks";

export default function ReportFilterBar({ r }) {
  if (r.reportType === "penjualanHarian") {
    return (
      <div className="filter-bar">
        <span className="text-muted text-sm">Tanggal</span>
        <input type="date" className="form-input" value={r.dailyDate} onChange={(e) => r.setDailyDate(e.target.value)} />
      </div>
    );
  }

  if (r.reportType === "labaProduk") {
    return (
      <div className="filter-bar">
        <select className="form-select" value={r.quickRange} onChange={(e) => r.selectQuickRange(e.target.value)}>
          {QUICK_RANGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <input type="date" className="form-input" value={r.profitStartDate} onChange={(e) => r.setProfitStartDate(e.target.value)} />
        <span className="text-muted text-sm">s/d</span>
        <input type="date" className="form-input" value={r.profitEndDate} onChange={(e) => r.setProfitEndDate(e.target.value)} />
      </div>
    );
  }

  if (r.reportType === "barangExpired") {
    return (
      <div className="filter-bar">
        <input type="date" className="form-input" value={r.startDate} onChange={(e) => r.setStartDate(e.target.value)} />
        <span className="text-muted text-sm">s/d</span>
        <input type="date" className="form-input" value={r.endDate} onChange={(e) => r.setEndDate(e.target.value)} />
        <select className="form-select" value={r.expiredStatus} onChange={(e) => r.setExpiredStatus(e.target.value)}>
          <option value="">Semua status</option>
          <option value="expired">Sudah expired</option>
          <option value="warning">Mendekati</option>
          <option value="safe">Aman</option>
        </select>
        <input
          type="number"
          className="form-input"
          style={{ width: 80 }}
          value={r.thresholdDays}
          onChange={(e) => r.setThresholdDays(Number(e.target.value) || 30)}
          title="Ambang hari"
        />
        <span className="text-muted text-sm">hari</span>
      </div>
    );
  }

  if (r.reportType === "barangKeluar") {
    return (
      <div className="filter-bar">
        <input type="date" className="form-input" value={r.startDate} onChange={(e) => r.setStartDate(e.target.value)} />
        <span className="text-muted text-sm">s/d</span>
        <input type="date" className="form-input" value={r.endDate} onChange={(e) => r.setEndDate(e.target.value)} />
        <select className="form-select" value={r.stockOutJenis} onChange={(e) => r.setStockOutJenis(e.target.value)}>
          <option value="">Semua jenis</option>
          <option value="penjualan">Penjualan</option>
          <option value="stock_opname">Stock Opname</option>
          <option value="penyesuaian_manual">Penyesuaian Manual</option>
          <option value="retur">Retur</option>
        </select>
      </div>
    );
  }

  if (["penjualan", "penjualanPeriode", "barangMasuk", "pembelian", "pembelianSupplier"].includes(r.reportType)) {
    return (
      <div className="filter-bar">
        <select className="form-select" value={r.period} onChange={(e) => r.setPeriod(e.target.value)}>
          {PERIOD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <input type="date" className="form-input" value={r.startDate} onChange={(e) => r.setStartDate(e.target.value)} />
        <span className="text-muted text-sm">s/d</span>
        <input type="date" className="form-input" value={r.endDate} onChange={(e) => r.setEndDate(e.target.value)} />
      </div>
    );
  }

  if (r.reportType === "piutangFakturBelumLunas") {
    const customers = Array.isArray(r.customersList) ? r.customersList : [];
    return (
      <div className="filter-bar">
        <select className="form-select" value={r.piutangCustomerId || ""} onChange={(e) => r.setPiutangCustomerId(e.target.value)}>
          <option value="">Semua pelanggan</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>{c.name || c.customer_name}</option>
          ))}
        </select>
      </div>
    );
  }
  if (r.reportType === "piutangRiwayat") {
    const customers = Array.isArray(r.customersList) ? r.customersList : [];
    return (
      <div className="filter-bar">
        <input type="date" className="form-input" value={r.startDate} onChange={(e) => r.setStartDate(e.target.value)} />
        <span className="text-muted text-sm">s/d</span>
        <input type="date" className="form-input" value={r.endDate} onChange={(e) => r.setEndDate(e.target.value)} />
        <select className="form-select" value={r.piutangCustomerId || ""} onChange={(e) => r.setPiutangCustomerId(e.target.value)}>
          <option value="">Semua pelanggan</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>{c.name || c.customer_name}</option>
          ))}
        </select>
      </div>
    );
  }
  if (["piutangPerPelanggan", "piutangAging"].includes(r.reportType)) {
    return null;
  }
  if (r.reportType === "transaksiVoid") {
    const cashiers = Array.isArray(r.cashiersList) ? r.cashiersList : [];
    return (
      <div className="filter-bar">
        <input type="date" className="form-input" value={r.startDate} onChange={(e) => r.setStartDate(e.target.value)} />
        <span className="text-muted text-sm">s/d</span>
        <input type="date" className="form-input" value={r.endDate} onChange={(e) => r.setEndDate(e.target.value)} />
        <select className="form-select" value={r.cashierFilter || ""} onChange={(e) => r.setCashierFilter(e.target.value)}>
          <option value="">Semua kasir</option>
          {cashiers.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>
    );
  }
  // default date range
  return (
    <div className="filter-bar">
      <input type="date" className="form-input" value={r.startDate} onChange={(e) => r.setStartDate(e.target.value)} />
      <span className="text-muted text-sm">s/d</span>
      <input type="date" className="form-input" value={r.endDate} onChange={(e) => r.setEndDate(e.target.value)} />
    </div>
  );
}
