// src/features/labaRugi/components/ComparisonStatement.jsx
// ─────────────────────────────────────────────────────────────────────────────
// PRESENTATION — Tabel laba/rugi Perbandingan Periode: Periode 1 vs Periode 2
// beserta variance (selisih & persentase).
// ─────────────────────────────────────────────────────────────────────────────
import { SectionHeader } from "../../../components/UI";
import { SUMMARY_ROWS, fmtSigned } from "../statementRows";

export default function ComparisonStatement({ report }) {
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