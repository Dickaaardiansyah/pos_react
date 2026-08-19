// src/features/dashboard/components/RevenueChart.jsx
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { formatRupiah } from "../../../utils/format";

export default function RevenueChart({ data, periodLabel, loading }) {
  return (
    <div className="card chart-card">
      <div className="dashboard-chart-header">
        <div className="chart-card__title">Tren Pendapatan — {periodLabel}</div>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
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
            isAnimationActive={!loading}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
