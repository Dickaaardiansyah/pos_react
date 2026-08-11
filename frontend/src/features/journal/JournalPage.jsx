// src/features/journal/JournalPage.jsx
// ─────────────────────────────────────────────────────────────────────────────
// VIEW LAYER — Jurnal Akuntansi Otomatis: Chart of Accounts, Jurnal Umum
// (riwayat posting otomatis + input jurnal manual), Buku Besar per akun, dan
// Neraca Saldo.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { Plus, Trash2, Eye, X, BookOpen, ScrollText } from "lucide-react";
import { useJournal } from "./hooks";
import { PageLoader, EmptyState, Pagination, Badge, RupiahInput } from "../../components/UI";
import { formatRupiah, formatDate, formatDateTime } from "../../utils/format";

const TABS = [
  { id: "jurnal", label: "Jurnal Umum" },
  { id: "buku-besar", label: "Buku Besar" },
  { id: "neraca", label: "Neraca Saldo" },
  { id: "arus-kas", label: "Arus Kas" },
  { id: "coa", label: "Chart of Accounts" },
];

const REFERENCE_LABELS = {
  sale: "Penjualan",
  purchase: "Pembelian",
  expense: "Biaya Operasional",
  cash_movement: "Kas Kecil",
  cash_shift_close: "Tutup Kas",
  stock_opname: "Stock Opname",
  capital: "Modal Usaha",
  receivable_payment: "Pembayaran Piutang",
  payable_payment: "Pembayaran Hutang",
  payable_creation: "Pencatatan Hutang Manual",
  other_payable: "Pencairan Pinjaman/Utang Lain",
  other_payable_payment: "Cicilan Pinjaman/Utang Lain",
  manual: "Manual",
  void: "Pembatalan Transaksi",
};

const REFERENCE_BADGE = {
  sale: "green",
  purchase: "blue",
  expense: "orange",
  cash_movement: "purple",
  cash_shift_close: "red",
  stock_opname: "orange",
  capital: "purple",
  receivable_payment: "green",
  payable_payment: "orange",
  payable_creation: "orange",
  other_payable: "purple",
  other_payable_payment: "orange",
  manual: "blue",
  void: "red",
};

export default function Journal() {
  const j = useJournal();

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Jurnal Akuntansi</div>
          <div className="page-subtitle">Pembukuan otomatis (debit/kredit) dari seluruh transaksi &mdash; jurnal umum, buku besar, neraca saldo &amp; arus kas</div>
        </div>
      </div>

      <div className="page-body">
        <div className="tab-nav">
          {TABS.map((t) => (
            <button key={t.id} className={`tab-btn ${j.tab === t.id ? "active" : ""}`} onClick={() => j.setTab(t.id)}>{t.label}</button>
          ))}
        </div>

        {j.tab === "jurnal" && <JurnalUmum j={j} />}
        {j.tab === "buku-besar" && <BukuBesar j={j} />}
        {j.tab === "neraca" && <NeracaSaldo j={j} />}
        {j.tab === "arus-kas" && <ArusKas j={j} />}
        {j.tab === "coa" && <ChartOfAccounts j={j} />}
      </div>

      {j.selectedEntry && <EntryDetailModal entry={j.selectedEntry} onClose={() => j.setSelectedEntry(null)} />}
    </div>
  );
}

