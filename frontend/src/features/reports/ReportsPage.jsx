// src/features/reports/ReportsPage.jsx
// ─────────────────────────────────────────────────────────────────────────────
// VIEW LAYER — Laporan (Keuangan → Laporan). Menyediakan 3 jenis laporan agar
// polanya konsisten dengan Laporan Laba Rugi: user memilih jenis laporan
// lewat ReportPicker, lalu mengatur filter & melihat/mencetak hasilnya.
// ─────────────────────────────────────────────────────────────────────────────
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import {
  TrendingUp, ShoppingCart, Percent, ChevronLeft, Printer, FileSpreadsheet,
  ShoppingBag, Truck, Users, PackageX, AlertTriangle, CheckCircle2,
  Wallet,
} from "lucide-react";
import {
  useReports, SALES_SORT_OPTIONS, PURCHASE_SORT_OPTIONS,
  QUICK_RANGE_OPTIONS, PROFIT_SORT_OPTIONS, CUSTOMER_SORT_OPTIONS,
} from "./hooks";
import { PageLoader, StatCard, SectionHeader, EmptyState, Badge } from "../../components/UI";
import { formatRupiah, formatDate, formatChartPeriod, formatNumber, formatQty } from "../../utils/format";
import { printTabularReport, exportTabularReportExcel } from "../../utils/printLaporan";

const REPORT_ICONS = {
  penjualan: TrendingUp,
  penjualanPelanggan: Users,
  labaProduk: Wallet,
  barangMasuk: Truck,
  barangExpired: PackageX,
};

export default function Reports() {
  const r = useReports();

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Laporan</div>
          <div className="page-subtitle">Penjualan, barang masuk, &amp; barang mendekati kadaluarsa</div>
        </div>
        {r.reportType && <ReportActions r={r} />}
      </div>

      <div className="page-body">
        {!r.reportType ? (
          <ReportPicker r={r} />
        ) : (
          <>
            <button className="btn btn-ghost btn-sm mb-3" onClick={r.backToPicker}>
              <ChevronLeft size={14} /> Pilih jenis laporan lain
            </button>
            <ReportFilterBar r={r} />
            {r.loading ? <PageLoader /> : <ReportContent r={r} />}
          </>
        )}
      </div>
    </div>
  );
}

