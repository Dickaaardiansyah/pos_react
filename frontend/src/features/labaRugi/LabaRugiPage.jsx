// src/features/labaRugi/LabaRugiPage.jsx
// ─────────────────────────────────────────────────────────────────────────────
// VIEW LAYER — Laporan Laba Rugi (Income Statement) & Biaya Operasional.
// Menyediakan 5 jenis laporan agar user mudah memilih laporan yang sesuai
// kebutuhannya: Standar, Multi Year, Kuartal, Multi Periode, dan
// Perbandingan Periode — meniru pola pemilihan laporan pada software
// akuntansi (mis. Accurate/Jurnal).
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import toast from "react-hot-toast";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import {
  TrendingUp, TrendingDown, Plus, Trash2, Pencil, Printer, FileDown, FileSpreadsheet,
  ChevronLeft, FileBarChart2, CalendarClock, CalendarDays, LineChart as LineChartIcon, GitCompareArrows,
} from "lucide-react";
import { useLabaRugi, EMPTY_EXPENSE_FORM } from "./hooks";
import { PageLoader, EmptyState, SectionHeader, RupiahInput } from "../../components/UI";
import { formatRupiah, formatDate } from "../../utils/format";
import {
  printLabaRugiReport, exportLabaRugiPDF, exportLabaRugiExcel,
  printMultiColumnLabaRugi, exportMultiColumnLabaRugiExcel,
  printComparisonLabaRugi, exportComparisonLabaRugiExcel,
} from "../../utils/printLabaRugi";

const REPORT_ICONS = {
  standard: FileBarChart2,
  multiYear: CalendarClock,
  quarterly: CalendarDays,
  multiPeriod: LineChartIcon,
  comparison: GitCompareArrows,
};

export default function LabaRugi() {
  const lr = useLabaRugi();

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Laporan Laba Rugi</div>
          <div className="page-subtitle">Analisis profitabilitas &amp; biaya operasional toko</div>
        </div>
        {lr.tab === "statement" && lr.reportType && (
          <ReportActions lr={lr} />
        )}
      </div>

      <div className="page-body">
        <div className="tab-nav">
          <button className={`tab-btn ${lr.tab === "statement" ? "active" : ""}`} onClick={() => lr.setTab("statement")}>
            <FileBarChart2 size={14} /> Laporan Laba Rugi
          </button>
          <button className={`tab-btn ${lr.tab === "expenses" ? "active" : ""}`} onClick={() => lr.setTab("expenses")}>
            Biaya Operasional
          </button>
        </div>

        {lr.tab === "expenses" ? (
          <ExpensesTab lr={lr} />
        ) : !lr.reportType ? (
          <ReportPicker lr={lr} />
        ) : (
          <>
            <button className="btn btn-ghost btn-sm mb-3" onClick={lr.backToPicker}>
              <ChevronLeft size={14} /> Pilih jenis laporan lain
            </button>
            <ReportFilterBar lr={lr} />
            {lr.loading ? <PageLoader /> : <ReportContent lr={lr} />}
          </>
        )}
      </div>
    </div>
  );
}