// ─── Jurnal Umum ────────────────────────────────────────────────────────────
function JurnalUmum({ j }) {
  return (
    <div>
      <div className="grid-2 mb-4">
        <ManualEntryForm j={j} />
        <div className="card">
          <div className="chart-card__title">Filter Riwayat Jurnal</div>
          <div className="form-group">
            <label className="form-label">Jenis Transaksi</label>
            <select className="form-select" value={j.referenceTypeFilter} onChange={(e) => { j.setReferenceTypeFilter(e.target.value); j.setEntriesPage(1); }}>
              <option value="">Semua Jenis</option>
              {Object.entries(REFERENCE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div className="statement-row"><span>Total Jurnal Ditemukan</span><span className="statement-value">{j.entriesTotal}</span></div>
        </div>
      </div>

      <div className="card">
        <div className="chart-card__title">Riwayat Jurnal Umum</div>
        {j.entriesLoading ? <PageLoader /> : j.entries.length === 0 ? (
          <EmptyState icon={ScrollText} title="Belum ada jurnal" description="Jurnal akan otomatis muncul dari transaksi penjualan, pembelian, biaya, kas kecil, dsb." />
        ) : (
          <>
            <div className="table-container">
              <table>
                <thead>
                  <tr><th>Kode</th><th>Tanggal</th><th>Jenis</th><th>Keterangan</th><th>Total Debit</th><th>Total Kredit</th><th>Sumber</th><th></th></tr>
                </thead>
                <tbody>
                  {j.entries.map((e) => (
                    <tr key={e.id}>
                      <td className="font-mono text-xs">{e.entry_code}</td>
                      <td className="text-sm">{formatDate(e.entry_date)}</td>
                      <td><Badge variant={REFERENCE_BADGE[e.reference_type] || "blue"}>{REFERENCE_LABELS[e.reference_type] || e.reference_type}</Badge></td>
                      <td className="text-sm">{e.description}{e.reference_code ? ` (${e.reference_code})` : ""}</td>
                      <td className="font-mono">{formatRupiah(e.total_debit)}</td>
                      <td className="font-mono">{formatRupiah(e.total_credit)}</td>
                      <td className="text-sm">{e.source === "auto" ? <Badge variant="green">Otomatis</Badge> : <Badge variant="blue">Manual</Badge>}</td>
                      <td className="flex gap-2">
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => j.viewEntryDetail(e.id)}><Eye size={14} /></button>
                        {e.source === "manual" && (
                          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => j.deleteEntry(e.id)}><Trash2 size={14} /></button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={j.entriesPage} totalPages={Math.max(1, Math.ceil(j.entriesTotal / 20))} total={j.entriesTotal} limit={20} onPageChange={j.setEntriesPage} />
          </>
        )}
      </div>
    </div>
  );
}

function ManualEntryForm({ j }) {
  return (
    <div className="card">
      <div className="chart-card__title">Input Jurnal Manual</div>
      <div className="form-group">
        <label className="form-label">Tanggal</label>
        <input type="date" className="form-input" value={j.manualDate} onChange={(e) => j.setManualDate(e.target.value)} />
      </div>
      <div className="form-group">
        <label className="form-label">Keterangan</label>
        <input className="form-input" placeholder="Mis. Koreksi jurnal penjualan 12 Juli" value={j.manualDescription} onChange={(e) => j.setManualDescription(e.target.value)} />
      </div>

      {j.manualLines.map((line, idx) => (
        <div key={idx} className="flex gap-2 mb-2 items-center" style={{ flexWrap: "wrap" }}>
          <input className="form-input" style={{ flex: "1 1 140px" }} placeholder="Kode akun (mis. 1100)" value={line.account_code} onChange={(e) => j.updateManualLine(idx, "account_code", e.target.value)} />
          <RupiahInput className="form-input" style={{ width: 110 }} placeholder="Debit" value={line.debit} onChange={(v) => j.updateManualLine(idx, "debit", v)} />
          <RupiahInput className="form-input" style={{ width: 110 }} placeholder="Kredit" value={line.credit} onChange={(v) => j.updateManualLine(idx, "credit", v)} />
          <input className="form-input" style={{ flex: "1 1 120px" }} placeholder="Keterangan baris" value={line.description} onChange={(e) => j.updateManualLine(idx, "description", e.target.value)} />
          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => j.removeManualLine(idx)}><Trash2 size={14} /></button>
        </div>
      ))}
      <button className="btn btn-ghost btn-sm mb-3" onClick={j.addManualLine}><Plus size={14} /> Tambah Baris</button>

      <div className="statement-row"><span>Total Debit</span><span className="statement-value">{formatRupiah(j.manualTotalDebit)}</span></div>
      <div className="statement-row"><span>Total Kredit</span><span className="statement-value">{formatRupiah(j.manualTotalCredit)}</span></div>
      <div className={`statement-row ${j.manualIsBalanced ? "statement-row--positive" : "statement-row--negative"}`}>
        <span>Status</span><span className="statement-value">{j.manualIsBalanced ? "Balance" : "Belum Balance"}</span>
      </div>

      <button className="btn btn-primary w-full mt-2" onClick={j.submitManualEntry} disabled={j.manualSubmitting || !j.manualIsBalanced}>
        {j.manualSubmitting ? "Memposting..." : "Posting Jurnal"}
      </button>
    </div>
  );
}

function EntryDetailModal({ entry, onClose }) {
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal--large">
        <div className="modal-header">
          <h2 className="modal-title">Detail Jurnal — {entry.entry_code}</h2>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="statement-row"><span>Tanggal</span><span>{formatDate(entry.entry_date)}</span></div>
          <div className="statement-row"><span>Keterangan</span><span>{entry.description}</span></div>
          <div className="statement-row"><span>Jenis</span><span>{REFERENCE_LABELS[entry.reference_type] || entry.reference_type}{entry.reference_code ? ` — ${entry.reference_code}` : ""}</span></div>
          <div className="statement-row"><span>Dibuat oleh</span><span>{entry.created_by}</span></div>
          <div className="divider" />
          <div className="table-container">
            <table>
              <thead>
                <tr><th>Kode Akun</th><th>Nama Akun</th><th>Keterangan</th><th>Debit</th><th>Kredit</th></tr>
              </thead>
              <tbody>
                {entry.lines?.map((l) => (
                  <tr key={l.id}>
                    <td className="font-mono text-xs">{l.account_code}</td>
                    <td className="text-sm">{l.account_name}</td>
                    <td className="text-sm">{l.line_description || "-"}</td>
                    <td className="font-mono">{Number(l.debit) > 0 ? formatRupiah(l.debit) : "-"}</td>
                    <td className="font-mono">{Number(l.credit) > 0 ? formatRupiah(l.credit) : "-"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-bold">
                  <td colSpan={3}>Total</td>
                  <td className="font-mono">{formatRupiah(entry.total_debit)}</td>
                  <td className="font-mono">{formatRupiah(entry.total_credit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Tutup</button>
        </div>
      </div>
    </div>
  );
}

// ─── Buku Besar ─────────────────────────────────────────────────────────────
function BukuBesar({ j }) {
  return (
    <div>
      <div className="card mb-4">
        <div className="chart-card__title">Pilih Akun &amp; Periode</div>
        <div className="flex gap-3 items-end" style={{ flexWrap: "wrap" }}>
          <div className="form-group" style={{ flex: "1 1 220px", marginBottom: 0 }}>
            <label className="form-label">Akun</label>
            <select className="form-select" value={j.ledgerAccountCode} onChange={(e) => j.setLedgerAccountCode(e.target.value)}>
              <option value="">Pilih akun...</option>
              {j.accounts.map((a) => <option key={a.id} value={a.account_code}>{a.account_code} — {a.account_name}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Dari Tanggal</label>
            <input type="date" className="form-input" value={j.ledgerStartDate} onChange={(e) => j.setLedgerStartDate(e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Sampai Tanggal</label>
            <input type="date" className="form-input" value={j.ledgerEndDate} onChange={(e) => j.setLedgerEndDate(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={j.loadLedger} disabled={j.ledgerLoading}>Tampilkan</button>
        </div>
      </div>

      {j.ledgerLoading ? <PageLoader /> : !j.ledger ? (
        <EmptyState icon={BookOpen} title="Belum ada data" description="Pilih akun lalu klik Tampilkan untuk melihat buku besar" />
      ) : (
        <div className="card">
          <div className="chart-card__title">Buku Besar — {j.ledger.account.account_code} {j.ledger.account.account_name}</div>
          <div className="statement-row"><span>Saldo Awal</span><span className="statement-value">{formatRupiah(j.ledger.opening_balance)}</span></div>
          <div className="table-container">
            <table>
              <thead>
                <tr><th>Tanggal</th><th>Kode Jurnal</th><th>Keterangan</th><th>Debit</th><th>Kredit</th><th>Saldo Berjalan</th></tr>
              </thead>
              <tbody>
                {j.ledger.mutations.length === 0 ? (
                  <tr><td colSpan={6} className="text-sm text-muted">Tidak ada mutasi pada periode ini</td></tr>
                ) : j.ledger.mutations.map((m) => (
                  <tr key={m.id}>
                    <td className="text-sm">{formatDate(m.entry_date)}</td>
                    <td className="font-mono text-xs">{m.entry_code}</td>
                    <td className="text-sm">{m.line_description || m.description}</td>
                    <td className="font-mono">{Number(m.debit) > 0 ? formatRupiah(m.debit) : "-"}</td>
                    <td className="font-mono">{Number(m.credit) > 0 ? formatRupiah(m.credit) : "-"}</td>
                    <td className="font-mono font-bold">{formatRupiah(m.running_balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="statement-row statement-row--total"><span>Saldo Akhir</span><span className="statement-value">{formatRupiah(j.ledger.closing_balance)}</span></div>
        </div>
      )}
    </div>
  );
}

// ─── Neraca Saldo ───────────────────────────────────────────────────────────
const TYPE_LABELS = { aset: "Aset", kewajiban: "Kewajiban", modal: "Modal", pendapatan: "Pendapatan", beban: "Beban" };

function NeracaSaldo({ j }) {
  return (
    <div>
      <div className="card mb-4">
        <div className="flex gap-3 items-end" style={{ flexWrap: "wrap" }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Per Tanggal</label>
            <input type="date" className="form-input" value={j.trialBalanceDate} onChange={(e) => j.setTrialBalanceDate(e.target.value)} />
          </div>
        </div>
      </div>

      {j.trialBalanceLoading ? <PageLoader /> : !j.trialBalance ? (
        <EmptyState title="Belum ada data" description="Data neraca saldo tidak tersedia" />
      ) : (
        <>
          <div className="mutation-summary mb-4">
            <div className="mutation-summary__card"><div className="mutation-summary__label">Total Aset</div><div className="mutation-summary__value">{formatRupiah(j.trialBalance.summary.total_aset)}</div></div>
            <div className="mutation-summary__card"><div className="mutation-summary__label">Total Kewajiban</div><div className="mutation-summary__value">{formatRupiah(j.trialBalance.summary.total_kewajiban)}</div></div>
            <div className="mutation-summary__card"><div className="mutation-summary__label">Total Modal</div><div className="mutation-summary__value">{formatRupiah(j.trialBalance.summary.total_modal)}</div></div>
            <div className="mutation-summary__card"><div className="mutation-summary__label">Laba/Rugi Berjalan</div><div className={`mutation-summary__value ${j.trialBalance.summary.laba_rugi_berjalan >= 0 ? "text-positive" : "text-negative"}`}>{formatRupiah(j.trialBalance.summary.laba_rugi_berjalan)}</div></div>
            <div className="mutation-summary__card">
              <div className="mutation-summary__label">Selisih Neraca</div>
              <div className={`mutation-summary__value ${j.trialBalance.summary.selisih_neraca === 0 ? "text-positive" : "text-negative"}`}>{formatRupiah(j.trialBalance.summary.selisih_neraca)}</div>
              <div className="mutation-summary__sub">Aset − (Kewajiban + Modal + Laba Berjalan)</div>
            </div>
          </div>

          <div className="card">
            <div className="chart-card__title">Neraca Saldo</div>
            <div className="table-container">
              <table>
                <thead>
                  <tr><th>Kode</th><th>Nama Akun</th><th>Tipe</th><th>Total Debit</th><th>Total Kredit</th><th>Saldo</th></tr>
                </thead>
                <tbody>
                  {j.trialBalance.accounts.filter((a) => a.total_debit > 0 || a.total_credit > 0).map((a) => (
                    <tr key={a.account_id}>
                      <td className="font-mono text-xs">{a.account_code}</td>
                      <td className="text-sm">{a.account_name}</td>
                      <td><Badge variant="blue">{TYPE_LABELS[a.account_type]}</Badge></td>
                      <td className="font-mono">{formatRupiah(a.total_debit)}</td>
                      <td className="font-mono">{formatRupiah(a.total_credit)}</td>
                      <td className="font-mono font-bold">{formatRupiah(a.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Arus Kas ────────────────────────────────────────────────────────────
const CASH_FLOW_SECTIONS = [
  { id: "operasi", title: "Aktivitas Operasi" },
  { id: "investasi", title: "Aktivitas Investasi" },
  { id: "pendanaan", title: "Aktivitas Pendanaan" },
];

function ArusKas({ j }) {
  const cf = j.cashFlow;
  return (
    <div>
      <div className="card mb-4">
        <div className="flex gap-3 items-end" style={{ flexWrap: "wrap" }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Dari Tanggal</label>
            <input type="date" className="form-input" value={j.cashFlowStartDate} onChange={(e) => j.setCashFlowStartDate(e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Sampai Tanggal</label>
            <input type="date" className="form-input" value={j.cashFlowEndDate} onChange={(e) => j.setCashFlowEndDate(e.target.value)} />
          </div>
        </div>
      </div>

      {j.cashFlowLoading ? <PageLoader /> : !cf ? (
        <EmptyState title="Belum ada data" description="Data arus kas tidak tersedia" />
      ) : (
        <>
          <div className="mutation-summary mb-4">
            <div className="mutation-summary__card">
              <div className="mutation-summary__label">Saldo Kas Awal</div>
              <div className="mutation-summary__value">{formatRupiah(cf.openingBalance)}</div>
            </div>
            <div className="mutation-summary__card">
              <div className="mutation-summary__label">Arus Kas Bersih</div>
              <div className={`mutation-summary__value ${cf.netCashFlow >= 0 ? "text-positive" : "text-negative"}`}>
                {formatRupiah(cf.netCashFlow)}
              </div>
            </div>
            <div className="mutation-summary__card">
              <div className="mutation-summary__label">Saldo Kas Akhir</div>
              <div className="mutation-summary__value">{formatRupiah(cf.closingBalance)}</div>
              <div className="mutation-summary__sub">Kas (1100) + Kas di Bank (1150)</div>
            </div>
          </div>

          {CASH_FLOW_SECTIONS.map((section) => {
            const data = cf.activities?.[section.id];
            if (!data) return null;
            return (
              <div className="card mb-4" key={section.id}>
                <div className="flex items-center justify-between mb-3">
                  <div className="chart-card__title" style={{ marginBottom: 0 }}>{section.title}</div>
                  <div className={`font-mono font-bold ${data.net >= 0 ? "text-success" : "text-danger"}`}>
                    {formatRupiah(data.net)}
                  </div>
                </div>
                {data.items.length === 0 ? (
                  <div className="text-sm text-muted">Tidak ada mutasi kas pada periode ini</div>
                ) : (
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr><th>Jenis Transaksi</th><th>Kas Masuk</th><th>Kas Keluar</th><th>Bersih</th></tr>
                      </thead>
                      <tbody>
                        {data.items.map((it) => (
                          <tr key={it.reference_type}>
                            <td>{it.label}</td>
                            <td className="font-mono text-success">{it.inflow > 0 ? formatRupiah(it.inflow) : "-"}</td>
                            <td className="font-mono text-danger">{it.outflow > 0 ? formatRupiah(it.outflow) : "-"}</td>
                            <td className={`font-mono ${it.net >= 0 ? "text-success" : "text-danger"}`}>{formatRupiah(it.net)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td className="font-bold">Subtotal</td>
                          <td className="font-mono font-bold text-success">{formatRupiah(data.inflow)}</td>
                          <td className="font-mono font-bold text-danger">{formatRupiah(data.outflow)}</td>
                          <td className={`font-mono font-bold ${data.net >= 0 ? "text-success" : "text-danger"}`}>{formatRupiah(data.net)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

// ─── Chart of Accounts ──────────────────────────────────────────────────────
function ChartOfAccounts({ j }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ account_code: "", account_name: "", account_type: "beban", normal_balance: "debit", description: "" });
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    const ok = await j.createAccount(form);
    setSubmitting(false);
    if (ok) {
      setForm({ account_code: "", account_name: "", account_type: "beban", normal_balance: "debit", description: "" });
      setShowForm(false);
    }
  }

  return (
    <div className="card">
      <div className="flex gap-3 items-center mb-3" style={{ flexWrap: "wrap" }}>
        <div className="chart-card__title" style={{ marginBottom: 0, flex: 1 }}>Chart of Accounts (Daftar Akun)</div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}><Plus size={14} /> Tambah Akun</button>
      </div>

      {j.accountsLoading ? <PageLoader /> : (
        <div className="table-container">
          <table>
            <thead>
              <tr><th>Kode</th><th>Nama Akun</th><th>Tipe</th><th>Saldo Normal</th><th>Status</th></tr>
            </thead>
            <tbody>
              {j.accounts.map((a) => (
                <tr key={a.id}>
                  <td className="font-mono text-xs">{a.account_code}</td>
                  <td className="text-sm">{a.account_name}</td>
                  <td><Badge variant="blue">{TYPE_LABELS[a.account_type]}</Badge></td>
                  <td className="text-sm">{a.normal_balance === "debit" ? "Debit" : "Kredit"}</td>
                  <td>{a.is_active ? <Badge variant="green">Aktif</Badge> : <Badge variant="red">Nonaktif</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal modal--small">
            <div className="modal-header">
              <h2 className="modal-title">Tambah Akun Baru</h2>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowForm(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Kode Akun</label>
                <input className="form-input" placeholder="Mis. 5320" value={form.account_code} onChange={(e) => setForm((f) => ({ ...f, account_code: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Nama Akun</label>
                <input className="form-input" placeholder="Mis. Beban Internet" value={form.account_name} onChange={(e) => setForm((f) => ({ ...f, account_name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Tipe Akun</label>
                <select className="form-select" value={form.account_type} onChange={(e) => setForm((f) => ({ ...f, account_type: e.target.value }))}>
                  {Object.entries(TYPE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Saldo Normal</label>
                <select className="form-select" value={form.normal_balance} onChange={(e) => setForm((f) => ({ ...f, normal_balance: e.target.value }))}>
                  <option value="debit">Debit</option>
                  <option value="kredit">Kredit</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Deskripsi (opsional)</label>
                <input className="form-input" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowForm(false)} disabled={submitting}>Batal</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>{submitting ? "Menyimpan..." : "Simpan"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}