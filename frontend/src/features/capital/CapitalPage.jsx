// src/features/capital/CapitalPage.jsx
// ─────────────────────────────────────────────────────────────────────────────
// VIEW LAYER — Modal Usaha (Owner's Capital): Modal Awal, setoran/penarikan
// modal tambahan, dan ringkasan ekuitas usaha. Sebelumnya jadi salah satu
// tab di dalam Jurnal Akuntansi — sekarang dipisah jadi menu sendiri di
// sidebar supaya tidak tercampur dengan buku besar/jurnal umum, meski di
// balik layar tetap terhubung otomatis lewat jurnal double-entry yang sama
// (lihat CapitalInfoCard). Halaman ini hanya menyusun tata letak — seluruh
// state ada di useCapital, dan setiap bagian tampilan adalah komponen
// presentasional di ./components.
// ─────────────────────────────────────────────────────────────────────────────
import { useCapital } from "./hooks";
import { PageLoader } from "../../components/UI";
import InitialCapitalPrompt from "./components/InitialCapitalPrompt";
import CapitalSummaryCards from "./components/CapitalSummaryCards";
import CapitalForm from "./components/CapitalForm";
import CapitalInfoCard from "./components/CapitalInfoCard";
import EquityStatement from "./components/EquityStatement";
import CapitalTransactionsTable from "./components/CapitalTransactionsTable";

export default function CapitalPage() {
  const c = useCapital();
  const s = c.summary;

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Modal Usaha</div>
          <div className="page-subtitle">Modal Awal, setoran/penarikan modal pemilik, dan ringkasan ekuitas usaha</div>
        </div>
      </div>

      <div className="page-body">
        {!c.summaryLoading && s && !s.has_modal_awal && <InitialCapitalPrompt c={c} />}

        {c.summaryLoading ? <PageLoader /> : s && <CapitalSummaryCards summary={s} />}

        {s && s.has_modal_awal && (
          <div className="grid-2 mb-4">
            <CapitalForm c={c} isInitial={false} />
            <CapitalInfoCard />
          </div>
        )}

        <EquityStatement c={c} />

        <CapitalTransactionsTable c={c} />
      </div>
    </div>
  );
}