// ── Pemilihan jenis laporan ─────────────────────────────────────────────────
function ReportPicker({ lr }) {
  return (
    <div className="report-picker">
      {lr.reportTypes.map((r) => {
        const Icon = REPORT_ICONS[r.id] || FileBarChart2;
        return (
          <button key={r.id} className="report-picker__item" onClick={() => lr.selectReportType(r.id)}>
            <span className="report-picker__icon"><Icon size={22} /></span>
            <span className="report-picker__text">
              <span className="report-picker__title">{r.title}</span>
              <span className="report-picker__desc">{r.description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── Filter bar khusus per jenis laporan ─────────────────────────────────────
function ReportFilterBar({ lr }) {
  const t = lr.reportType;

  if (t === "standard") {
    return (
      <div className="filter-bar">
        <input type="date" className="form-input" value={lr.startDate} onChange={(e) => lr.setStartDate(e.target.value)} />
        <span className="text-muted text-sm">s/d</span>
        <input type="date" className="form-input" value={lr.endDate} onChange={(e) => lr.setEndDate(e.target.value)} />
      </div>
    );
  }

  if (t === "multiYear") {
    return (
      <div className="filter-bar">
        <span className="text-muted text-sm">Tahun akhir</span>
        <input
          type="number" className="form-input" style={{ width: 100 }}
          value={lr.multiYearEndYear}
          onChange={(e) => lr.setMultiYearEndYear(Number(e.target.value) || lr.multiYearEndYear)}
        />
        <span className="text-muted text-sm">Jumlah tahun</span>
        <select className="form-select" style={{ width: 90 }} value={lr.multiYearSpan} onChange={(e) => lr.setMultiYearSpan(Number(e.target.value))}>
          {[2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} thn</option>)}
        </select>
      </div>
    );
  }

  if (t === "quarterly") {
    return (
      <div className="filter-bar">
        <span className="text-muted text-sm">Tahun</span>
        <input
          type="number" className="form-input" style={{ width: 100 }}
          value={lr.quarterlyYear}
          onChange={(e) => lr.setQuarterlyYear(Number(e.target.value) || lr.quarterlyYear)}
        />
      </div>
    );
  }

  if (t === "multiPeriod") {
    return (
      <div className="filter-bar">
        <input type="date" className="form-input" value={lr.multiPeriodStart} onChange={(e) => lr.setMultiPeriodStart(e.target.value)} />
        <span className="text-muted text-sm">s/d</span>
        <input type="date" className="form-input" value={lr.multiPeriodEnd} onChange={(e) => lr.setMultiPeriodEnd(e.target.value)} />
      </div>
    );
  }

  if (t === "comparison") {
    return (
      <div className="filter-bar flex-col items-start gap-2">
        <div className="flex gap-2 items-center">
          <span className="text-muted text-sm" style={{ width: 70 }}>Periode 1</span>
          <input type="date" className="form-input" value={lr.period1Start} onChange={(e) => lr.setPeriod1Start(e.target.value)} />
          <span className="text-muted text-sm">s/d</span>
          <input type="date" className="form-input" value={lr.period1End} onChange={(e) => lr.setPeriod1End(e.target.value)} />
        </div>
        <div className="flex gap-2 items-center">
          <span className="text-muted text-sm" style={{ width: 70 }}>Periode 2</span>
          <input type="date" className="form-input" value={lr.period2Start} onChange={(e) => lr.setPeriod2Start(e.target.value)} />
          <span className="text-muted text-sm">s/d</span>
          <input type="date" className="form-input" value={lr.period2End} onChange={(e) => lr.setPeriod2End(e.target.value)} />
        </div>
      </div>
    );
  }

  return null;
}

// ── Tombol cetak / ekspor, menyesuaikan jenis laporan aktif ────────────────
function ReportActions({ lr }) {
  const t = lr.reportType;

  function handlePrint() {
    if (t === "standard" && lr.statement) {
      printLabaRugiReport(lr.statement, lr.storeSettings);
    } else if (t === "multiYear" && lr.multiYearReport) {
      const r = lr.multiYearReport;
      printMultiColumnLabaRugi({
        title: "Laba/Rugi (Multi Year)",
        periodLabel: `per ${r.end_year}`,
        columns: [...r.periods, { label: "Total", summary: r.total }],
        storeSettings: lr.storeSettings,
      });
    } else if (t === "quarterly" && lr.quarterlyReport) {
      const r = lr.quarterlyReport;
      printMultiColumnLabaRugi({
        title: "Laba/Rugi (Kuartal)",
        periodLabel: `Tahun ${r.year}`,
        columns: [...r.periods, { label: "Total", summary: r.total }],
        storeSettings: lr.storeSettings,
      });
    } else if (t === "multiPeriod" && lr.multiPeriodReport) {
      const r = lr.multiPeriodReport;
      printMultiColumnLabaRugi({
        title: "Laba/Rugi (Multi Periode)",
        periodLabel: `Tanggal ${formatDate(r.period.startDate)} - ${formatDate(r.period.endDate)}`,
        columns: [...r.periods, { label: "Total", summary: r.total }],
        storeSettings: lr.storeSettings,
      });
    } else if (t === "comparison" && lr.comparisonReport) {
      printComparisonLabaRugi({ ...lr.comparisonReport, storeSettings: lr.storeSettings });
    }
  }

  async function handleExportExcel() {
    try {
      if (t === "standard" && lr.statement) {
        await exportLabaRugiExcel(lr.statement, lr.storeSettings);
      } else if (t === "multiYear" && lr.multiYearReport) {
        const r = lr.multiYearReport;
        await exportMultiColumnLabaRugiExcel({
          title: "Laba/Rugi (Multi Year)", periodLabel: `per ${r.end_year}`,
          columns: [...r.periods, { label: "Total", summary: r.total }],
          storeSettings: lr.storeSettings, filename: `Laba_Rugi_Multi_Year_${r.end_year}.xlsx`,
        });
      } else if (t === "quarterly" && lr.quarterlyReport) {
        const r = lr.quarterlyReport;
        await exportMultiColumnLabaRugiExcel({
          title: "Laba/Rugi (Kuartal)", periodLabel: `Tahun ${r.year}`,
          columns: [...r.periods, { label: "Total", summary: r.total }],
          storeSettings: lr.storeSettings, filename: `Laba_Rugi_Kuartal_${r.year}.xlsx`,
        });
      } else if (t === "multiPeriod" && lr.multiPeriodReport) {
        const r = lr.multiPeriodReport;
        await exportMultiColumnLabaRugiExcel({
          title: "Laba/Rugi (Multi Periode)", periodLabel: `${r.period.startDate} s/d ${r.period.endDate}`,
          columns: [...r.periods, { label: "Total", summary: r.total }],
          storeSettings: lr.storeSettings, filename: `Laba_Rugi_Multi_Periode.xlsx`,
        });
      } else if (t === "comparison" && lr.comparisonReport) {
        await exportComparisonLabaRugiExcel({ ...lr.comparisonReport, storeSettings: lr.storeSettings });
      }
    } catch {
      toast.error("Gagal membuat Excel");
    }
  }

  return (
    <div className="flex gap-2">
      <button className="btn btn-ghost btn-sm" onClick={handlePrint}>
        <Printer size={14} /> Cetak
      </button>
      {t === "standard" && (
        <button
          className="btn btn-ghost btn-sm"
          onClick={async () => {
            try { await exportLabaRugiPDF(lr.statement, lr.storeSettings); }
            catch { toast.error("Gagal membuat PDF"); }
          }}
        >
          <FileDown size={14} /> Export PDF
        </button>
      )}
      <button className="btn btn-ghost btn-sm" onClick={handleExportExcel}>
        <FileSpreadsheet size={14} /> Export Excel
      </button>
    </div>
  );
}

// ── Konten laporan, sesuai jenis yang aktif ────────────────────────────────
function ReportContent({ lr }) {
  const t = lr.reportType;
  if (t === "standard") return <StatementTab lr={lr} />;
  if (t === "multiYear" && lr.multiYearReport) {
    const r = lr.multiYearReport;
    return (
      <MultiColumnStatement
        title={`Laba/Rugi (Multi Year)`}
        subtitle={`per ${r.end_year} · ${r.years} tahun terakhir`}
        columns={[...r.periods, { label: "Total", summary: r.total }]}
      />
    );
  }
  if (t === "quarterly" && lr.quarterlyReport) {
    const r = lr.quarterlyReport;
    return (
      <MultiColumnStatement
        title={`Laba/Rugi (Kuartal)`}
        subtitle={`Tahun ${r.year}`}
        columns={[...r.periods, { label: "Total", summary: r.total }]}
      />
    );
  }
  if (t === "multiPeriod" && lr.multiPeriodReport) {
    const r = lr.multiPeriodReport;
    return (
      <MultiColumnStatement
        title={`Laba/Rugi (Multi Periode)`}
        subtitle={`${formatDate(r.period.startDate)} – ${formatDate(r.period.endDate)}`}
        columns={[...r.periods, { label: "Total", summary: r.total }]}
      />
    );
  }
  if (t === "comparison" && lr.comparisonReport) {
    return <ComparisonStatement report={lr.comparisonReport} />;
  }
  return <PageLoader />;
}

// ── Baris ringkasan generik untuk laporan multi-kolom & perbandingan ──────
const SUMMARY_ROWS = [
  { type: "section", label: "PENDAPATAN" },
  { type: "value", label: "Jumlah Pendapatan", key: "net_sales" },
  { type: "section", label: "BEBAN POKOK PENJUALAN" },
  { type: "value", label: "Jumlah Beban Pokok Penjualan", key: "total_cogs" },
  { type: "subtotal", label: "LABA KOTOR", key: "gross_profit" },
  { type: "section", label: "BEBAN OPERASIONAL" },
  { type: "value", label: "Jumlah Beban Operasional", key: "operating_expenses_total" },
  { type: "subtotal", label: "PENDAPATAN OPERASIONAL", key: "operating_profit" },
  { type: "section", label: "PENDAPATAN DAN BEBAN NON OPERASIONAL" },
  { type: "label", label: "Pendapatan Non Operasional" },
  { type: "value", label: "Jumlah Pendapatan Non Operasional", key: "non_operational_revenue", indent: true },
  { type: "label", label: "Beban Non Operasional" },
  { type: "value", label: "Jumlah Beban Non Operasional", key: "non_operational_expense", indent: true },
  { type: "subtotal", label: "Jumlah Pendapatan dan Beban Non Operasional", key: "non_operational_net" },
  { type: "total", label: "LABA BERSIH", key: "net_profit" },
];

function fmtSigned(v) {
  const n = Number(v || 0);
  return n < 0 ? `(${formatRupiah(Math.abs(n))})` : formatRupiah(n);
}

function MultiColumnStatement({ title, subtitle, columns }) {
  return (
    <div className="card">
      <SectionHeader title={title} subtitle={subtitle} />
      <div className="table-container">
        <table className="statement-table">
          <thead>
            <tr>
              <th>Deskripsi</th>
              {columns.map((c) => <th key={c.label} className="text-right">{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {SUMMARY_ROWS.map((row, i) => {
              if (row.type === "section") {
                return (
                  <tr key={i} className="statement-table__section">
                    <td colSpan={columns.length + 1}>{row.label}</td>
                  </tr>
                );
              }
              if (row.type === "label") {
                return (
                  <tr key={i} className="statement-table__indent">
                    <td>{row.label}</td>
                    {columns.map((c) => <td key={c.label}></td>)}
                  </tr>
                );
              }
              return (
                <tr
                  key={i}
                  className={[
                    row.indent ? "statement-table__indent" : "",
                    row.type === "subtotal" ? "statement-table__subtotal" : "",
                    row.type === "total" ? "statement-table__total" : "",
                  ].filter(Boolean).join(" ")}
                >
                  <td>{row.label}</td>
                  {columns.map((c) => (
                    <td key={c.label} className="text-right font-mono">{fmtSigned(c.summary?.[row.key])}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ComparisonStatement({ report }) {
  const { period1, period2, variance } = report;
  return (
    <div className="card">
      <SectionHeader title="Laba/Rugi (Perbandingan Periode)" subtitle={`${period1.label}  dan  ${period2.label}`} />
      <div className="table-container">
        <table className="statement-table">
          <thead>
            <tr>
              <th>Deskripsi</th>
              <th className="text-right">{period1.label}</th>
              <th className="text-right">{period2.label}</th>
              <th className="text-right">Variance</th>
              <th className="text-right">% Var.</th>
            </tr>
          </thead>
          <tbody>
            {SUMMARY_ROWS.map((row, i) => {
              if (row.type === "section") {
                return <tr key={i} className="statement-table__section"><td colSpan={5}>{row.label}</td></tr>;
              }
              if (row.type === "label") {
                return (
                  <tr key={i} className="statement-table__indent">
                    <td>{row.label}</td><td></td><td></td><td></td><td></td>
                  </tr>
                );
              }
              const v1 = period1.summary?.[row.key];
              const v2 = period2.summary?.[row.key];
              const varr = variance?.[row.key] || { diff: 0, pct: 0 };
              const varPositive = varr.diff >= 0;
              return (
                <tr
                  key={i}
                  className={[
                    row.indent ? "statement-table__indent" : "",
                    row.type === "subtotal" ? "statement-table__subtotal" : "",
                    row.type === "total" ? "statement-table__total" : "",
                  ].filter(Boolean).join(" ")}
                >
                  <td>{row.label}</td>
                  <td className="text-right font-mono">{fmtSigned(v1)}</td>
                  <td className="text-right font-mono">{fmtSigned(v2)}</td>
                  <td className={`text-right font-mono ${varPositive ? "text-success" : "text-danger"}`}>{fmtSigned(varr.diff)}</td>
                  <td className={`text-right font-mono ${varPositive ? "text-success" : "text-danger"}`}>{varr.pct}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatementTab({ lr }) {
  const st = lr.statement;
  if (!st) return null;
  const isProfit = st.net_profit >= 0;

  return (
    <div className="grid-2">
      <div className="card">
        <SectionHeader title="Laporan Laba Rugi" subtitle={`${formatDate(st.period.startDate)} – ${formatDate(st.period.endDate)}`} />
        <div className="statement">
          <div className="statement-section-title">Pendapatan</div>
          <div className="statement-row"><span>Penjualan Kotor</span><span className="statement-value">{formatRupiah(st.revenue.gross_sales)}</span></div>
          <div className="statement-row statement-row--indent"><span>Diskon Penjualan</span><span className="statement-value">-{formatRupiah(st.revenue.total_discount)}</span></div>
          <div className="statement-row statement-row--subtotal"><span>Pendapatan Bersih</span><span className="statement-value">{formatRupiah(st.revenue.net_sales)}</span></div>

          <div className="statement-section-title">Harga Pokok Penjualan (HPP)</div>
          <div className="statement-row"><span>HPP ({st.cost_of_goods_sold.units_sold} unit terjual)</span><span className="statement-value">-{formatRupiah(st.cost_of_goods_sold.total_cogs)}</span></div>
          <div className="statement-row statement-row--subtotal"><span>Laba Kotor</span><span className="statement-value">{formatRupiah(st.gross_profit)}</span></div>

          <div className="statement-section-title">Beban Operasional</div>
          {st.operating_expenses.by_category.length === 0 ? (
            <div className="statement-row statement-row--indent"><span>Tidak ada catatan biaya</span><span className="statement-value">Rp 0</span></div>
          ) : st.operating_expenses.by_category.map((e) => (
            <div key={e.category} className="statement-row statement-row--indent"><span>{e.category}</span><span className="statement-value">-{formatRupiah(e.total)}</span></div>
          ))}
          <div className="statement-row statement-row--subtotal"><span>Laba Operasional</span><span className="statement-value">{formatRupiah(st.operating_profit)}</span></div>

          {st.tax.enabled && (
            <>
              <div className="statement-section-title">Pajak</div>
              <div className="statement-row"><span>Pajak Penghasilan ({st.tax.rate_percent}%)</span><span className="statement-value">-{formatRupiah(st.tax.amount)}</span></div>
            </>
          )}

          <div className={`statement-row statement-row--total ${isProfit ? "statement-row--positive" : "statement-row--negative"}`}>
            <span className="statement-label">{isProfit ? <TrendingUp size={16} /> : <TrendingDown size={16} />} Laba Bersih</span>
            <span className="statement-value">{formatRupiah(st.net_profit)}</span>
          </div>
        </div>
      </div>

      <div className="flex-col gap-4">
        <div className="card">
          <SectionHeader title="Rasio & Analisis Keuangan" subtitle="Perhitungan akuntansi lanjutan" />
          <div className="ratio-grid">
            <RatioCard label="Margin Laba Kotor" value={`${st.ratios.gross_profit_margin_percent}%`} />
            <RatioCard label="Margin Laba Operasional" value={`${st.ratios.operating_profit_margin_percent}%`} />
            <RatioCard label="Margin Laba Bersih" value={`${st.ratios.net_profit_margin_percent}%`} />
            <RatioCard label="Rasio HPP" value={`${st.ratios.cogs_ratio_percent}%`} />
            <RatioCard label="Rasio Beban Operasional" value={`${st.ratios.operating_expense_ratio_percent}%`} />
            <RatioCard
              label="Perputaran Persediaan"
              value={st.inventory.inventory_turnover_ratio !== null ? `${st.inventory.inventory_turnover_ratio}x` : "-"}
            />
          </div>
        </div>

        <div className="card">
          <SectionHeader title="Nilai Persediaan & Titik Impas" />
          <div className="statement-row"><span>Nilai Persediaan (harga modal)</span><span className="statement-value">{formatRupiah(st.inventory.ending_inventory_at_cost)}</span></div>
          <div className="statement-row"><span>Nilai Persediaan (harga jual)</span><span className="statement-value">{formatRupiah(st.inventory.ending_inventory_at_retail)}</span></div>
          <div className="statement-row"><span>Total Unit di Gudang</span><span className="statement-value">{st.inventory.total_units_in_stock}</span></div>
          <div className="divider" />
          <div className="statement-row"><span>Rasio Margin Kontribusi</span><span className="statement-value">{st.break_even_analysis.contribution_margin_ratio_percent}%</span></div>
          <div className="statement-row statement-row--subtotal">
            <span>Estimasi Titik Impas (Break-Even)</span>
            <span className="statement-value">
              {st.break_even_analysis.estimated_break_even_revenue !== null ? formatRupiah(st.break_even_analysis.estimated_break_even_revenue) : "Tidak dapat dihitung"}
            </span>
          </div>
          <div className="text-xs text-muted mt-2">
            Estimasi pendapatan yang dibutuhkan agar laba operasional = 0, dengan asumsi seluruh beban operasional bersifat tetap pada periode berjalan.
          </div>
        </div>

        {lr.trendChartData.length > 0 && (
          <div className="card chart-card">
            <div className="chart-card__title">Tren Laba Kotor 12 Bulan Terakhir</div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={lr.trendChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={11} />
                <YAxis stroke="var(--text-muted)" fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}rb`} />
                <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: 8, fontSize: 12 }} formatter={(v) => formatRupiah(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="Pendapatan" stroke="var(--accent-blue)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="HPP" stroke="var(--accent-orange)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Laba Kotor" stroke="var(--accent-green)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

function RatioCard({ label, value }) {
  return (
    <div className="ratio-card">
      <div className="ratio-label">{label}</div>
      <div className="ratio-value">{value}</div>
    </div>
  );
}

function ExpensesTab({ lr }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  function openCreate() { setEditing(null); setShowForm(true); }
  function openEdit(expense) { setEditing(expense); setShowForm(true); }

  const totalExpense = lr.expenses.reduce((s, e) => s + Number(e.amount), 0);

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
              {lr.expenses.map((e) => (
                <tr key={e.id}>
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
              ))}
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

function ExpenseFormModal({ categories, editExpense, onSubmit, onClose }) {
  const [form, setForm] = useState(editExpense ? { ...editExpense } : EMPTY_EXPENSE_FORM);
  const [submitting, setSubmitting] = useState(false);

  function setField(name, value) { setForm((f) => ({ ...f, [name]: value })); }

  async function submit() {
    setSubmitting(true);
    const ok = await onSubmit(form);
    setSubmitting(false);
    if (ok) onClose();
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal--small">
        <div className="modal-header"><h2 className="modal-title">{editExpense ? "Edit Biaya" : "Catat Biaya Operasional"}</h2></div>
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
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Batal</button>
          <button className="btn btn-primary" onClick={submit} disabled={submitting}>{submitting ? "Menyimpan..." : "Simpan"}</button>
        </div>
      </div>
    </div>
  );
}