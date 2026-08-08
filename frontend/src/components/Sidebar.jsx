// src/components/Sidebar.jsx
import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, ShoppingCart, Package, Receipt, FileBarChart2,
  Truck, FileSpreadsheet, Settings as SettingsIcon, Store, LogOut,
  ClipboardCheck, ArrowLeftRight, Wallet, BookOpen, Users, Lock,
  Coins, Landmark, PackageSearch,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useShift } from "../context/ShiftContext";
import { CloseShiftModal, CloseResultModal } from "./ShiftModals";

// `roles` menentukan siapa yang boleh melihat menu ini. `cashierLabel`
// (opsional) mengganti label untuk kasir — dipakai supaya Kas Kecil tampil
// sebagai "Biaya" di menu kasir, sesuai istilah yang mereka pakai sehari-hari.
const NAV_SECTIONS = [
  {
    label: "Operasional",
    items: [
      { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard", roles: ["admin"] },
      { to: "/kasir", icon: ShoppingCart, label: "Kasir", roles: ["admin", "cashier"] },
      { to: "/produk", icon: Package, label: "Produk", roles: ["admin"] },
      { to: "/reorder-point", icon: PackageSearch, label: "Rekomendasi Restock", roles: ["admin"] },
      { to: "/transaksi", icon: Receipt, label: "Riwayat Transaksi", roles: ["admin", "cashier"] },
      { to: "/pembelian", icon: Truck, label: "Pembelian Stok", roles: ["admin"] },
      { to: "/stock-opname", icon: ClipboardCheck, label: "Stock Opname", roles: ["admin"] },
      { to: "/mutasi-stok", icon: ArrowLeftRight, label: "Mutasi Stok", roles: ["admin"] },
      { to: "/pelanggan", icon: Users, label: "Pelanggan", roles: ["admin", "cashier"] },
    ],
  },
  {
    label: "Keuangan",
    items: [
      { to: "/laporan", icon: FileBarChart2, label: "Laporan", roles: ["admin"] },
      { to: "/laba-rugi", icon: FileSpreadsheet, label: "Laba Rugi", roles: ["admin"] },
      { to: "/piutang", icon: Coins, label: "Open Bill", roles: ["admin", "cashier"] },
      { to: "/utang", icon: Landmark, label: "Utang", roles: ["admin"] },
      { to: "/kas-kecil", icon: Wallet, label: "Kas Kecil", cashierLabel: "Biaya", roles: ["admin", "cashier"] },
      { to: "/jurnal", icon: BookOpen, label: "Jurnal Akuntansi", roles: ["admin"] },
    ],
  },
  {
    label: "Sistem",
    items: [{ to: "/pengaturan", icon: SettingsIcon, label: "Pengaturan", roles: ["admin", "cashier"] }],
  },
];

export default function Sidebar({ open, onNavigate }) {
  const { user, logout } = useAuth();
  const { shift, closing, closeShift, closeResult, setCloseResult } = useShift();
  const [showClose, setShowClose] = useState(false);
  const role = user?.role === "admin" ? "admin" : "cashier";

  const sections = NAV_SECTIONS
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => item.roles.includes(role)),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
      <div className="sidebar-logo">
        <div className="logo-icon"><Store size={18} /></div>
        <div>
          <div className="logo-text">Sumber<span>Rahayu</span></div>
          <div className="logo-sub">Toko sembako</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {sections.map((section) => (
          <div key={section.label}>
            <div className="nav-section-label">{section.label}</div>
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
                onClick={onNavigate}
              >
                <item.icon className="nav-icon" size={18} />
                {role === "cashier" && item.cashierLabel ? item.cashierLabel : item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="divider" style={{ margin: "0 12px" }} />
      <div style={{ padding: 12 }}>
        {/* Tombol "Selesai Shift" langsung di sidebar — kasir tidak perlu lagi
            pindah ke halaman Biaya/Kas Kecil hanya untuk menutup kas. Hanya
            muncul kalau memang ada sesi kas yang sedang berjalan DAN yang
            login adalah kasir — admin tidak diberi akses tutup kas (lihat
            authorize("cashier") di routes/cashRegister.routes.js). */}
        {shift && role !== "admin" && (
          <button className="sidebar-shift-btn" onClick={() => setShowClose(true)}>
            <Lock size={15} /> Selesai Shift
          </button>
        )}
        <div className="text-xs text-muted mb-2">Masuk sebagai <b>{user?.name}</b> ({user?.role === "admin" ? "Admin" : "Kasir"})</div>
        <button className="btn btn-ghost btn-sm w-full" onClick={logout}><LogOut size={14} /> Keluar</button>
      </div>

      {showClose && shift && (
        <CloseShiftModal
          shift={shift}
          closing={closing}
          onSubmit={async (form) => { const ok = await closeShift(form); if (ok) setShowClose(false); }}
          onClose={() => setShowClose(false)}
        />
      )}
      {closeResult && <CloseResultModal shift={closeResult} onClose={() => setCloseResult(null)} />}
    </aside>
  );
}