// src/features/labaRugi/components/MultiColumnStatement.jsx
// ─────────────────────────────────────────────────────────────────────────────
// PRESENTATION — Tabel laba/rugi multi-kolom, dipakai oleh laporan Multi Year,
// Kuartal, dan Multi Periode (satu kolom per periode + kolom Total).
// ─────────────────────────────────────────────────────────────────────────────
import { SectionHeader } from "../../../components/UI";
import { SUMMARY_ROWS, fmtSigned } from "../statementRows";

export default function MultiColumnStatement({ title, subtitle, columns }) {
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