// ── Pemilihan jenis laporan ─────────────────────────────────────────────────
function ReportPicker({ r }) {
  return (
    <div className="report-picker">
      {r.reportTypes.map((rt) => {
        const Icon = REPORT_ICONS[rt.id] || TrendingUp;
        return (
          <button key={rt.id} className="report-picker__item" onClick={() => r.selectReportType(rt.id)}>
            <span className="report-picker__icon"><Icon size={22} /></span>
            <span className="report-picker__text">
              <span className="report-picker__title">{rt.title}</span>
              <span className="report-picker__desc">{rt.description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── Filter bar per jenis laporan ────────────────────────────────────────────
function ReportFilterBar({ r }) {
  if (r.reportType === "penjualan" || r.reportType === "barangMasuk") {
    return (
      <div className="filter-bar">
        <select className="form-select" value={r.period} onChange={(e) => r.setPeriod(e.target.value)}>
          <option value="daily">Harian</option>
          <option value="weekly">Mingguan</option>
          <option value="monthly">Bulanan</option>
        </select>
        <input type="date" className="form-input" value={r.startDate} onChange={(e) => r.setStartDate(e.target.value)} />
        <span className="text-muted text-sm">s/d</span>
        <input type="date" className="form-input" value={r.endDate} onChange={(e) => r.setEndDate(e.target.value)} />
      </div>
    );
  }

  if (r.reportType === "penjualanPelanggan") {
    return (
      <div className="filter-bar">
        <input type="date" className="form-input" value={r.startDate} onChange={(e) => r.setStartDate(e.target.value)} />
        <span className="text-muted text-sm">s/d</span>
        <input type="date" className="form-input" value={r.endDate} onChange={(e) => r.setEndDate(e.target.value)} />
      </div>
    );
  }

  if (r.reportType === "labaProduk") {
    return (
      <div className="filter-bar flex-col items-start gap-2">
        <div className="quick-range-group">
          {QUICK_RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`btn btn-sm ${r.quickRange === opt.value ? "btn-primary" : "btn-ghost"}`}
              onClick={() => r.selectQuickRange(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="filter-bar" style={{ marginBottom: 0 }}>
          <input
            type="date"
            className="form-input"
            value={r.profitStartDate}
            disabled={r.quickRange !== "custom"}
            onChange={(e) => r.setProfitStartDate(e.target.value)}
          />
          <span className="text-muted text-sm">s/d</span>
          <input
            type="date"
            className="form-input"
            value={r.profitEndDate}
            disabled={r.quickRange !== "custom"}
            onChange={(e) => r.setProfitEndDate(e.target.value)}
          />
        </div>
      </div>
    );
  }

  if (r.reportType === "barangExpired") {
    return (
      <div className="filter-bar">
        <span className="text-muted text-sm">Kadaluarsa</span>
        <input type="date" className="form-input" value={r.startDate} onChange={(e) => r.setStartDate(e.target.value)} />
        <span className="text-muted text-sm">s/d</span>
        <input type="date" className="form-input" value={r.endDate} onChange={(e) => r.setEndDate(e.target.value)} />
        <select className="form-select" value={r.expiredStatus} onChange={(e) => r.setExpiredStatus(e.target.value)}>
          <option value="">Semua Status</option>
          <option value="expired">Sudah Kadaluarsa</option>
          <option value="soon">Akan Kadaluarsa</option>
          <option value="safe">Aman</option>
        </select>
        <span className="text-muted text-sm">Ambang &quot;akan kadaluarsa&quot;</span>
        <select className="form-select" style={{ width: 100 }} value={r.thresholdDays} onChange={(e) => r.setThresholdDays(Number(e.target.value))}>
          {[7, 14, 30, 60, 90].map((n) => <option key={n} value={n}>{n} hari</option>)}
        </select>
      </div>
    );
  }

  return null;
}

// ── Tombol cetak / ekspor, menyesuaikan jenis laporan aktif ───────────────
function ReportActions({ r }) {
  function handlePrint() {
    const { title, periodLabel, columns, rows, summary } = buildExportPayload(r);
    if (!rows) return;
    printTabularReport({ title, periodLabel, storeSettings: r.storeSettings, columns, rows, summary });
  }
  function handleExportExcel() {
    const { title, periodLabel, columns, rows, summary } = buildExportPayload(r);
    if (!rows) return;
    exportTabularReportExcel({ title, periodLabel, storeSettings: r.storeSettings, columns, rows, summary, filename: `${title.replace(/\s+/g, "_")}.xlsx` });
  }

  return (
    <div className="flex gap-2">
      <button className="btn btn-ghost btn-sm" onClick={handlePrint}><Printer size={14} /> Cetak</button>
      <button className="btn btn-ghost btn-sm" onClick={handleExportExcel}><FileSpreadsheet size={14} /> Export Excel</button>
    </div>
  );
}

function buildExportPayload(r) {
  if (r.reportType === "penjualan" && r.salesReport) {
    const s = r.salesReport.summary || {};
    return {
      title: "Laporan Penjualan",
      periodLabel: `${formatDate(r.startDate)} – ${formatDate(r.endDate)}`,
      columns: [
        { key: "name", label: "Produk" }, { key: "total_qty_sold", label: "Qty Jual" },
        { key: "total_qty_base", label: "Qty Dasar" }, { key: "total_revenue", label: "Pendapatan" },
      ],
      rows: (r.sortedSalesTopProducts || []).map((p) => ({
        name: p.name,
        total_qty_sold: `${formatQty(p.total_qty_sold)}×`,
        total_qty_base: `${formatQty(p.total_qty_base)}${p.base_unit ? ` ${p.base_unit}` : ""}`,
        total_revenue: formatRupiah(p.total_revenue),
      })),
      summary: [
        { label: "Total Pendapatan", value: formatRupiah(s.total_revenue || 0) },
        { label: "Total Transaksi", value: s.total_transactions || 0 },
        { label: "Rata-rata / Transaksi", value: formatRupiah(s.avg_transaction || 0) },
        { label: "Rata-rata Item / Transaksi", value: (s.avg_items_per_transaction || 0).toFixed(1) },
        { label: "Total Diskon", value: formatRupiah(s.total_discount || 0) },
      ],
    };
  }
  if (r.reportType === "penjualanPelanggan" && r.customerReport) {
    const s = r.customerReport.summary || {};
    return {
      title: "Laporan Penjualan per Pelanggan",
      periodLabel: `${formatDate(r.startDate)} – ${formatDate(r.endDate)}`,
      columns: [
        { key: "customer_name", label: "Pelanggan" }, { key: "transaction_count", label: "Transaksi" },
        { key: "total_qty", label: "Qty" }, { key: "total_revenue", label: "Pendapatan" },
        { key: "total_cogs", label: "HPP" }, { key: "total_profit", label: "Laba" },
      ],
      rows: (r.sortedCustomers || []).map((c) => ({
        customer_name: c.customer_name, transaction_count: c.transaction_count, total_qty: formatQty(c.total_qty),
        total_revenue: formatRupiah(c.total_revenue), total_cogs: formatRupiah(c.total_cogs),
        total_profit: formatRupiah(c.total_profit),
      })),
      summary: [
        { label: "Jumlah Pelanggan", value: s.total_customers || 0 },
        { label: "Total Transaksi", value: s.total_transactions || 0 },
        { label: "Total Pendapatan", value: formatRupiah(s.total_revenue || 0) },
        { label: "Total HPP", value: formatRupiah(s.total_cogs || 0) },
        { label: "Total Laba", value: formatRupiah(s.total_profit || 0) },
        { label: "Margin Laba", value: `${(s.margin_percent || 0).toFixed(1)}%` },
      ],
    };
  }
  if (r.reportType === "labaProduk" && r.profitReport) {
    const s = r.profitReport.summary || {};
    return {
      title: "Laporan Laba per Produk",
      periodLabel: `${formatDate(r.profitStartDate)} – ${formatDate(r.profitEndDate)}`,
      columns: [
        { key: "name", label: "Produk" }, { key: "total_qty_sold", label: "Qty Jual" },
        { key: "total_qty_base", label: "Qty Dasar" },
        { key: "total_revenue", label: "Pendapatan" }, { key: "total_cogs", label: "HPP" },
        { key: "total_profit", label: "Laba" }, { key: "margin_percent", label: "Margin" },
      ],
      rows: (r.sortedProfitProducts || []).map((p) => ({
        name: p.name,
        total_qty_sold: `${formatQty(p.total_qty_sold)}×`,
        total_qty_base: `${formatQty(p.total_qty_base)}${p.base_unit ? ` ${p.base_unit}` : ""}`,
        total_revenue: formatRupiah(p.total_revenue), total_cogs: formatRupiah(p.total_cogs),
        total_profit: formatRupiah(p.total_profit), margin_percent: `${p.margin_percent.toFixed(1)}%`,
      })),
      summary: [
        { label: "Total Pendapatan", value: formatRupiah(s.total_revenue || 0) },
        { label: "Total HPP", value: formatRupiah(s.total_cogs || 0) },
        { label: "Total Laba", value: formatRupiah(s.total_profit || 0) },
        { label: "Margin Laba", value: `${(s.margin_percent || 0).toFixed(1)}%` },
        { label: "Jumlah Produk", value: s.total_products || 0 },
      ],
    };
  }
  if (r.reportType === "barangMasuk" && r.purchaseReport) {
    const s = r.purchaseReport.summary || {};
    return {
      title: "Laporan Barang Masuk",
      periodLabel: `${formatDate(r.startDate)} – ${formatDate(r.endDate)}`,
      columns: [
        { key: "product_name", label: "Produk" }, { key: "total_qty", label: "Qty" }, { key: "total_cost", label: "Biaya" },
      ],
      rows: (r.sortedPurchaseTopProducts || []).map((p) => ({ product_name: p.product_name, total_qty: formatQty(p.total_qty), total_cost: formatRupiah(p.total_cost) })),
      summary: [
        { label: "Total Pembelian", value: s.total_purchases || 0 },
        { label: "Total Qty Masuk", value: formatQty(s.total_qty || 0) },
        { label: "Total Biaya", value: formatRupiah(s.total_cost || 0) },
        { label: "Total Supplier", value: s.total_suppliers || 0 },
      ],
    };
  }
  if (r.reportType === "barangExpired" && r.expiredReport) {
    const s = r.expiredReport.summary || {};
    return {
      title: "Laporan Barang Expired",
      periodLabel: `${formatDate(r.startDate)} – ${formatDate(r.endDate)}`,
      columns: [
        { key: "product_name", label: "Produk" }, { key: "purchase_code", label: "Kode Pembelian" },
        { key: "quantity", label: "Qty Batch" }, { key: "expiry_date_fmt", label: "Kadaluarsa" },
        { key: "days_left", label: "Sisa Hari" }, { key: "status_label", label: "Status" },
      ],
      rows: (r.expiredReport.items || []).map((it) => ({
        product_name: it.product_name, purchase_code: it.purchase_code, quantity: it.quantity,
        expiry_date_fmt: formatDate(it.expiry_date), days_left: it.days_left,
        status_label: it.status === "expired" ? "Sudah Kadaluarsa" : it.status === "soon" ? "Akan Kadaluarsa" : "Aman",
      })),
      summary: [
        { label: "Total Batch Terlacak", value: s.total_batches || 0 },
        { label: "Sudah Kadaluarsa", value: s.total_expired || 0 },
        { label: "Akan Kadaluarsa", value: s.total_soon || 0 },
        { label: "Qty Kadaluarsa", value: formatQty(s.total_qty_expired || 0) },
      ],
    };
  }
  return {};
}

// ── Konten laporan, sesuai jenis yang aktif ────────────────────────────────
function ReportContent({ r }) {
  if (r.reportType === "penjualan") return <PenjualanContent r={r} />;
  if (r.reportType === "penjualanPelanggan") return <PenjualanPelangganContent r={r} />;
  if (r.reportType === "labaProduk") return <LabaProdukContent r={r} />;
  if (r.reportType === "barangMasuk") return <BarangMasukContent r={r} />;
  if (r.reportType === "barangExpired") return <BarangExpiredContent r={r} />;
  return <PageLoader />;
}

function PenjualanContent({ r }) {
  const rep = r.salesReport;
  if (!rep) return null;
  return (
    <>
      <div className="stats-grid">
        <StatCard icon={TrendingUp} tone="blue" label="Total Pendapatan" value={formatRupiah(rep.summary.total_revenue || 0)} />
        <StatCard icon={ShoppingCart} tone="green" label="Total Transaksi" value={rep.summary.total_transactions || 0} />
        <StatCard icon={TrendingUp} tone="purple" label="Rata-rata / Transaksi" value={formatRupiah(rep.summary.avg_transaction || 0)} />
        <StatCard icon={ShoppingCart} tone="cyan" label="Rata-rata Item / Transaksi" value={formatNumber(Number(rep.summary.avg_items_per_transaction || 0).toFixed(1))} />
        <StatCard icon={Percent} tone="orange" label="Total Diskon" value={formatRupiah(rep.summary.total_discount || 0)} />
      </div>

      <div className="card chart-card mb-4">
        <div className="chart-card__title">Pendapatan per Periode</div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={r.salesChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="period" stroke="var(--text-muted)" fontSize={11} tickFormatter={(v) => formatChartPeriod(v, r.period)} />
            <YAxis stroke="var(--text-muted)" fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}rb`} />
            <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: 8, fontSize: 12 }} labelFormatter={(v) => formatChartPeriod(v, r.period)} formatter={(v) => formatRupiah(v)} />
            <Bar dataKey="revenue" fill="var(--accent-blue)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div className="chart-card__title" style={{ marginBottom: 0 }}>Produk Terlaris</div>
            <select className="form-select" style={{ width: "auto" }} value={r.salesSort} onChange={(e) => r.setSalesSort(e.target.value)}>
              {SALES_SORT_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          <div className="table-container">
            <table>
              <thead><tr><th>Produk</th><th>Qty Jual</th><th>Qty Dasar</th><th>Pendapatan</th></tr></thead>
              <tbody>
                {r.sortedSalesTopProducts.map((p, i) => (
                  <tr key={i}>
                    <td>{p.name}</td>
                    <td className="text-muted">{formatQty(p.total_qty_sold)}×</td>
                    <td>{formatQty(p.total_qty_base)}{p.base_unit ? ` ${p.base_unit}` : ""}</td>
                    <td className="font-mono">{formatRupiah(p.total_revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="chart-card__title">Pendapatan per Kategori</div>
          <div className="table-container">
            <table>
              <thead><tr><th>Kategori</th><th>Qty Jual</th><th>Pendapatan</th></tr></thead>
              <tbody>
                {rep.categoryRevenue.map((c, i) => (
                  <tr key={i}><td>{c.category}</td><td>{formatQty(c.qty_sold)}×</td><td className="font-mono">{formatRupiah(c.revenue)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

function PenjualanPelangganContent({ r }) {
  const rep = r.customerReport;
  if (!rep) return null;
  const s = rep.summary || {};
  const items = r.sortedCustomers || [];

  return (
    <>
      <div className="stats-grid">
        <StatCard icon={Users} tone="blue" label="Jumlah Pelanggan" value={s.total_customers || 0} />
        <StatCard icon={ShoppingCart} tone="green" label="Total Transaksi" value={s.total_transactions || 0} />
        <StatCard icon={TrendingUp} tone="purple" label="Total Pendapatan" value={formatRupiah(s.total_revenue || 0)} />
        <StatCard icon={Wallet} tone="orange" label="Total Laba" value={formatRupiah(s.total_profit || 0)} />
        <StatCard icon={Percent} tone="cyan" label="Margin Laba" value={`${(s.margin_percent || 0).toFixed(1)}%`} />
      </div>

      <div className="card">
        <SectionHeader
          title="Penjualan per Pelanggan"
          subtitle={`${formatDate(r.startDate)} – ${formatDate(r.endDate)} · ${items.length} pelanggan`}
          action={
            <select className="form-select" style={{ width: "auto" }} value={r.customerSort} onChange={(e) => r.setCustomerSort(e.target.value)}>
              {CUSTOMER_SORT_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          }
        />
        {items.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Belum ada penjualan pada periode ini"
            description="Coba pilih rentang tanggal lain untuk melihat penjualan per pelanggan"
          />
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Pelanggan</th><th>Transaksi</th><th>Qty</th>
                  <th>Pendapatan</th><th>HPP</th><th>Laba</th><th>Margin</th><th>Terakhir Belanja</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c.customer_id ?? "umum"}>
                    <td>{c.customer_name}{!c.customer_id && <span style={{ marginLeft: 6 }}><Badge variant="blue">Umum</Badge></span>}</td>
                    <td>{c.transaction_count}</td>
                    <td>{formatQty(c.total_qty)}</td>
                    <td className="font-mono">{formatRupiah(c.total_revenue)}</td>
                    <td className="font-mono text-muted">{formatRupiah(c.total_cogs)}</td>
                    <td className={`font-mono ${c.total_profit < 0 ? "text-danger" : "text-success"}`}>{formatRupiah(c.total_profit)}</td>
                    <td>
                      <Badge variant={c.margin_percent < 0 ? "red" : c.margin_percent < 10 ? "orange" : "green"}>
                        {c.margin_percent.toFixed(1)}%
                      </Badge>
                    </td>
                    <td className="text-sm text-muted">{c.last_transaction_at ? formatDate(c.last_transaction_at) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function LabaProdukContent({ r }) {
  const rep = r.profitReport;
  if (!rep) return null;
  const s = rep.summary || {};
  const items = r.sortedProfitProducts || [];

  return (
    <>
      <div className="stats-grid">
        <StatCard icon={TrendingUp} tone="blue" label="Total Pendapatan" value={formatRupiah(s.total_revenue || 0)} />
        <StatCard icon={ShoppingBag} tone="orange" label="Total HPP (Modal Supplier)" value={formatRupiah(s.total_cogs || 0)} />
        <StatCard icon={Wallet} tone="green" label="Total Laba" value={formatRupiah(s.total_profit || 0)} />
        <StatCard icon={Percent} tone="purple" label="Margin Laba" value={`${(s.margin_percent || 0).toFixed(1)}%`} />
      </div>

      <div className="card">
        <SectionHeader
          title="Laba per Produk"
          subtitle={`${formatDate(rep.startDate)} – ${formatDate(rep.endDate)} · ${s.total_products || 0} produk terjual`}
          action={
            <select className="form-select" style={{ width: "auto" }} value={r.profitSort} onChange={(e) => r.setProfitSort(e.target.value)}>
              {PROFIT_SORT_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          }
        />
        {items.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="Belum ada penjualan pada periode ini"
            description="Coba pilih rentang tanggal lain untuk melihat laba per produk"
          />
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Produk</th><th>Kategori</th><th>Qty Jual</th><th>Qty Dasar</th>
                  <th>Pendapatan</th><th>HPP</th><th>Laba</th><th>Margin</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.product_id}>
                    <td>{p.name}</td>
                    <td className="text-sm text-muted">{p.category}</td>
                    <td className="text-muted">{formatQty(p.total_qty_sold)}×</td>
                    <td>{formatQty(p.total_qty_base)}{p.base_unit ? ` ${p.base_unit}` : ""}</td>
                    <td className="font-mono">{formatRupiah(p.total_revenue)}</td>
                    <td className="font-mono text-muted">{formatRupiah(p.total_cogs)}</td>
                    <td className={`font-mono ${p.total_profit < 0 ? "text-danger" : "text-success"}`}>{formatRupiah(p.total_profit)}</td>
                    <td>
                      <Badge variant={p.margin_percent < 0 ? "red" : p.margin_percent < 10 ? "orange" : "green"}>
                        {p.margin_percent.toFixed(1)}%
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function BarangMasukContent({ r }) {
  const rep = r.purchaseReport;
  if (!rep) return null;
  const s = rep.summary || {};
  return (
    <>
      <div className="stats-grid">
        <StatCard icon={ShoppingBag} tone="blue" label="Total Pembelian" value={s.total_purchases || 0} />
        <StatCard icon={Truck} tone="green" label="Total Qty Masuk" value={formatQty(s.total_qty || 0)} />
        <StatCard icon={TrendingUp} tone="orange" label="Total Biaya" value={formatRupiah(s.total_cost || 0)} />
        <StatCard icon={Users} tone="purple" label="Total Supplier" value={s.total_suppliers || 0} />
      </div>

      <div className="card chart-card mb-4">
        <div className="chart-card__title">Biaya Pembelian per Periode</div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={r.purchaseChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="period" stroke="var(--text-muted)" fontSize={11} tickFormatter={(v) => formatChartPeriod(v, r.period)} />
            <YAxis stroke="var(--text-muted)" fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}rb`} />
            <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: 8, fontSize: 12 }} labelFormatter={(v) => formatChartPeriod(v, r.period)} formatter={(v) => formatRupiah(v)} />
            <Bar dataKey="cost" fill="var(--accent-orange)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div className="chart-card__title" style={{ marginBottom: 0 }}>Produk Terbanyak Dibeli</div>
            <select className="form-select" style={{ width: "auto" }} value={r.purchaseSort} onChange={(e) => r.setPurchaseSort(e.target.value)}>
              {PURCHASE_SORT_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          <div className="table-container">
            <table>
              <thead><tr><th>Produk</th><th>Qty</th><th>Biaya</th></tr></thead>
              <tbody>
                {r.sortedPurchaseTopProducts.map((p, i) => (
                  <tr key={i}><td>{p.product_name}</td><td>{formatQty(p.total_qty)}</td><td className="font-mono">{formatRupiah(p.total_cost)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="chart-card__title">Pembelian per Supplier</div>
          <div className="table-container">
            <table>
              <thead><tr><th>Supplier</th><th>Qty</th><th>Biaya</th></tr></thead>
              <tbody>
                {(rep.perSupplier || []).map((c, i) => (
                  <tr key={i}><td>{c.supplier}</td><td>{formatQty(c.total_qty)}</td><td className="font-mono">{formatRupiah(c.total_cost)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

const EXPIRED_BADGE = {
  expired: { variant: "red", label: "Sudah Kadaluarsa" },
  soon: { variant: "orange", label: "Akan Kadaluarsa" },
  safe: { variant: "green", label: "Aman" },
};

function BarangExpiredContent({ r }) {
  const rep = r.expiredReport;
  if (!rep) return null;
  const s = rep.summary || {};
  const items = rep.items || [];

  return (
    <>
      <div className="stats-grid">
        <StatCard icon={PackageX} tone="blue" label="Total Batch Terlacak" value={s.total_batches || 0} />
        <StatCard icon={AlertTriangle} tone="red" label="Sudah Kadaluarsa" value={s.total_expired || 0} />
        <StatCard icon={AlertTriangle} tone="orange" label={`Akan Kadaluarsa (≤${rep.thresholdDays} hari)`} value={s.total_soon || 0} />
        <StatCard icon={CheckCircle2} tone="green" label="Qty Kadaluarsa" value={formatQty(s.total_qty_expired || 0)} />
      </div>

      <div className="card">
        <SectionHeader title="Daftar Batch Barang" subtitle="Diurutkan dari yang paling dekat kadaluarsa" />
        {items.length === 0 ? (
          <EmptyState
            icon={PackageX}
            title="Belum ada data kadaluarsa"
            description="Isi tanggal kadaluarsa saat mencatat Pembelian Stok (Barang Masuk) agar laporan ini terisi"
          />
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Produk</th><th>Kode Pembelian</th><th>Tgl Pembelian</th><th>Qty Batch</th>
                  <th>Stok Saat Ini</th><th>Kadaluarsa</th><th>Sisa Hari</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const badge = EXPIRED_BADGE[it.status] || EXPIRED_BADGE.safe;
                  return (
                    <tr key={it.id}>
                      <td>{it.product_name}</td>
                      <td className="font-mono text-sm">{it.purchase_code}</td>
                      <td className="text-sm">{formatDate(it.purchase_date)}</td>
                      <td>{formatQty(it.quantity)} {it.unit}</td>
                      <td>{it.current_stock != null ? `${formatQty(it.current_stock)} ${it.unit}` : "-"}</td>
                      <td className="text-sm">{formatDate(it.expiry_date)}</td>
                      <td className={it.days_left < 0 ? "text-danger" : it.days_left <= rep.thresholdDays ? "text-warning" : ""}>
                        {it.days_left < 0 ? `${Math.abs(it.days_left)} hari lalu` : `${it.days_left} hari`}
                      </td>
                      <td><Badge variant={badge.variant}>{badge.label}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}