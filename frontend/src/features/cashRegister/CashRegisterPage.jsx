// src/features/cashRegister/CashRegisterPage.jsx
// ─────────────────────────────────────────────────────────────────────────────
// VIEW LAYER — Kas Kecil (Cash Register): buka kas dengan modal awal, catat
// pengeluaran/pemasukan kas insidental (mis. sedekah, transportasi), lalu
// tutup kas dengan merekonsiliasi hasil hitung fisik terhadap saldo sistem.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import {
  Wallet, PlusCircle, MinusCircle, Lock, X, Eye, Trash2,
} from "lucide-react";
import { useCashRegister } from "./hooks";
import { useAuth } from "../../context/AuthContext";
import { PageLoader, EmptyState, Pagination, Badge, RupiahInput } from "../../components/UI";
import { OpenShiftModal, CloseShiftModal } from "../../components/ShiftModals";
import NoShiftScreen from "../../components/NoShiftScreen";
import { formatRupiah, formatDateTime } from "../../utils/format";

const TABS = [
  { id: "kas", label: "Kas Berjalan" },
  { id: "riwayat", label: "Riwayat Tutup Kas" },
];

export default function CashRegister() {
  const cr = useCashRegister();
  const { isAdmin } = useAuth();
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

        {!isAdmin && cr.tab === "kas" && (cr.loading ? <PageLoader /> : <KasBerjalan cr={cr} />)}
        {isAdmin && cr.tab === "riwayat" && <RiwayatTutupKas cr={cr} />}
      </div>

      {cr.selectedHistory && <ShiftDetailModal shift={cr.selectedHistory} onClose={() => cr.setSelectedHistory(null)} />}
    </div>
  );
}

