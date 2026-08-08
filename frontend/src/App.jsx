// frontend/src/App.jsx
import { useState, Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { Menu } from "lucide-react";
import { Toaster } from "react-hot-toast";
import toast from "react-hot-toast";
import { queryClient } from "./lib/queryClient";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ShiftProvider } from "./context/ShiftContext";
import { PrinterProvider } from "./context/PrinterContext";
import Sidebar from "./components/Sidebar";
import NotificationBell from "./components/NotificationBell";
import { PageLoader } from "./components/UI";

// Setiap halaman di-lazy-load per route — dulu semuanya masuk satu bundle
// ~1MB, sekarang tiap fitur baru diunduh browser saat rutenya dikunjungi.
const LoginPage = lazy(() => import("./features/auth/LoginPage"));
const DashboardPage = lazy(() => import("./features/dashboard/DashboardPage"));
const CashierPage = lazy(() => import("./features/cashier/CashierPage"));
const ProductsPage = lazy(() => import("./features/products/ProductsPage"));
const ReorderPointPage = lazy(() => import("./features/reorderPoint/ReorderPointPage"));
const TransactionsPage = lazy(() => import("./features/transactions/TransactionsPage"));
const ReportsPage = lazy(() => import("./features/reports/ReportsPage"));
const PurchasePage = lazy(() => import("./features/purchase/PurchasePage"));
const SettingsPage = lazy(() => import("./features/settings/SettingsPage"));
const LabaRugiPage = lazy(() => import("./features/labaRugi/LabaRugiPage"));
const StockOpnamePage = lazy(() => import("./features/stockOpname/StockOpnamePage"));
const StockMutationPage = lazy(() => import("./features/stockMutation/StockMutationPage"));
const CashRegisterPage = lazy(() => import("./features/cashRegister/CashRegisterPage"));
const JournalPage = lazy(() => import("./features/journal/JournalPage"));
const CustomersPage = lazy(() => import("./features/customers/CustomersPage"));
const PiutangPage = lazy(() => import("./features/receivables/PiutangPage"));
const UtangPage = lazy(() => import("./features/payables/UtangPage"));

// Halaman "beranda" masing-masing role setelah login / saat akses ditolak.
function homeRouteFor(user) {
  return user?.role === "admin" ? "/dashboard" : "/kasir";
}

function PrivateLayout({ children, adminOnly = false }) {
  const { user, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading) return <PageLoader text="Memuat sesi..." />;
  if (!user) return <Navigate to="/login" replace />;

  if (adminOnly && user.role !== "admin") {
    toast.error("Anda tidak memiliki akses ke halaman ini");
    return <Navigate to={homeRouteFor(user)} replace />;
  }

  return (
    <div className="app-layout">
      <Sidebar open={sidebarOpen} onNavigate={() => setSidebarOpen(false)} />

      {/* Backdrop gelap — hanya efektif di mobile karena sidebarOpen cuma bisa
          jadi true lewat tombol hamburger (yang juga cuma tampil di mobile) */}
      {sidebarOpen && (
        <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
      )}

      <main className="main-content">
        {/* Topbar menyatu dalam alur halaman (bukan lagi elemen fixed yang
            mengambang) — supaya lonceng notifikasi tidak pernah menimpa
            elemen halaman lain (mis. avatar profil di Dashboard). Hamburger
            & judul hanya tampil di mobile (lihat layout.css), lonceng selalu
            tampil untuk admin. */}
        <div className="app-topbar">
          <div className="app-topbar__mobile-group">
            <button
              className="mobile-menu-btn"
              onClick={() => setSidebarOpen((v) => !v)}
              aria-label="Buka menu"
            >
              <Menu size={20} />
            </button>
            <span className="mobile-topbar__title">
              POS<span>System</span>
            </span>
          </div>
          <div className="app-topbar__spacer" />
          <NotificationBell />
        </div>
        <Suspense fallback={<PageLoader text="Memuat halaman..." />}>{children}</Suspense>
      </main>
    </div>
  );
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={
          user ? (
            <Navigate to={homeRouteFor(user)} replace />
          ) : (
            <Suspense fallback={<PageLoader text="Memuat..." />}>
              <LoginPage />
            </Suspense>
          )
        }
      />

      {/* Halaman khusus admin: dashboard, manajemen produk, laporan, pembelian,
          stok, akuntansi. Kasir yang mencoba mengakses akan dialihkan. */}
      <Route path="/dashboard" element={<PrivateLayout adminOnly><DashboardPage /></PrivateLayout>} />
      <Route path="/produk" element={<PrivateLayout adminOnly><ProductsPage /></PrivateLayout>} />
      <Route path="/reorder-point" element={<PrivateLayout adminOnly><ReorderPointPage /></PrivateLayout>} />
      <Route path="/laporan" element={<PrivateLayout adminOnly><ReportsPage /></PrivateLayout>} />
      <Route path="/pembelian" element={<PrivateLayout adminOnly><PurchasePage /></PrivateLayout>} />
      <Route path="/stock-opname" element={<PrivateLayout adminOnly><StockOpnamePage /></PrivateLayout>} />
      <Route path="/mutasi-stok" element={<PrivateLayout adminOnly><StockMutationPage /></PrivateLayout>} />
      <Route path="/jurnal" element={<PrivateLayout adminOnly><JournalPage /></PrivateLayout>} />
      <Route path="/laba-rugi" element={<PrivateLayout adminOnly><LabaRugiPage /></PrivateLayout>} />
      <Route path="/piutang" element={<PrivateLayout><PiutangPage /></PrivateLayout>} />
      <Route path="/utang" element={<PrivateLayout adminOnly><UtangPage /></PrivateLayout>} />

      {/* Halaman yang boleh diakses kasir maupun admin. */}
      <Route path="/kasir" element={<PrivateLayout><CashierPage /></PrivateLayout>} />
      <Route path="/transaksi" element={<PrivateLayout><TransactionsPage /></PrivateLayout>} />
      <Route path="/kas-kecil" element={<PrivateLayout><CashRegisterPage /></PrivateLayout>} />
      <Route path="/pelanggan" element={<PrivateLayout><CustomersPage /></PrivateLayout>} />
      <Route path="/pengaturan" element={<PrivateLayout><SettingsPage /></PrivateLayout>} />

      <Route path="*" element={<Navigate to={homeRouteFor(user)} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <ShiftProvider>
            <PrinterProvider>
              <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
              <AppRoutes />
            </PrinterProvider>
          </ShiftProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}