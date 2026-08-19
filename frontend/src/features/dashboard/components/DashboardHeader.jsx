// src/features/dashboard/components/DashboardHeader.jsx
import { CalendarDays, CircleDot } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { useShift } from "../../../context/ShiftContext";
import { getInitials } from "../utils/dashboardHelper";

export default function DashboardHeader() {
  const { user } = useAuth();
  const { shift } = useShift();
  const todayLabel = new Date().toLocaleDateString("id-ID", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div className="dashboard-header-right">
      <div className="dashboard-header-date">
        <CalendarDays size={14} />
        {todayLabel}
      </div>
      <div className={`dashboard-shift-badge ${shift ? "dashboard-shift-badge--open" : "dashboard-shift-badge--closed"}`}>
        <CircleDot size={10} />
        {shift ? "Shift Aktif" : "Belum Ada Shift"}
      </div>
      <div className="dashboard-avatar" title={user?.name || "Pengguna"}>
        {getInitials(user?.name)}
      </div>
    </div>
  );
}
