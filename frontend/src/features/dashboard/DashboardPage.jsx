// src/features/dashboard/DashboardPage.jsx
import { Link, useNavigate } from "react-router-dom";
import { DollarSign, ShoppingCart, TrendingUp, TrendingDown, Package, AlertTriangle, FileBarChart2, CalendarRange, Wallet, Boxes, Receipt, CreditCard, MinusCircle, Award, CalendarDays, CircleDot, FileDown, FileSpreadsheet, PackageSearch } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import toast from "react-hot-toast";
import {
  useDashboard,
  DASHBOARD_FILTER_OPTIONS,
  availableYears,
} from "./hooks";
import { StatCard, PageLoader, SectionHeader } from "../../components/UI";
import { formatRupiah, formatQty } from "../../utils/format";
import { printDashboardReport, exportDashboardExcel } from "../../utils/exportDashboard";
import { useAuth } from "../../context/AuthContext";
import { useShift } from "../../context/ShiftContext";

function DashboardDateFilter({
  filterMode, setFilterMode,
  selectedYear, setSelectedYear,
  customStart, setCustomStart,
  customEnd, setCustomEnd,
  onExportPdf, onExportExcel,
}) {
  return (
    <div className="dashboard-filter-bar">
      <div className="dashboard-filter-bar__inputs">
        <select
          className="dashboard-filter-select"
          value={filterMode}
          onChange={(e) => setFilterMode(e.target.value)}
        >
          {DASHBOARD_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {filterMode === "year" && (
          <select
            className="dashboard-filter-select"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
          >
            {availableYears().map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        )}

        {filterMode === "custom" && (
          <>
            <input
              type="date" className="dashboard-filter-date"
              value={customStart} onChange={(e) => setCustomStart(e.target.value)}
            />
            <span className="text-muted text-sm">s/d</span>
            <input
              type="date" className="dashboard-filter-date"
              value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
            />
          </>
        )}
      </div>

      <div className="dashboard-filter-bar__spacer" />

      <div className="dashboard-export-group">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onExportPdf}>
          <FileDown size={14} /> PDF
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onExportExcel}>
          <FileSpreadsheet size={14} /> Excel
        </button>
      </div>
    </div>
  );
}

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return parts.length === 1
    ? parts[0].slice(0, 2).toUpperCase()
    : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function DashboardHeader() {
  const { user } = useAuth();
  const { shift } = useShift();
  const today = new Date().toLocaleDateString("id-ID", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div className="dashboard-header-right">
      <div className="dashboard-header-date">
        <CalendarDays size={14} />
        {today}
      </div>
      <div className={`dashboard-shift-badge ${shift ? "dashboard-shift-badge--open" : "dashboard-shift-badge--closed"}`}>
        <CircleDot size={10} />
        {shift ? "Shift Aktif" : "Belum Ada Shift"}
      </div>
      <div className="dashboard-avatar" title={user?.name || "Pengguna"}>
        {getInitials(user?.name)}
      </div>
    </div>
  );
}

