// src/features/reports/ReportsPage.jsx
// ─────────────────────────────────────────────────────────────────────────────
// VIEW LAYER — Laporan. Laporan dipisah per modul/fungsi:
//   penjualan/ · kas/ · produk/ · pembelian/ · piutang/
// ─────────────────────────────────────────────────────────────────────────────
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import {
  TrendingUp, ShoppingCart, Percent, ChevronLeft, Printer, FileSpreadsheet,
  ShoppingBag, Truck, Users, PackageX, AlertTriangle, CheckCircle2,
  Wallet, Receipt, ArrowUpCircle, Clock, ClipboardList, CreditCard, Layers, History, Ban,
} from "lucide-react";
import {
  useReports, SALES_SORT_OPTIONS, PURCHASE_SORT_OPTIONS,
  QUICK_RANGE_OPTIONS, PROFIT_SORT_OPTIONS, CUSTOMER_SORT_OPTIONS, PERIOD_OPTIONS,
} from "./hooks";
import { SalesDailyContent, buildSalesDailyExportPayload } from "./penjualan/SalesDailyReport";
import { SalesPeriodContent, buildSalesPeriodExportPayload } from "./penjualan/SalesPeriodReport";
import { CashReportContent, buildCashReportExportPayload } from "./kas/CashReport";
import { CashFlowContent, buildCashFlowExportPayload } from "./kas/CashFlowReport";
import { ShiftReportContent, buildShiftReportExportPayload } from "./kas/ShiftReport";
import { StockOutContent, buildStockOutExportPayload } from "./produk/StockOutReport";
import { StockOpnameContent, buildStockOpnameExportPayload } from "./produk/StockOpnameReport";
import { PurchaseReportContent, buildPurchaseReportExportPayload } from "./pembelian/PurchaseReport";
import { PurchaseBySupplierContent, buildPurchaseBySupplierExportPayload } from "./pembelian/PurchaseBySupplierReport";
import { PayableReportContent, buildPayableReportExportPayload } from "./pembelian/PayableReport";
import { UnpaidInvoicesContent, buildUnpaidInvoicesExportPayload } from "./piutang/UnpaidInvoicesReport";
import { UnpaidByCustomerContent, buildUnpaidByCustomerExportPayload } from "./piutang/UnpaidByCustomerReport";
import { AgingContent, buildAgingExportPayload } from "./piutang/AgingReport";
import { HistoryContent, buildHistoryExportPayload } from "./piutang/HistoryReport";
import { PaymentMethodContent, buildPaymentMethodExportPayload } from "./penjualan/PaymentMethodReport";
import { VoidReportContent, buildVoidReportExportPayload } from "./penjualan/VoidReport";
import { PageLoader, StatCard, SectionHeader, EmptyState, Badge } from "../../components/UI";
import { formatRupiah, formatDate, formatChartPeriod, formatNumber, formatQty } from "../../utils/format";
import { printTabularReport, exportTabularReportExcel } from "../../utils/printLaporan";

const REPORT_ICONS = {
  penjualanHarian: Receipt,
  penjualanPeriode: TrendingUp,
  penjualan: TrendingUp,
  penjualanPelanggan: Users,
  labaProduk: Wallet,
  kasMasukKeluar: ArrowUpCircle,
  cashFlow: Wallet,
  shiftKasir: Clock,
  barangMasuk: Truck,
  barangKeluar: PackageX,
  stockOpname: ClipboardList,
  barangExpired: PackageX,
  pembelian: ShoppingBag,
  pembelianSupplier: Users,
  hutangSupplier: CreditCard,
  piutangFakturBelumLunas: Receipt,
  piutangPerPelanggan: Users,
  piutangAging: Clock,
  piutangRiwayat: History,
  metodePembayaran: CreditCard,
  transaksiVoid: Ban,
};

const GROUP_LABELS = {
  penjualan: "Penjualan",
  kas: "Kas",
  produk: "Produk & Stok",
  pembelian: "Pembelian",
  piutang: "Piutang",
};

export default function Reports() {
  const r = useReports();
  const activeType = r.reportTypes.find((rt) => rt.id === r.reportType);

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">{activeType ? activeType.title : "Laporan"}</div>
          <div className="page-subtitle">
            {activeType ? activeType.description : "Penjualan, kas, produk, pembelian, hutang & piutang"}
          </div>
        </div>
      </div>

      <div className="page-body">
        {!r.reportType ? (
          <ReportPicker r={r} />
        ) : (
          <>
            <div className="report-toolbar">
              <button className="btn btn-ghost btn-sm report-toolbar__back" onClick={r.backToPicker}>
                <ChevronLeft size={14} /> Jenis laporan lain
              </button>
              <div className="report-toolbar__filters">
                <ReportFilterBar r={r} />
              </div>
              <div className="report-toolbar__actions">
                <ReportActions r={r} />
              </div>
            </div>
            {r.loading ? <PageLoader /> : <ReportContent r={r} />}
          </>
        )}
      </div>
    </div>
  );
}

