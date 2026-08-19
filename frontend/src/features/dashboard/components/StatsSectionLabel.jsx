// src/features/dashboard/components/StatsSectionLabel.jsx
export default function StatsSectionLabel({ icon: Icon, title }) {
  return (
    <div className="dashboard-stats-label">
      <Icon size={13} />
      {title}
    </div>
  );
}
