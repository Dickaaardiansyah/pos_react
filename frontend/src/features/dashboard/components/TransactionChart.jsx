// src/features/dashboard/components/TransactionChart.jsx
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function TransactionChart({ data, periodLabel }) {
  return (
    <div className="card">
      <div className="chart-card__title">Jumlah Transaksi per Hari — {periodLabel}</div>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
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
  );
}