// ─── Tab: Kas Berjalan ──────────────────────────────────────────────────────
function KasBerjalan({ cr }) {
  const { isAdmin } = useAuth();
  const [showIn, setShowIn] = useState(false);
  const [showOut, setShowOut] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [showOpen, setShowOpen] = useState(false);

  if (!cr.shift) {
    return (
      <>
        <NoShiftScreen isAdmin={isAdmin} onStart={() => setShowOpen(true)} />
        {showOpen && (
          <OpenShiftModal
            opening={cr.opening}
            onSubmit={cr.openShift}
            onClose={() => setShowOpen(false)}
          />
        )}
      </>
    );
  }

  const s = cr.shift;
  return (
    <div>
      <div className="mutation-summary mb-4">
        <div className="mutation-summary__card">
          <div className="mutation-summary__label">Modal Awal</div>
          <div className="mutation-summary__value">{formatRupiah(s.opening_balance)}</div>
          <div className="mutation-summary__sub">Dibuka {formatDateTime(s.opened_at)}</div>
        </div>
        <div className="mutation-summary__card">
          <div className="mutation-summary__label">Total Penjualan Tunai</div>
          <div className="mutation-summary__value">{formatRupiah(s.total_cash_sales)}</div>
        </div>
        <div className="mutation-summary__card">
          <div className="mutation-summary__label">Total Kas Masuk</div>
          <div className="mutation-summary__value text-positive">+{formatRupiah(s.total_cash_in)}</div>
        </div>
        <div className="mutation-summary__card">
          <div className="mutation-summary__label">Total Kas Keluar</div>
          <div className="mutation-summary__value text-negative">-{formatRupiah(s.total_cash_out)}</div>
        </div>
        {/* FIX (revisi dosen #17): 5 kategori kas yang sebelumnya diabaikan
            di perhitungan tutup kas — sekarang ikut tampil di sini supaya
            kasir bisa lihat kenapa saldo sistem berubah walau dia sendiri
            tidak input apa-apa (mis. kasir lain bayar hutang tunai dari
            modul Hutang saat sesi kas ini masih terbuka). */}
        {Number(s.total_cash_receivable) > 0 && (
          <div className="mutation-summary__card">
            <div className="mutation-summary__label">Pembayaran Piutang Tunai</div>
            <div className="mutation-summary__value text-positive">+{formatRupiah(s.total_cash_receivable)}</div>
          </div>
        )}
        {Number(s.total_cash_capital_in) > 0 && (
          <div className="mutation-summary__card">
            <div className="mutation-summary__label">Setoran Modal Tunai</div>
            <div className="mutation-summary__value text-positive">+{formatRupiah(s.total_cash_capital_in)}</div>
          </div>
        )}
        {Number(s.total_cash_payable) > 0 && (
          <div className="mutation-summary__card">
            <div className="mutation-summary__label">Pembayaran Hutang Tunai</div>
            <div className="mutation-summary__value text-negative">-{formatRupiah(s.total_cash_payable)}</div>
          </div>
        )}
        {Number(s.total_cash_purchase) > 0 && (
          <div className="mutation-summary__card">
            <div className="mutation-summary__label">Pembelian Tunai</div>
            <div className="mutation-summary__value text-negative">-{formatRupiah(s.total_cash_purchase)}</div>
          </div>
        )}
        {Number(s.total_cash_capital_out) > 0 && (
          <div className="mutation-summary__card">
            <div className="mutation-summary__label">Prive (Penarikan Modal) Tunai</div>
            <div className="mutation-summary__value text-negative">-{formatRupiah(s.total_cash_capital_out)}</div>
          </div>
        )}
        {Number(s.total_cash_expense) > 0 && (
          <div className="mutation-summary__card">
            <div className="mutation-summary__label">Biaya Operasional</div>
            <div className="mutation-summary__value text-negative">-{formatRupiah(s.total_cash_expense)}</div>
          </div>
        )}
        <div className="mutation-summary__card">
          <div className="mutation-summary__label">Estimasi Saldo Kas Saat Ini</div>
          <div className="mutation-summary__value">{formatRupiah(s.expected_balance)}</div>
          <div className="mutation-summary__sub">Modal awal + penjualan tunai (termasuk DP Open Bill) + kas masuk + piutang tunai + setoran modal − kas keluar − hutang tunai − pembelian tunai − prive − biaya operasional</div>
        </div>
      </div>

      <div className="ui-alert-note">
        Catatan: saldo di atas sudah mencakup penjualan tunai, kas masuk/keluar manual sesi ini,
        DAN transaksi lain yang memakai laci kas yang sama selama sesi ini terbuka — pembayaran
        piutang/hutang tunai, pembelian tunai ke supplier, setoran/prive modal tunai, dan biaya
        operasional. Kalau kartu-kartu di atas tidak muncul, berarti memang belum ada transaksi
        dari kategori itu pada sesi ini.
      </div>

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

      <div className="card">
        <div className="chart-card__title">Riwayat Pergerakan Kas Sesi Ini</div>
        {s.movements.length === 0 ? (
          <EmptyState icon={Wallet} title="Belum ada pergerakan kas" description="Catat pengeluaran/pemasukan kas tunai lewat tombol di atas" />
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr><th>Waktu</th><th>Jenis</th><th>Kategori</th><th>Jumlah</th><th>Keterangan</th><th>Oleh</th><th></th></tr>
              </thead>
              <tbody>
                {s.movements.map((m) => (
                  <tr key={m.id}>
                    <td className="text-sm">{formatDateTime(m.created_at)}</td>
                    <td>{m.type === "in" ? <Badge variant="green">Kas Masuk</Badge> : <Badge variant="red">Kas Keluar</Badge>}</td>
                    <td className="text-sm">{m.category}</td>
                    <td className={`font-mono font-bold ${m.type === "in" ? "text-positive" : "text-negative"}`}>
                      {m.type === "in" ? "+" : "-"}{formatRupiah(m.amount)}
                    </td>
                    <td className="text-sm">{m.description || "-"}</td>
                    <td className="text-sm">{m.created_by}</td>
                    <td><button className="btn btn-ghost btn-icon btn-sm" onClick={() => cr.deleteMovement(m.id)}><Trash2 size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showIn && (
        <MovementModal
          title="Catat Kas Masuk" type="in" categories={cr.cashInCategories}
          submitting={cr.movementSubmitting}
          onSubmit={async (form) => { const ok = await cr.addMovement({ type: "in", ...form }); if (ok) setShowIn(false); }}
          onClose={() => setShowIn(false)}
        />
      )}
      {showOut && (
        <MovementModal
          title="Catat Kas Keluar (Cash Out)" type="out" categories={cr.cashOutCategories}
          submitting={cr.movementSubmitting}
          onSubmit={async (form) => { const ok = await cr.addMovement({ type: "out", ...form }); if (ok) setShowOut(false); }}
          onClose={() => setShowOut(false)}
        />
      )}
      {showClose && !isAdmin && (
        <CloseShiftModal
          shift={s} closing={cr.closing}
          onSubmit={async (form) => { const ok = await cr.closeShift(form); if (ok) setShowClose(false); }}
          onClose={() => setShowClose(false)}
        />
      )}
    </div>
  );
}

function MovementModal({ title, type, categories, submitting, onSubmit, onClose }) {
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal--small">
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Kategori</label>
            <select className="form-select" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Pilih kategori...</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Jumlah (Rp)</label>
            <RupiahInput placeholder="Contoh: 10.000" value={amount} onChange={(v) => setAmount(v)} />
          </div>
          <div className="form-group">
            <label className="form-label">Keterangan (opsional)</label>
            <input className="form-input" placeholder="Mis. Sedekah ke masjid" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={submitting}>Batal</button>
          <button
            className={`btn ${type === "in" ? "btn-success" : "btn-danger"}`}
            onClick={() => onSubmit({ category, amount, description })}
            disabled={submitting}
          >
            {submitting ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}

// (CloseShiftModal kini diimpor dari ../components/ShiftModals — dipakai
// bersama oleh Sidebar untuk tombol "Selesai Shift")

// (CloseResultModal kini diimpor dari ../components/ShiftModals)

// ─── Tab: Riwayat Tutup Kas ─────────────────────────────────────────────────
function RiwayatTutupKas({ cr }) {
  if (cr.historyLoading) return <PageLoader />;
  if (cr.history.length === 0) {
    return <EmptyState icon={Wallet} title="Belum ada riwayat tutup kas" description="Riwayat akan muncul setelah kamu menutup sesi kas" />;
  }
  return (
    <>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Kode</th><th>Dibuka</th><th>Ditutup</th><th>Modal Awal</th>
              <th>Saldo Sistem</th><th>Kas Fisik</th><th>Selisih</th><th>Oleh</th><th></th>
            </tr>
          </thead>
          <tbody>
            {cr.history.map((s) => (
              <tr key={s.id}>
                <td className="font-mono text-xs">{s.shift_code}</td>
                <td className="text-sm">{formatDateTime(s.opened_at)}</td>
                <td className="text-sm">{formatDateTime(s.closed_at)}</td>
                <td className="font-mono">{formatRupiah(s.opening_balance)}</td>
                <td className="font-mono">{formatRupiah(s.closing_balance_system)}</td>
                <td className="font-mono">{formatRupiah(s.closing_balance_physical)}</td>
                <td>
                  {Number(s.difference) === 0
                    ? <Badge variant="green">Sesuai</Badge>
                    : <Badge variant={Number(s.difference) > 0 ? "blue" : "red"}>{Number(s.difference) > 0 ? "+" : ""}{formatRupiah(s.difference)}</Badge>}
                </td>
                <td className="text-sm">{s.closed_by || "-"}</td>
                <td><button className="btn btn-ghost btn-icon btn-sm" onClick={() => cr.viewHistoryDetail(s.id)}><Eye size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={cr.historyPage} totalPages={Math.max(1, Math.ceil(cr.historyTotal / 20))} total={cr.historyTotal} limit={20} onPageChange={cr.setHistoryPage} />
    </>
  );
}

function ShiftDetailModal({ shift, onClose }) {
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal--large">
        <div className="modal-header">
          <h2 className="modal-title">Detail Sesi Kas — {shift.shift_code}</h2>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="statement-row"><span>Dibuka</span><span>{formatDateTime(shift.opened_at)} oleh {shift.opened_by}</span></div>
          <div className="statement-row"><span>Ditutup</span><span>{formatDateTime(shift.closed_at)} oleh {shift.closed_by}</span></div>
          <div className="statement-row"><span>Modal Awal</span><span className="statement-value">{formatRupiah(shift.opening_balance)}</span></div>
          <div className="statement-row"><span>Total Penjualan Tunai</span><span className="statement-value">{formatRupiah(shift.total_cash_sales)}</span></div>
          <div className="statement-row"><span>Total Kas Masuk</span><span className="statement-value text-positive">+{formatRupiah(shift.total_cash_in)}</span></div>
          <div className="statement-row"><span>Total Kas Keluar</span><span className="statement-value text-negative">-{formatRupiah(shift.total_cash_out)}</span></div>
          {/* FIX (revisi dosen #17): snapshot 5 kategori yang sebelumnya
              tidak pernah tersimpan sama sekali — sekarang ikut ditampilkan
              di riwayat tutup kas, dibaca dari kolom snapshot cash_shifts
              (bukan dihitung ulang, supaya histori tidak berubah walau data
              sumbernya sudah berubah setelah shift ditutup). */}
          {Number(shift.total_cash_receivable) > 0 && (
            <div className="statement-row"><span>Pembayaran Piutang Tunai</span><span className="statement-value text-positive">+{formatRupiah(shift.total_cash_receivable)}</span></div>
          )}
          {Number(shift.total_cash_capital_in) > 0 && (
            <div className="statement-row"><span>Setoran Modal Tunai</span><span className="statement-value text-positive">+{formatRupiah(shift.total_cash_capital_in)}</span></div>
          )}
          {Number(shift.total_cash_payable) > 0 && (
            <div className="statement-row"><span>Pembayaran Hutang Tunai</span><span className="statement-value text-negative">-{formatRupiah(shift.total_cash_payable)}</span></div>
          )}
          {Number(shift.total_cash_purchase) > 0 && (
            <div className="statement-row"><span>Pembelian Tunai</span><span className="statement-value text-negative">-{formatRupiah(shift.total_cash_purchase)}</span></div>
          )}
          {Number(shift.total_cash_capital_out) > 0 && (
            <div className="statement-row"><span>Prive (Penarikan Modal) Tunai</span><span className="statement-value text-negative">-{formatRupiah(shift.total_cash_capital_out)}</span></div>
          )}
          {Number(shift.total_cash_expense) > 0 && (
            <div className="statement-row"><span>Biaya Operasional</span><span className="statement-value text-negative">-{formatRupiah(shift.total_cash_expense)}</span></div>
          )}
          <div className="statement-row statement-row--total"><span>Saldo Sistem</span><span className="statement-value">{formatRupiah(shift.closing_balance_system)}</span></div>
          <div className="statement-row"><span>Kas Fisik</span><span className="statement-value">{formatRupiah(shift.closing_balance_physical)}</span></div>
          <div className={`statement-row ${Number(shift.difference) === 0 ? "" : Number(shift.difference) > 0 ? "statement-row--positive" : "statement-row--negative"}`}>
            <span>Selisih</span><span className="statement-value">{Number(shift.difference) > 0 ? "+" : ""}{formatRupiah(shift.difference)}</span>
          </div>
          {shift.closing_notes && <div className="statement-row"><span>Catatan Tutup Kas</span><span>{shift.closing_notes}</span></div>}
          <div className="divider" />
          <div className="chart-card__title">Pergerakan Kas Selama Sesi</div>
          {shift.movements?.length === 0 ? (
            <div className="text-sm text-muted">Tidak ada pergerakan kas selain penjualan tunai pada sesi ini</div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr><th>Waktu</th><th>Jenis</th><th>Kategori</th><th>Jumlah</th><th>Keterangan</th><th>Oleh</th></tr>
                </thead>
                <tbody>
                  {shift.movements?.map((m) => (
                    <tr key={m.id}>
                      <td className="text-sm">{formatDateTime(m.created_at)}</td>
                      <td>{m.type === "in" ? <Badge variant="green">Kas Masuk</Badge> : <Badge variant="red">Kas Keluar</Badge>}</td>
                      <td className="text-sm">{m.category}</td>
                      <td className={`font-mono font-bold ${m.type === "in" ? "text-positive" : "text-negative"}`}>
                        {m.type === "in" ? "+" : "-"}{formatRupiah(m.amount)}
                      </td>
                      <td className="text-sm">{m.description || "-"}</td>
                      <td className="text-sm">{m.created_by}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Tutup</button>
        </div>
      </div>
    </div>
  );
}