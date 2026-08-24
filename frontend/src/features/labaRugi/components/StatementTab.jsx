// src/features/labaRugi/components/StatementTab.jsx
// ─────────────────────────────────────────────────────────────────────────────
// PRESENTATION — Laporan Laba Rugi Standar: statement lengkap (pendapatan →
// HPP → laba kotor → beban operasional → laba bersih) beserta tren laba kotor
// 12 bulan terakhir.
// ─────────────────────────────────────────────────────────────────────────────
import { LineChart, Line, BarChart, Bar, Cell, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";
import { SectionHeader } from "../../../components/UI";
import { formatRupiah, formatDate } from "../../../utils/format";

export default function StatementTab({ lr }) {
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

          <div className="statement-section-title">Pendapatan &amp; Beban Non Operasional</div>
          <div className="statement-row statement-row--indent"><span>Pendapatan Non Operasional</span><span className="statement-value">{formatRupiah(st.non_operational.revenue.total)}</span></div>
          <div className="statement-row statement-row--indent"><span>Beban Non Operasional</span><span className="statement-value">-{formatRupiah(st.non_operational.expense.total)}</span></div>
          <div className="statement-row statement-row--subtotal"><span>Laba Sebelum Pajak</span><span className="statement-value">{formatRupiah(st.profit_before_tax)}</span></div>

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
        <div className="card chart-card">
          <SectionHeader title="Tren Laba Bersih Bulanan" subtitle="12 bulan terakhir" />
          {lr.trendChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={lr.trendChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={11} />
                <YAxis stroke="var(--text-muted)" fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}rb`} />
                <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: 8, fontSize: 12 }} formatter={(v) => formatRupiah(v)} />
                <Bar dataKey="Laba Bersih" radius={[4, 4, 0, 0]}>
                  {lr.trendChartData.map((entry, i) => (
                    <Cell key={i} fill={entry["Laba Bersih"] >= 0 ? "var(--accent-green)" : "var(--accent-red, #ef4444)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-sm text-muted" style={{ padding: "12px 0" }}>Belum ada data untuk ditampilkan</div>
          )}

          <div className="divider" />
          <div className="statement-row statement-row--subtotal">
            <span>Perputaran Persediaan</span>
            <span className="statement-value">
              {st.inventory.inventory_turnover_ratio !== null ? `${st.inventory.inventory_turnover_ratio}x` : "-"}
            </span>
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