function RankBar({ value, max, variant }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="dashboard-rank-item__bar-track">
      <div
        className={`dashboard-rank-item__bar-fill${variant === "expense" ? " dashboard-rank-item__bar-fill--expense" : ""}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function formatChangeText(pct) {
  if (pct === null) return "Belum ada data kemarin";
  const arrow = pct >= 0 ? "↑" : "↓";
  return `${arrow} ${Math.abs(pct)}% dari kemarin`;
}

function todayStr() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function StatsSectionLabel({ icon: Icon, title }) {
  return (
    <div className="dashboard-stats-label">
      <Icon size={13} />
      {title}
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const {
    summary, loading, chartData, todayRevenuePct, todayTxPct, incomeStatement, loadingIncome,
    filterMode, setFilterMode, selectedYear, setSelectedYear, customStart, setCustomStart,
    customEnd, setCustomEnd, range, periodSummary, loadingPeriod, storeSettings,
  } = useDashboard();

  if (loading) return <PageLoader text="Memuat dashboard..." />;

  function goToTransactions(startDate, endDate) {
    navigate(`/transaksi?start_date=${startDate}&end_date=${endDate}`);
  }

  function handleExportPdf() {
    if (!periodSummary) {
      toast.error("Data periode belum siap, coba lagi sebentar");
      return;
    }
    printDashboardReport({
      storeSettings,
      periodLabel: range.label,
      periodSummary,
      incomeStatement,
    });
  }

  function handleExportExcel() {
    if (!periodSummary) {
      toast.error("Data periode belum siap, coba lagi sebentar");
      return;
    }
    exportDashboardExcel({
      storeSettings,
      periodLabel: range.label,
      periodSummary,
      incomeStatement,
    });
  }

  return (
    <div className="fade-in dashboard-page">
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-subtitle">Ringkasan performa toko hari ini</div>
        </div>
        <DashboardHeader />
      </div>

      <div className="page-body">
        <DashboardDateFilter
          filterMode={filterMode} setFilterMode={setFilterMode}
          selectedYear={selectedYear} setSelectedYear={setSelectedYear}
          customStart={customStart} setCustomStart={setCustomStart}
          customEnd={customEnd} setCustomEnd={setCustomEnd}
          onExportPdf={handleExportPdf} onExportExcel={handleExportExcel}
        />

        <StatsSectionLabel icon={TrendingUp} title="Penjualan & Laba" />
        <div className="stats-grid">
          <StatCard
            icon={DollarSign} tone="blue" label="Pendapatan Hari Ini"
            value={formatRupiah(summary.today.revenue)}
            change={formatChangeText(todayRevenuePct !== null ? Number(todayRevenuePct) : null)}
            changeTone={todayRevenuePct >= 0 ? "positive" : "negative"}
            onClick={() => goToTransactions(todayStr(), todayStr())}
          />
          <StatCard
            icon={ShoppingCart} tone="green" label="Transaksi Hari Ini"
            value={summary.today.tx_count}
            change={formatChangeText(todayTxPct !== null ? Number(todayTxPct) : null)}
            changeTone={todayTxPct >= 0 ? "positive" : "negative"}
            onClick={() => goToTransactions(todayStr(), todayStr())}
          />
          <StatCard
            icon={CalendarRange} tone="cyan" label="Pendapatan Minggu Ini"
            value={formatRupiah(summary.thisWeek.revenue)}
            change={`${summary.thisWeek.tx_count} transaksi`} changeTone="neutral"
          />
          <StatCard
            icon={TrendingUp} tone="purple" label={`Pendapatan (${range.label})`}
            value={loadingPeriod || !periodSummary ? "..." : formatRupiah(periodSummary.revenue)}
            change={loadingPeriod || !periodSummary ? undefined : `${periodSummary.txCount} transaksi — klik untuk lihat rincian`}
            changeTone="neutral"
            onClick={() => goToTransactions(range.start, range.end)}
          />
          <StatCard
            icon={TrendingUp} tone={!loadingIncome && incomeStatement && incomeStatement.gross_profit < 0 ? "red" : "green"}
            label={`Laba Kotor (${range.label})`}
            value={loadingIncome || !incomeStatement ? "..." : formatRupiah(incomeStatement.gross_profit)}
            valueTone={!loadingIncome && incomeStatement ? (incomeStatement.gross_profit < 0 ? "negative" : "positive") : undefined}
          />
          <StatCard
            icon={MinusCircle} tone="red" label={`Total Pengeluaran (${range.label})`}
            value={loadingPeriod || !periodSummary ? "..." : formatRupiah(periodSummary.expensesTotal)}
          />
        </div>

        <StatsSectionLabel icon={Wallet} title="Kas, Piutang, Hutang & Stok" />
        <div className="stats-grid mb-3">
          <StatCard
            icon={Wallet} tone={summary.cashShiftOpen ? "blue" : "orange"} label="Saldo Kas"
            value={formatRupiah(summary.cashBalance)}
            change={summary.cashShiftOpen ? "Sesi kas sedang terbuka" : "Belum ada sesi kas terbuka"}
            changeTone="neutral"
          />
          <StatCard
            icon={Boxes} tone="purple" label="Nilai Persediaan"
            value={formatRupiah(summary.inventoryValueAtCost)}
            change="Posisi saat ini: stok x harga modal rata-rata terkini" changeTone="neutral"
            tooltip="Dihitung dari harga modal rata-rata bergerak (moving average) saat ini, bukan akumulasi HPP historis. Karena harga modal tiap produk terus diperbarui setiap ada pembelian baru, angka ini wajar berbeda dari total HPP di Laporan Laba Rugi periode berjalan."
          />
          <StatCard
            icon={Receipt} tone={summary.receivablesOverdue > 0 ? "red" : "cyan"} label="Piutang Belum Tertagih"
            value={formatRupiah(summary.receivablesOutstanding)}
            change={summary.receivablesOverdue > 0 ? `${formatRupiah(summary.receivablesOverdue)} jatuh tempo` : "Tidak ada yang jatuh tempo"}
            changeTone={summary.receivablesOverdue > 0 ? "negative" : "positive"}
            onClick={() => navigate("/piutang")}
          />
          <StatCard
            icon={CreditCard} tone={summary.payablesOverdue > 0 ? "red" : "orange"} label="Hutang Belum Dibayar"
            value={formatRupiah(summary.payablesOutstanding)}
            change={summary.payablesOverdue > 0 ? `${formatRupiah(summary.payablesOverdue)} jatuh tempo` : "Tidak ada yang jatuh tempo"}
            changeTone={summary.payablesOverdue > 0 ? "negative" : "positive"}
            onClick={() => navigate("/utang")}
          />
          <StatCard
            icon={AlertTriangle} tone={summary.lowStockCount > 0 ? "orange" : "green"}
            label="Stok Menipis" value={summary.lowStockCount}
            change={`dari ${summary.totalProducts} total produk`} changeTone="neutral"
          />
          <StatCard
            icon={PackageSearch} tone={summary.needsReorderCount > 0 ? "orange" : "green"}
            label="Perlu Reorder (ROP)" value={summary.needsReorderCount}
            change={
              summary.reorderMonitoredCount > 0
                ? `dari ${summary.reorderMonitoredCount} produk dipantau ROP`
                : "Belum ada produk yang diatur Lead Time-nya"
            }
            changeTone="neutral"
            onClick={() => navigate("/reorder-point")}
          />
        </div>

        <div className="grid-2 mb-4">
          <div className="card chart-card">
            <div className="dashboard-chart-header">
              <div className="chart-card__title">Tren Pendapatan — {range.label}</div>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent-blue)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--accent-blue)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}rb`} />
                <Tooltip
                  contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: 10, fontSize: 12, boxShadow: "var(--shadow)" }}
                  labelStyle={{ fontWeight: 700, marginBottom: 4, color: "var(--text-primary)" }}
                  formatter={(v) => [formatRupiah(v), "Pendapatan"]}
                  cursor={{ stroke: "var(--accent-blue)", strokeWidth: 1, strokeDasharray: "4 4" }}
                />
                <Area
                  type="monotone" dataKey="revenue" stroke="var(--accent-blue)" fill="url(#revenueGradient)" strokeWidth={2}
                  dot={{ r: 3, stroke: "var(--accent-blue)", strokeWidth: 2, fill: "var(--bg-card)" }}
                  activeDot={{ r: 5, stroke: "var(--accent-blue)", strokeWidth: 2, fill: "var(--accent-blue)" }}
                  isAnimationActive={!loadingPeriod}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <SectionHeader
              title={`Ringkasan Laba Rugi (${range.label})`}
              subtitle="Berdasarkan filter tanggal yang dipilih"
              action={<Link to="/laba-rugi" className="btn btn-ghost btn-sm"><FileBarChart2 size={14} /> Detail</Link>}
            />
            {loadingIncome || !incomeStatement ? (
              <div className="text-sm text-muted">Memuat ringkasan laba rugi...</div>
            ) : (
              <>
                <div className="statement-row">
                  <span className="statement-label">Pendapatan Bersih</span>
                  <span className="statement-value">{formatRupiah(incomeStatement.revenue.net_sales)}</span>
                </div>
                <div className={`statement-row ${incomeStatement.gross_profit >= 0 ? "statement-row--positive" : "statement-row--negative"}`}>
                  <span className="statement-label">Laba Kotor</span>
                  <span className="statement-value">{formatRupiah(incomeStatement.gross_profit)}</span>
                </div>
                <div className="statement-row">
                  <span className="statement-label">Beban Operasional</span>
                  <span className="statement-value">{formatRupiah(incomeStatement.operating_expenses.total)}</span>
                </div>
                <div className={`statement-row statement-row--total ${incomeStatement.net_profit >= 0 ? "statement-row--positive" : "statement-row--negative"}`}>
                  <span className="statement-label">
                    {incomeStatement.net_profit >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    Laba Bersih
                  </span>
                  <span className="statement-value">{formatRupiah(incomeStatement.net_profit)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="grid-2 mb-4">
          <div className="card">
            <div className="flex items-center gap-3 mb-3">
              <div className="dashboard-section-icon dashboard-section-icon--blue"><Award size={16} /></div>
              <div>
                <div className="ui-section-header__title">Penjualan Terlaris</div>
                <div className="ui-section-header__subtitle">5 produk dengan omzet tertinggi — {range.label}</div>
              </div>
            </div>
            {(periodSummary?.topProducts || []).length === 0 ? (
              <div className="text-sm text-muted">Belum ada penjualan tercatat pada periode ini.</div>
            ) : (
              <div className="dashboard-rank-list">
                {(() => {
                  const products = periodSummary.topProducts;
                  const maxRevenue = Math.max(...products.map((p) => p.revenue), 1);
                  return products.map((p, idx) => (
                    <div className="dashboard-rank-item" key={`${p.name}-${idx}`}>
                      <div className={`dashboard-rank-item__badge dashboard-rank-item__badge--${idx + 1}`}>{idx + 1}</div>
                      <div className="dashboard-rank-item__body">
                        <div className="dashboard-rank-item__row">
                          <div className="dashboard-rank-item__title">{p.name}</div>
                          <div className="dashboard-rank-item__value">{formatRupiah(p.revenue)}</div>
                        </div>
                        <div className="dashboard-rank-item__subtitle">{p.category} · {formatQty(p.qty)} {p.base_unit || "unit"} terjual</div>
                        <RankBar value={p.revenue} max={maxRevenue} />
                      </div>
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>

          <div className="card">
            <div className="flex items-center gap-3 mb-3">
              <div className="dashboard-section-icon dashboard-section-icon--red"><Receipt size={16} /></div>
              <div>
                <div className="ui-section-header__title">Beban Perusahaan</div>
                <div className="ui-section-header__subtitle">Pengeluaran per kategori — {range.label}</div>
              </div>
            </div>
            {(periodSummary?.expensesByCategory || []).length === 0 ? (
              <div className="text-sm text-muted">Belum ada beban tercatat pada periode ini.</div>
            ) : (
              <div className="dashboard-rank-list">
                {(() => {
                  const expenses = periodSummary.expensesByCategory;
                  const maxExpense = Math.max(...expenses.map((e) => e.total), 1);
                  return expenses.map((e, idx) => (
                    <div className="dashboard-rank-item" key={`${e.category}-${idx}`}>
                      <div className="dashboard-rank-item__badge">{idx + 1}</div>
                      <div className="dashboard-rank-item__body">
                        <div className="dashboard-rank-item__row">
                          <div className="dashboard-rank-item__title">{e.category}</div>
                          <div className="dashboard-rank-item__value">{formatRupiah(e.total)}</div>
                        </div>
                        <div className="dashboard-rank-item__subtitle">{e.entry_count} entri pengeluaran</div>
                        <RankBar value={e.total} max={maxExpense} variant="expense" />
                      </div>
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="chart-card__title">Jumlah Transaksi per Hari — {range.label}</div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--text-muted)" fontSize={11} allowDecimals={false} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: 10, fontSize: 12, boxShadow: "var(--shadow)" }}
                labelStyle={{ fontWeight: 700, marginBottom: 4, color: "var(--text-primary)" }}
                formatter={(v) => [v, "Transaksi"]}
                cursor={{ stroke: "var(--accent-purple)", strokeWidth: 1, strokeDasharray: "4 4" }}
              />
              <Area
                type="monotone" dataKey="tx" stroke="var(--accent-purple)" fill="var(--accent-purple)" fillOpacity={0.15} strokeWidth={2}
                dot={{ r: 3, stroke: "var(--accent-purple)", strokeWidth: 2, fill: "var(--bg-card)" }}
                activeDot={{ r: 5, stroke: "var(--accent-purple)", strokeWidth: 2, fill: "var(--accent-purple)" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card mt-4">
          <div className="flex items-center gap-3">
            <Package size={18} className="text-muted" />
            <div className="text-sm text-muted">
              Total {summary.totalProducts} produk aktif terdaftar di sistem.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}