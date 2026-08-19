// src/features/dashboard/utils/dashboardHelper.js
// Pure functions only — no JSX, no side effects. Anything that renders
// markup belongs in ../components instead.

function pad(n) {
  return String(n).padStart(2, "0");
}

export function toISODate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Tanggal hari ini dalam format ISO (YYYY-MM-DD). Satu-satunya sumber
// kebenaran untuk "hari ini" di fitur dashboard — dipakai baik oleh
// hooks.js (perhitungan rentang filter) maupun komponen (link ke halaman
// transaksi hari ini).
export function today() {
  return toISODate(new Date());
}

export function currentYear() {
  return new Date().getFullYear();
}

export function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return parts.length === 1
    ? parts[0].slice(0, 2).toUpperCase()
    : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function formatChangeText(pct) {
  if (pct === null) return "Belum ada data kemarin";
  const arrow = pct >= 0 ? "↑" : "↓";
  return `${arrow} ${Math.abs(pct)}% dari kemarin`;
}

// Persentase lebar bar (0–100) untuk item ranking, dibatasi max 100.
export function rankBarPercent(value, max) {
  return max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
}