function ReportPicker({ r }) {
  const groups = {};
  r.reportTypes.forEach((rt) => {
    const g = rt.group || "lain";
    if (!groups[g]) groups[g] = [];
    groups[g].push(rt);
  });

  return (
    <div>
      {Object.entries(groups).map(([group, items]) => (
        <div key={group} className="report-picker-group">
          <div className="report-picker-group__label">{GROUP_LABELS[group] || group}</div>
          <div className="report-picker">
            {items.map((rt) => {
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
        </div>
      ))}
    </div>
  );
}

function ReportFilterBar({ r }) {
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

function ReportActions({ r }) {
  function handlePrint() {
    const payload = buildExportPayload(r);
    if (!payload || !payload.rows?.length) return;
    printTabularReport({ ...payload, storeSettings: r.storeSettings });
  }
  function handleExportExcel() {
    const payload = buildExportPayload(r);
    if (!payload || !payload.rows?.length) return;
    exportTabularReportExcel({
      ...payload,
      storeSettings: r.storeSettings,
      filename: `${payload.title.replace(/\s+/g, "_")}.xlsx`,
    });
  }
  const payload = buildExportPayload(r);
  const disabled = !payload || !payload.rows?.length;
  return (
    <div className="flex gap-2">
      <button className="btn btn-ghost btn-sm" onClick={handlePrint} disabled={disabled} title={disabled ? "Tidak ada data untuk dicetak" : undefined}>
        <Printer size={14} /> Cetak
      </button>
      <button className="btn btn-ghost btn-sm" onClick={handleExportExcel} disabled={disabled} title={disabled ? "Tidak ada data untuk diekspor" : undefined}>
        <FileSpreadsheet size={14} /> Export Excel
      </button>
    </div>
  );
}

function buildExportPayload(r) {
  if (r.reportType === "penjualanHarian" && r.dailyReport) return buildSalesDailyExportPayload(r);
  if (r.reportType === "kasMasukKeluar" && r.kasReport) return buildCashReportExportPayload(r);
  if (r.reportType === "penjualanPeriode" && r.salesReport) return buildSalesPeriodExportPayload(r);
  if (r.reportType === "cashFlow" && r.cashFlowReport) return buildCashFlowExportPayload(r);
  if (r.reportType === "shiftKasir" && r.shiftReport) return buildShiftReportExportPayload(r);
  if (r.reportType === "barangKeluar" && r.stockOutReport) return buildStockOutExportPayload(r);
  if (r.reportType === "stockOpname") return buildStockOpnameExportPayload(r);
  if (r.reportType === "pembelian" && r.purchaseReport) return buildPurchaseReportExportPayload(r);
  if (r.reportType === "pembelianSupplier" && r.purchaseReport) return buildPurchaseBySupplierExportPayload(r);
  if (r.reportType === "hutangSupplier" && r.payableReport) return buildPayableReportExportPayload(r);
  if (r.reportType === "piutangFakturBelumLunas" && r.piutangUnpaidReport) return buildUnpaidInvoicesExportPayload(r);
  if (r.reportType === "piutangPerPelanggan" && r.piutangPerCustomerReport) return buildUnpaidByCustomerExportPayload(r);
  if (r.reportType === "piutangAging" && r.piutangAgingReport) return buildAgingExportPayload(r);
  if (r.reportType === "piutangRiwayat" && r.piutangHistoryReport) return buildHistoryExportPayload(r);
  if (r.reportType === "metodePembayaran" && r.paymentMethodReport) return buildPaymentMethodExportPayload(r);
  if (r.reportType === "transaksiVoid" && r.voidReport) return buildVoidReportExportPayload(r);

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
        { key: "total_revenue", label: "Pendapatan" }, { key: "total_profit", label: "Laba" },
      ],
      rows: (r.sortedCustomers || []).map((c) => ({
        customer_name: c.customer_name, transaction_count: c.transaction_count,
        total_revenue: formatRupiah(c.total_revenue), total_profit: formatRupiah(c.total_profit),
      })),
      summary: [
        { label: "Jumlah Pelanggan", value: s.total_customers || 0 },
        { label: "Total Pendapatan", value: formatRupiah(s.total_revenue || 0) },
      ],
    };
  }
  if (r.reportType === "labaProduk" && r.profitReport) {
    const s = r.profitReport.summary || {};
    return {
      title: "Laporan Laba per Produk",
      periodLabel: `${formatDate(r.profitStartDate)} – ${formatDate(r.profitEndDate)}`,
      columns: [
        { key: "name", label: "Produk" }, { key: "total_revenue", label: "Pendapatan" },
        { key: "total_cogs", label: "HPP" }, { key: "total_profit", label: "Laba" },
      ],
      rows: (r.sortedProfitProducts || []).map((p) => ({
        name: p.name,
        total_revenue: formatRupiah(p.total_revenue),
        total_cogs: formatRupiah(p.total_cogs),
        total_profit: formatRupiah(p.total_profit),
      })),
      summary: [
        { label: "Total Laba", value: formatRupiah(s.total_profit || 0) },
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
      rows: (r.sortedPurchaseTopProducts || []).map((p) => ({
        product_name: p.product_name,
        total_qty: formatQty(p.total_qty),
        total_cost: formatRupiah(p.total_cost),
      })),
      summary: [{ label: "Total Biaya", value: formatRupiah(s.total_cost || 0) }],
    };
  }
  return null;
}

function ReportContent({ r }) {
  if (r.reportType === "penjualanHarian") return <SalesDailyContent r={r} />;
  if (r.reportType === "penjualanPeriode") return <SalesPeriodContent r={r} />;
  if (r.reportType === "kasMasukKeluar") return <CashReportContent r={r} />;
  if (r.reportType === "cashFlow") return <CashFlowContent r={r} />;
  if (r.reportType === "shiftKasir") return <ShiftReportContent r={r} />;
  if (r.reportType === "barangKeluar") return <StockOutContent r={r} />;
  if (r.reportType === "stockOpname") return <StockOpnameContent r={r} />;
  if (r.reportType === "pembelian") return <PurchaseReportContent r={r} />;
  if (r.reportType === "pembelianSupplier") return <PurchaseBySupplierContent r={r} />;
  if (r.reportType === "hutangSupplier") return <PayableReportContent r={r} />;
  if (r.reportType === "piutangFakturBelumLunas") return <UnpaidInvoicesContent r={r} />;
  if (r.reportType === "piutangPerPelanggan") return <UnpaidByCustomerContent r={r} />;
  if (r.reportType === "piutangAging") return <AgingContent r={r} />;
  if (r.reportType === "piutangRiwayat") return <HistoryContent r={r} />;
  if (r.reportType === "metodePembayaran") return <PaymentMethodContent r={r} />;
  if (r.reportType === "transaksiVoid") return <VoidReportContent r={r} />;
  if (r.reportType === "penjualan") return <PenjualanContent r={r} />;
  if (r.reportType === "penjualanPelanggan") return <PenjualanPelangganContent r={r} />;
  if (r.reportType === "labaProduk") return <LabaProdukContent r={r} />;
  if (r.reportType === "barangMasuk") return <BarangMasukContent r={r} />;
  if (r.reportType === "barangExpired") return <BarangExpiredContent r={r} />;
  return null;
}

// ── Konten yang sudah ada sebelumnya (tetap di sini agar tidak pecah) ───────
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
                {(rep.categoryRevenue || []).map((c, i) => (
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
  return (
    <>
      <div className="stats-grid">
        <StatCard icon={Users} tone="blue" label="Jumlah Pelanggan" value={s.total_customers || 0} />
        <StatCard icon={ShoppingCart} tone="green" label="Total Transaksi" value={s.total_transactions || 0} />
        <StatCard icon={TrendingUp} tone="purple" label="Total Pendapatan" value={formatRupiah(s.total_revenue || 0)} />
        <StatCard icon={Wallet} tone="cyan" label="Total Laba" value={formatRupiah(s.total_profit || 0)} />
      </div>
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <div className="chart-card__title" style={{ marginBottom: 0 }}>Per Pelanggan</div>
          <select className="form-select" style={{ width: "auto" }} value={r.customerSort} onChange={(e) => r.setCustomerSort(e.target.value)}>
            {CUSTOMER_SORT_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr><th>Pelanggan</th><th>Transaksi</th><th>Qty</th><th>Pendapatan</th><th>HPP</th><th>Laba</th></tr>
            </thead>
            <tbody>
              {r.sortedCustomers.map((c, i) => (
                <tr key={i}>
                  <td>{c.customer_name}</td>
                  <td>{c.transaction_count}</td>
                  <td>{formatQty(c.total_qty)}</td>
                  <td className="font-mono">{formatRupiah(c.total_revenue)}</td>
                  <td className="font-mono text-muted">{formatRupiah(c.total_cogs)}</td>
                  <td className="font-mono text-success">{formatRupiah(c.total_profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function LabaProdukContent({ r }) {
  const rep = r.profitReport;
  if (!rep) return null;
  const s = rep.summary || {};
  return (
    <>
      <div className="stats-grid">
        <StatCard icon={TrendingUp} tone="blue" label="Total Pendapatan" value={formatRupiah(s.total_revenue || 0)} />
        <StatCard icon={ShoppingBag} tone="orange" label="Total HPP" value={formatRupiah(s.total_cogs || 0)} />
        <StatCard icon={Wallet} tone="green" label="Total Laba" value={formatRupiah(s.total_profit || 0)} />
        <StatCard icon={Percent} tone="purple" label="Margin" value={`${(s.margin_percent || 0).toFixed(1)}%`} />
      </div>
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <div className="chart-card__title" style={{ marginBottom: 0 }}>Laba per Produk</div>
          <select className="form-select" style={{ width: "auto" }} value={r.profitSort} onChange={(e) => r.setProfitSort(e.target.value)}>
            {PROFIT_SORT_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr><th>Produk</th><th>Qty</th><th>Pendapatan</th><th>HPP</th><th>Laba</th><th>Margin</th></tr>
            </thead>
            <tbody>
              {r.sortedProfitProducts.map((p, i) => (
                <tr key={i}>
                  <td>{p.name}</td>
                  <td>{formatQty(p.total_qty_base)}{p.base_unit ? ` ${p.base_unit}` : ""}</td>
                  <td className="font-mono">{formatRupiah(p.total_revenue)}</td>
                  <td className="font-mono text-muted">{formatRupiah(p.total_cogs)}</td>
                  <td className="font-mono text-success">{formatRupiah(p.total_profit)}</td>
                  <td>{(p.margin_percent || 0).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
        <StatCard icon={Truck} tone="blue" label="Total Biaya" value={formatRupiah(s.total_cost || 0)} />
        <StatCard icon={PackageX} tone="cyan" label="Total Qty" value={formatQty(s.total_qty || 0)} />
        <StatCard icon={ShoppingBag} tone="green" label="Transaksi" value={s.total_transactions || s.transaction_count || 0} />
      </div>
      {r.purchaseChartData?.length > 0 && (
        <div className="card chart-card mb-4">
          <div className="chart-card__title">Pembelian per Periode</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={r.purchaseChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="period" stroke="var(--text-muted)" fontSize={11} tickFormatter={(v) => formatChartPeriod(v, r.period)} />
              <YAxis stroke="var(--text-muted)" fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}rb`} />
              <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: 8, fontSize: 12 }} labelFormatter={(v) => formatChartPeriod(v, r.period)} formatter={(v) => formatRupiah(v)} />
              <Bar dataKey="cost" fill="var(--accent-blue)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
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
                <tr key={i}>
                  <td>{p.product_name}</td>
                  <td>{formatQty(p.total_qty)}</td>
                  <td className="font-mono">{formatRupiah(p.total_cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

const EXPIRED_BADGE = {
  expired: { variant: "red", label: "Expired" },
  warning: { variant: "orange", label: "Mendekati" },
  safe: { variant: "green", label: "Aman" },
};

function BarangExpiredContent({ r }) {
  const rep = r.expiredReport;
  if (!rep) return null;
  const items = rep.items || rep.data || [];
  return (
    <>
      <div className="stats-grid">
        <StatCard icon={AlertTriangle} tone="red" label="Expired" value={rep.summary?.expired_count || 0} />
        <StatCard icon={Clock} tone="orange" label="Mendekati" value={rep.summary?.warning_count || 0} />
        <StatCard icon={CheckCircle2} tone="green" label="Aman" value={rep.summary?.safe_count || 0} />
      </div>
      <div className="card">
        <div className="chart-card__title">Daftar Batch</div>
        {items.length === 0 ? (
          <EmptyState icon={PackageX} title="Tidak ada data" description="Coba ubah filter status atau tanggal" />
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
                      <td className={it.days_left < 0 ? "text-danger" : it.days_left <= (rep.thresholdDays || 30) ? "text-warning" : ""}>
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