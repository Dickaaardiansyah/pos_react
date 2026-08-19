// src/features/dashboard/components/RankBar.jsx
import { rankBarPercent } from "../utils/dashboardHelper";

export default function RankBar({ value, max, variant }) {
  const pct = rankBarPercent(value, max);
  return (
    <div className="dashboard-rank-item__bar-track">
      <div
        className={`dashboard-rank-item__bar-fill${variant === "expense" ? " dashboard-rank-item__bar-fill--expense" : ""}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
