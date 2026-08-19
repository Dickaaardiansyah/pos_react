// src/features/dashboard/components/ExpenseRanking.jsx
import { Receipt } from "lucide-react";
import { formatRupiah } from "../../../utils/format";
import RankBar from "./RankBar";

export default function ExpenseRanking({ expenses, periodLabel }) {
  return (
    <div className="card">
      <div className="flex items-center gap-3 mb-3">
        <div className="dashboard-section-icon dashboard-section-icon--red"><Receipt size={16} /></div>
        <div>
          <div className="ui-section-header__title">Beban Perusahaan</div>
          <div className="ui-section-header__subtitle">Pengeluaran per kategori — {periodLabel}</div>
        </div>
      </div>
      {expenses.length === 0 ? (
        <div className="text-sm text-muted">Belum ada beban tercatat pada periode ini.</div>
      ) : (
        <ExpenseRankingList expenses={expenses} />
      )}
    </div>
  );
}

function ExpenseRankingList({ expenses }) {
  const maxExpense = Math.max(...expenses.map((e) => e.total), 1);
  return (
    <div className="dashboard-rank-list">
      {expenses.map((e, idx) => (
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
      ))}
    </div>
  );
}
