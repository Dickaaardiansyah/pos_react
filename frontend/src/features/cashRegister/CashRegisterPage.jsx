// src/features/cashRegister/CashRegisterPage.jsx
// ─────────────────────────────────────────────────────────────────────────────
// VIEW LAYER — Kas Kecil (Cash Register): buka kas dengan modal awal, catat
// pengeluaran/pemasukan kas insidental (mis. sedekah, transportasi), lalu
// tutup kas dengan merekonsiliasi hasil hitung fisik terhadap saldo sistem.
// Halaman ini hanya menyusun tata letak & mengoper data/aksi dari hook ke
// komponen presentasional — seluruh state bisnis ada di useCashRegister.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { PlusCircle, MinusCircle, Lock } from "lucide-react";
import { useCashRegister } from "./hooks";
import { useAuth } from "../../context/AuthContext";
import { PageLoader } from "../../components/UI";
import { OpenShiftModal, CloseShiftModal } from "../../components/ShiftModals";
import NoShiftScreen from "../../components/NoShiftScreen";
import CashShiftSummary from "./components/CashShiftSummary";
import CashMovementsTable from "./components/CashMovementsTable";
import CashMovementModal from "./components/CashMovementModal";
import CashHistoryTable from "./components/CashHistoryTable";
import CashShiftDetailModal from "./components/CashShiftDetailModal";

const TABS = [
  { id: "kas", label: "Kas Berjalan" },
  { id: "riwayat", label: "Riwayat Tutup Kas" },
];

export default function CashRegister() {
  const cr = useCashRegister();
  const { isAdmin } = useAuth();
  const [showIn, setShowIn] = useState(false);
  const [showOut, setShowOut] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [showOpen, setShowOpen] = useState(false);

  // Admin tidak diizinkan akses "Kas Berjalan" sama sekali — kas kecil
  // adalah tanggung jawab kasir yang sedang bertugas. Admin hanya bisa
  // melihat riwayat sesi kas yang sudah ditutup (lintas kasir) & rekapnya.
  const tabs = isAdmin ? TABS.filter((t) => t.id !== "kas") : TABS.filter((t) => t.id !== "riwayat");

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Kas Kecil</div>
          <div className="page-subtitle">Catat pengeluaran/pemasukan kas tunai &amp; rekonsiliasi tutup kas</div>
        </div>
      </div>

      <div className="page-body">
        <div className="tab-nav">
          {tabs.map((t) => (
            <button key={t.id} className={`tab-btn ${cr.tab === t.id ? "active" : ""}`} onClick={() => cr.setTab(t.id)}>{t.label}</button>
          ))}
        </div>

        {!isAdmin && cr.tab === "kas" && (
          cr.loading ? <PageLoader /> : !cr.shift ? (
            <NoShiftScreen isAdmin={isAdmin} onStart={() => setShowOpen(true)} />
          ) : (
            <div>
              <CashShiftSummary shift={cr.shift} />

              <div className="flex gap-3 mb-4" style={{ flexWrap: "wrap" }}>
                <button className="btn btn-success" onClick={() => setShowIn(true)}><PlusCircle size={16} /> Kas Masuk</button>
                <button className="btn btn-danger" onClick={() => setShowOut(true)}><MinusCircle size={16} /> Kas Keluar</button>
                {/* Tutup kas dibatasi khusus kasir di backend (authorize("cashier")
                    pada routes/cashRegister.routes.js) — admin bisa memantau sesi
                    kas yang sedang berjalan (mis. dibuka kasir lain) di sini, tapi
                    tombolnya disembunyikan supaya tidak mencoba aksi yang pasti
                    ditolak server. */}
                {!isAdmin && (
                  <button className="btn btn-primary" style={{ marginLeft: "auto" }} onClick={() => setShowClose(true)}>
                    <Lock size={16} /> Tutup Kas
                  </button>
                )}
              </div>

              <CashMovementsTable movements={cr.shift.movements} onDelete={cr.deleteMovement} />
            </div>
          )
        )}

        {isAdmin && cr.tab === "riwayat" && (
          <CashHistoryTable
            loading={cr.historyLoading}
            history={cr.history}
            page={cr.historyPage}
            total={cr.historyTotal}
            onPageChange={cr.setHistoryPage}
            onViewDetail={cr.viewHistoryDetail}
          />
        )}
      </div>

      {showOpen && (
        <OpenShiftModal
          opening={cr.opening}
          onSubmit={cr.openShift}
          onClose={() => setShowOpen(false)}
        />
      )}
      {showIn && (
        <CashMovementModal
          title="Catat Kas Masuk" type="in" categories={cr.cashInCategories}
          submitting={cr.movementSubmitting}
          onSubmit={async (form) => { const ok = await cr.addMovement({ type: "in", ...form }); if (ok) setShowIn(false); }}
          onClose={() => setShowIn(false)}
        />
      )}
      {showOut && (
        <CashMovementModal
          title="Catat Kas Keluar (Cash Out)" type="out" categories={cr.cashOutCategories}
          submitting={cr.movementSubmitting}
          onSubmit={async (form) => { const ok = await cr.addMovement({ type: "out", ...form }); if (ok) setShowOut(false); }}
          onClose={() => setShowOut(false)}
        />
      )}
      {showClose && !isAdmin && cr.shift && (
        <CloseShiftModal
          shift={cr.shift} closing={cr.closing}
          onSubmit={async (form) => { const ok = await cr.closeShift(form); if (ok) setShowClose(false); }}
          onClose={() => setShowClose(false)}
        />
      )}

      {cr.selectedHistory && <CashShiftDetailModal shift={cr.selectedHistory} onClose={() => cr.setSelectedHistory(null)} />}
    </div>
  );
}