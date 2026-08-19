// src/features/dashboard/components/IncomeStatementSummary.jsx
import { Link } from "react-router-dom";
import { TrendingUp, TrendingDown, FileBarChart2 } from "lucide-react";
import { SectionHeader } from "../../../components/UI";
import { formatRupiah } from "../../../utils/format";

export default function IncomeStatementSummary({ incomeStatement, loading, periodLabel }) {
  return (
    <div className="card">
      <SectionHeader
        title={`Ringkasan Laba Rugi (${periodLabel})`}
        subtitle="Berdasarkan filter tanggal yang dipilih"
        action={<Link to="/laba-rugi" className="btn btn-ghost btn-sm"><FileBarChart2 size={14} /> Detail</Link>}
      />
      {loading || !incomeStatement ? (
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
  );
}
