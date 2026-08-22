// src/features/journal/JournalPage.jsx
// ─────────────────────────────────────────────────────────────────────────────
// VIEW LAYER — Jurnal Akuntansi Otomatis: Chart of Accounts, Jurnal Umum
// (riwayat posting otomatis + input jurnal manual), Buku Besar per akun, dan
// Neraca Saldo.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Trash2, Eye, X, BookOpen, ScrollText, ExternalLink, AlertTriangle } from "lucide-react";
import { useJournal } from "./hooks";
import { PageLoader, EmptyState, Pagination, Badge, RupiahInput, SectionHeader } from "../../components/UI";
import { formatRupiah, formatDate, formatDateTime } from "../../utils/format";

// Urutan tab mengikuti siklus akuntansi: Jurnal Umum → Buku Besar →
// Neraca Saldo (Awal, sebelum penyesuaian) → Jurnal Penyesuaian →
// Neraca Saldo Disesuaikan → Neraca / Laporan Keuangan lain.
const TABS = [
  { id: "jurnal", label: "Jurnal Umum" },
  { id: "buku-besar", label: "Buku Besar" },
  { id: "neraca-saldo", label: "Neraca Saldo" },
  { id: "penyesuaian", label: "Jurnal Penyesuaian" },
  { id: "neraca-saldo-disesuaikan", label: "Neraca Saldo Disesuaikan" },
  { id: "neraca", label: "Neraca" },
  { id: "arus-kas", label: "Arus Kas" },
  { id: "coa", label: "Chart of Accounts" },
  { id: "validasi-sistem", label: "Validasi Sistem" },
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
  adjustment: "Jurnal Penyesuaian",
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
  adjustment: "purple",
  void: "red",
};

// FIX (revisi dosen — poin 1, "pastikan jurnal dapat ditelusuri ke
// transaksi asal"): sebelumnya reference_code cuma ditampilkan sebagai
// teks statis "(EXP-12)", tidak ada cara klik-langsung ke transaksi
// aslinya. Fungsi ini memetakan reference_type suatu entry jurnal ke
// halaman sumbernya, dengan query param yang dibaca halaman tsb untuk
// langsung memfilter/menyorot baris yang dimaksud (lihat useTransactions,
// usePurchase, useLabaRugi) — bukan cuma membuka halaman kosong.
function buildReferenceLink(entry) {
  if (!entry.reference_code) return null;
  const code = entry.reference_code;
  const date = entry.entry_date;
  switch (entry.reference_type) {
    case "sale":
    case "void":
      return `/transaksi?search=${encodeURIComponent(code)}&start_date=${date}&end_date=${date}`;
    case "purchase":
      return `/pembelian?search=${encodeURIComponent(code)}`;
    case "expense":
    case "expense_void": {
      const id = code.replace(/^EXP-/, "");
      return `/laba-rugi?tab=expenses&highlight=${encodeURIComponent(id)}&start_date=${date}&end_date=${date}`;
    }
    case "cash_movement":
    case "cash_movement_void":
    case "cash_shift_close":
      return "/kas-kecil";
    case "capital":
      return "/modal-usaha";
    case "receivable_creation":
    case "receivable_payment":
      return "/piutang";
    case "payable_creation":
    case "payable_payment":
    case "other_payable":
    case "other_payable_payment":
      return "/utang";
    case "stock_opname":
      return "/stock-opname";
    default:
      return null; // manual, adjustment: bukan turunan transaksi lain
  }
}

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
        {j.tab === "neraca-saldo" && <NeracaSaldo j={j} />}
        {j.tab === "penyesuaian" && <JurnalPenyesuaian j={j} />}
        {j.tab === "neraca-saldo-disesuaikan" && <NeracaSaldoDisesuaikan j={j} />}
        {j.tab === "neraca" && <Neraca j={j} />}
        {j.tab === "arus-kas" && <ArusKas j={j} />}
        {j.tab === "coa" && <ChartOfAccounts j={j} />}
        {j.tab === "validasi-sistem" && <ValidasiSistem j={j} />}
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
                  {j.entries.map((e) => {
                    const refLink = buildReferenceLink(e);
                    return (
                    <tr key={e.id}>
                      <td className="font-mono text-xs">{e.entry_code}</td>
                      <td className="text-sm">{formatDate(e.entry_date)}</td>
                      <td><Badge variant={REFERENCE_BADGE[e.reference_type] || "blue"}>{REFERENCE_LABELS[e.reference_type] || e.reference_type}</Badge></td>
                      <td className="text-sm">
                        {e.description}
                        {e.reference_code && (
                          refLink ? (
                            <Link to={refLink} className="text-xs" title="Buka transaksi asal" style={{ marginLeft: 4, whiteSpace: "nowrap" }}>
                              ({e.reference_code} <ExternalLink size={10} style={{ display: "inline", verticalAlign: "middle" }} />)
                            </Link>
                          ) : (
                            ` (${e.reference_code})`
                          )
                        )}
                      </td>
                      <td className="font-mono">{formatRupiah(e.total_debit)}</td>
                      <td className="font-mono">{formatRupiah(e.total_credit)}</td>
                      <td className="text-sm">{e.source === "auto" ? <Badge variant="green">Otomatis</Badge> : <Badge variant="blue">Manual</Badge>}</td>
                      <td className="flex gap-2">
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => j.viewEntryDetail(e.id)}><Eye size={14} /></button>
                        {/* FIX (revisi dosen #17): backend sekarang menolak hard-delete
                            jurnal yang sudah posted (semua jurnal manual & adjustment yang
                            ada saat ini berstatus posted). Tombol Hapus diganti tombol
                            Balik untuk SEMUA jurnal (bukan cuma reference_type "adjustment"
                            seperti sebelumnya) — koreksi jurnal sekarang selalu lewat jurnal
                            pembalik, bukan hapus. */}
                        {!e.reversal_of_id && !e.reversed_by_id && (
                          <button className="btn btn-ghost btn-sm" title="Buat jurnal pembalik untuk mengoreksi" onClick={() => j.reverseEntry(e.id)}>Balik</button>
                        )}
                        {e.reversed_by_id && (
                          <span className="text-xs" style={{ color: "var(--text-secondary, #888)", alignSelf: "center" }} title={`Sudah dibalik lewat ${e.reversed_by_code}`}>Sudah dibalik</span>
                        )}
                      </td>
                    </tr>
                    );
                  })}
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

// ─── Jurnal Penyesuaian ─────────────────────────────────────────────────────
function JurnalPenyesuaian({ j }) {
  return (
    <div className="grid-2">
      <div className="card">
        <div className="chart-card__title">Input Jurnal Penyesuaian</div>
        <div className="page-subtitle mb-3">Untuk beban yang masih harus dibayar (akrual). Untuk DP pelanggan, gunakan Open Bill di halaman Kasir — sudah otomatis.</div>

        <div className="form-group">
          <label className="form-label">Jenis Penyesuaian</label>
          <select className="form-select" value={j.adjTemplateId} onChange={(e) => j.selectAdjTemplate(e.target.value)} disabled={j.adjTemplatesLoading}>
            <option value="">Pilih jenis penyesuaian...</option>
            {j.adjTemplates.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </div>

        {j.adjSelectedTemplate && (
          <>
            <div className="page-subtitle mb-3">{j.adjSelectedTemplate.hint}</div>
            <div className="table-container mb-3">
              <table>
                <thead><tr><th>Akun</th><th>Debit</th><th>Kredit</th></tr></thead>
                <tbody>
                  {j.adjSelectedTemplate.lines.map((l, idx) => (
                    <tr key={idx}>
                      <td className="text-sm">{l.account_code} — {l.description}</td>
                      <td className="font-mono">{l.side === "debit" ? "Rp xxx" : "-"}</td>
                      <td className="font-mono">{l.side === "credit" ? "Rp xxx" : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="form-group">
          <label className="form-label">Tanggal</label>
          <input type="date" className="form-input" value={j.adjDate} onChange={(e) => j.setAdjDate(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Nominal</label>
          <RupiahInput className="form-input" placeholder="0" value={j.adjAmount} onChange={j.setAdjAmount} />
        </div>
        <div className="form-group">
          <label className="form-label">Keterangan</label>
          <input className="form-input" placeholder="Mis. Gaji karyawan Juli belum dibayar" value={j.adjDescription} onChange={(e) => j.setAdjDescription(e.target.value)} />
        </div>

        <button className="btn btn-primary w-full mt-2" onClick={j.submitAdjustingEntry} disabled={j.adjSubmitting || !j.adjSelectedTemplate}>
          {j.adjSubmitting ? "Memposting..." : "Posting Jurnal Penyesuaian"}
        </button>
      </div>

      <div className="card">
        <div className="chart-card__title">Catatan</div>
        <p className="text-sm mb-3">Jurnal penyesuaian akan tercatat di Jurnal Umum dengan label <strong>Jurnal Penyesuaian</strong> dan bisa dilihat/dihapus dari sana.</p>
        <p className="text-sm mb-3">Untuk penyesuaian <strong>akrual beban</strong> (gaji &amp; listrik), buat <strong>Jurnal Pembalik</strong> di awal periode berikutnya lewat tombol &quot;Balik&quot; pada tabel Jurnal Umum — supaya saat beban itu benar-benar dibayar (dicatat lewat menu Biaya Operasional) tidak tercatat dobel.</p>
        <p className="text-sm">Untuk <strong>DP pelanggan</strong>: tidak perlu input manual di sini — gunakan tombol <strong>Open Bill</strong> di halaman Kasir saat checkout. Jurnal (Kas untuk bagian DP, Piutang untuk sisanya) otomatis ter-posting dan tertaut ke transaksi penjualannya.</p>
      </div>
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

// ─── Neraca Saldo (Awal & Disesuaikan) ──────────────────────────────────────
const TYPE_LABELS = { aset: "Aset", kewajiban: "Kewajiban", modal: "Modal", pendapatan: "Pendapatan", beban: "Beban" };

// Komponen generik dipakai untuk 2 tahap siklus akuntansi yang berbeda:
// - Neraca Saldo (Awal): saldo SEBELUM jurnal penyesuaian (exclude_adjustments)
// - Neraca Saldo Disesuaikan: saldo SETELAH jurnal penyesuaian dimasukkan
// Sumber data beda query (lihat hooks.js), tapi tampilannya sama persis.
function TrialBalanceView({ title, note, date, onDateChange, data, loading }) {
  return (
    <div>
      <div className="card mb-4">
        <div className="flex gap-3 items-end" style={{ flexWrap: "wrap" }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Per Tanggal</label>
            <input type="date" className="form-input" value={date} onChange={(e) => onDateChange(e.target.value)} />
          </div>
        </div>
        {note && <p className="text-sm mt-3 mb-0">{note}</p>}
      </div>

      {loading ? <PageLoader /> : !data ? (
        <EmptyState title="Belum ada data" description="Data neraca saldo tidak tersedia" />
      ) : (
        <>
          <div className="mutation-summary mb-4">
            <div className="mutation-summary__card"><div className="mutation-summary__label">Total Debit</div><div className="mutation-summary__value">{formatRupiah(data.summary.total_debit)}</div></div>
            <div className="mutation-summary__card"><div className="mutation-summary__label">Total Kredit</div><div className="mutation-summary__value">{formatRupiah(data.summary.total_credit)}</div></div>
            <div className="mutation-summary__card">
              <div className="mutation-summary__label">Selisih Debit − Kredit</div>
              <div className={`mutation-summary__value ${data.summary.is_seimbang ? "text-positive" : "text-negative"}`}>{formatRupiah(data.summary.selisih_debit_kredit)}</div>
              <div className="mutation-summary__sub">
                <Badge variant={data.summary.is_seimbang ? "green" : "red"}>{data.summary.is_seimbang ? "Seimbang" : "Tidak Seimbang"}</Badge>
              </div>
            </div>
            <div className="mutation-summary__card"><div className="mutation-summary__label">Total Aset</div><div className="mutation-summary__value">{formatRupiah(data.summary.total_aset)}</div></div>
            <div className="mutation-summary__card"><div className="mutation-summary__label">Total Kewajiban</div><div className="mutation-summary__value">{formatRupiah(data.summary.total_kewajiban)}</div></div>
            <div className="mutation-summary__card"><div className="mutation-summary__label">Total Modal</div><div className="mutation-summary__value">{formatRupiah(data.summary.total_modal)}</div></div>
            <div className="mutation-summary__card"><div className="mutation-summary__label">Laba/Rugi Berjalan</div><div className={`mutation-summary__value ${data.summary.laba_rugi_berjalan >= 0 ? "text-positive" : "text-negative"}`}>{formatRupiah(data.summary.laba_rugi_berjalan)}</div></div>
            <div className="mutation-summary__card">
              <div className="mutation-summary__label">Selisih Neraca</div>
              <div className={`mutation-summary__value ${data.summary.selisih_neraca === 0 ? "text-positive" : "text-negative"}`}>{formatRupiah(data.summary.selisih_neraca)}</div>
              <div className="mutation-summary__sub">Aset − (Kewajiban + Modal + Laba Berjalan)</div>
            </div>
            <div className="mutation-summary__card">
              <div className="mutation-summary__label">Saldo Abnormal</div>
              <div className={`mutation-summary__value ${data.summary.has_saldo_abnormal ? "text-negative" : "text-positive"}`}>{data.summary.jumlah_akun_abnormal} akun</div>
              <div className="mutation-summary__sub">
                <Badge variant={data.summary.has_saldo_abnormal ? "orange" : "green"}>{data.summary.has_saldo_abnormal ? "Perlu Diperiksa" : "Semua Wajar"}</Badge>
              </div>
            </div>
          </div>

          {data.summary.has_saldo_abnormal && (
            <div className="card mb-4" style={{ borderLeft: "3px solid var(--accent-orange, #f59e0b)" }}>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={16} style={{ color: "var(--accent-orange, #f59e0b)" }} />
                <div className="chart-card__title" style={{ margin: 0 }}>Ditemukan {data.summary.jumlah_akun_abnormal} Akun Bersaldo Abnormal</div>
              </div>
              <p className="text-sm mb-2">Saldo akun berikut berada di sisi yang tidak wajar (kemungkinan sisi debit/kredit tertukar saat input jurnal) — segera diperiksa:</p>
              <ul className="text-sm" style={{ paddingLeft: 18, margin: 0 }}>
                {data.summary.akun_abnormal.map((a) => (
                  <li key={a.account_code} className="mb-1">{a.note}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="card">
            <div className="chart-card__title">{title}</div>
            <div className="table-container">
              <table>
                <thead>
                  <tr><th>Kode</th><th>Nama Akun</th><th>Tipe</th><th>Total Debit</th><th>Total Kredit</th><th>Saldo</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {data.accounts.filter((a) => a.total_debit > 0 || a.total_credit > 0).map((a) => (
                    <tr key={a.account_id} style={a.is_abnormal ? { background: "rgba(245,158,11,0.06)" } : undefined}>
                      <td className="font-mono text-xs">{a.account_code}</td>
                      <td className="text-sm">{a.account_name}</td>
                      <td><Badge variant="blue">{TYPE_LABELS[a.account_type]}</Badge></td>
                      <td className="font-mono">{formatRupiah(a.total_debit)}</td>
                      <td className="font-mono">{formatRupiah(a.total_credit)}</td>
                      <td className="font-mono font-bold">{formatRupiah(a.balance)}</td>
                      <td>
                        {a.is_abnormal ? (
                          <span title={a.abnormal_note}><Badge variant="orange">Abnormal</Badge></span>
                        ) : (
                          <Badge variant="green">Wajar</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-bold" style={{ borderTop: "2px solid var(--border-color, #ccc)" }}>
                    <td colSpan={3}>Total</td>
                    <td className="font-mono">{formatRupiah(data.summary.total_debit)}</td>
                    <td className="font-mono">{formatRupiah(data.summary.total_credit)}</td>
                    <td colSpan={2}>
                      <Badge variant={data.summary.is_seimbang ? "green" : "red"}>{data.summary.is_seimbang ? "Seimbang" : "Tidak Seimbang"}</Badge>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function NeracaSaldo({ j }) {
  return (
    <TrialBalanceView
      title="Neraca Saldo (Awal)"
      note="Menampilkan saldo dari seluruh jurnal SEBELUM jurnal penyesuaian dimasukkan — dipakai untuk verifikasi debit = kredit sebelum tahap penyesuaian akhir periode."
      date={j.trialBalanceDate}
      onDateChange={j.setTrialBalanceDate}
      data={j.trialBalance}
      loading={j.trialBalanceLoading}
    />
  );
}

function NeracaSaldoDisesuaikan({ j }) {
  return (
    <TrialBalanceView
      title="Neraca Saldo Disesuaikan"
      note="Menampilkan saldo dari seluruh jurnal TERMASUK jurnal penyesuaian — ini yang menjadi dasar penyusunan Laporan Keuangan (Laba Rugi, Modal, Neraca)."
      date={j.adjustedTrialBalanceDate}
      onDateChange={j.setAdjustedTrialBalanceDate}
      data={j.adjustedTrialBalance}
      loading={j.adjustedTrialBalanceLoading}
    />
  );
}

// ─── Neraca (Balance Sheet) ────────────────────────────────────────────────
function NeracaAccountRows({ accounts, emptyLabel }) {
  if (!accounts.length) {
    return (
      <div className="statement-row statement-row--indent">
        <span>{emptyLabel}</span>
        <span className="statement-value">Rp 0</span>
      </div>
    );
  }
  return accounts.map((a) => (
    <div key={a.account_id} className="statement-row statement-row--indent">
      <span>{a.account_name}</span>
      <span className="statement-value">{formatRupiah(a.balance)}</span>
    </div>
  ));
}

function Neraca({ j }) {
  const bs = j.balanceSheet;
  return (
    <div>
      <div className="card mb-4">
        <div className="flex gap-3 items-end" style={{ flexWrap: "wrap" }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Per Tanggal</label>
            <input type="date" className="form-input" value={j.balanceSheetDate} onChange={(e) => j.setBalanceSheetDate(e.target.value)} />
          </div>
        </div>
      </div>

      {j.balanceSheetLoading ? <PageLoader /> : !bs ? (
        <EmptyState title="Belum ada data" description="Data neraca tidak tersedia" />
      ) : (
        <>
          <div className="mutation-summary mb-4">
            <div className="mutation-summary__card"><div className="mutation-summary__label">Total Aset</div><div className="mutation-summary__value">{formatRupiah(bs.aset.total)}</div></div>
            <div className="mutation-summary__card"><div className="mutation-summary__label">Total Kewajiban</div><div className="mutation-summary__value">{formatRupiah(bs.kewajiban.total)}</div></div>
            <div className="mutation-summary__card"><div className="mutation-summary__label">Total Modal (+Laba Berjalan)</div><div className="mutation-summary__value">{formatRupiah(bs.modal.total)}</div></div>
            <div className="mutation-summary__card">
              <div className="mutation-summary__label">Selisih Neraca</div>
              <div className={`mutation-summary__value ${bs.is_balanced ? "text-positive" : "text-negative"}`}>{formatRupiah(bs.selisih)}</div>
              <div className="mutation-summary__sub">Aset − (Kewajiban + Modal)</div>
            </div>
          </div>

          <div className="grid-2">
            <div className="card">
              <SectionHeader title="Aset" subtitle={`Per ${formatDate(bs.as_of_date)}`} />
              <div className="statement">
                {(() => {
                  const kasCodes = ["1100", "1150"];
                  const kasAccounts = bs.aset.accounts.filter((a) => kasCodes.includes(a.account_code));
                  const otherAccounts = bs.aset.accounts.filter((a) => !kasCodes.includes(a.account_code));
                  return (
                    <>
                      <NeracaAccountRows accounts={kasAccounts} emptyLabel="Belum ada saldo kas" />
                      {/* FIX (revisi dosen — poin 7): subtotal Kas+Bank eksplisit di
                          Neraca supaya bisa langsung dibandingkan dengan "Saldo Kas
                          Akhir" di tab Arus Kas, tanpa pembaca perlu jumlah manual. */}
                      <div className="statement-row statement-row--subtotal"><span>Total Kas & Bank</span><span className="statement-value">{formatRupiah(bs.aset.total_kas)}</span></div>
                      <NeracaAccountRows accounts={otherAccounts} emptyLabel="Belum ada saldo aset lainnya" />
                    </>
                  );
                })()}
                <div className="statement-row statement-row--total"><span className="statement-label">TOTAL ASET</span><span className="statement-value">{formatRupiah(bs.aset.total)}</span></div>
              </div>
            </div>

            <div className="card">
              <SectionHeader title="Kewajiban & Modal" subtitle={`Per ${formatDate(bs.as_of_date)}`} />
              <div className="statement">
                <div className="statement-section-title">Kewajiban</div>
                <NeracaAccountRows accounts={bs.kewajiban.accounts} emptyLabel="Belum ada saldo kewajiban" />
                <div className="statement-row statement-row--subtotal"><span>Total Kewajiban</span><span className="statement-value">{formatRupiah(bs.kewajiban.total)}</span></div>

                <div className="statement-section-title">Modal</div>
                <NeracaAccountRows accounts={bs.modal.accounts} emptyLabel="Belum ada saldo modal" />
                <div className="statement-row statement-row--indent"><span>Laba (Rugi) Berjalan</span><span className="statement-value">{formatRupiah(bs.modal.laba_berjalan)}</span></div>
                <div className="statement-row statement-row--subtotal"><span>Total Modal</span><span className="statement-value">{formatRupiah(bs.modal.total)}</span></div>

                <div className="statement-row statement-row--total"><span className="statement-label">TOTAL KEWAJIBAN & MODAL</span><span className="statement-value">{formatRupiah(bs.total_kewajiban_dan_modal)}</span></div>
              </div>
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

// ─── Validasi Sistem — cross-check terpusat antar laporan ──────────────────
// FIX (revisi dosen — poin 10): "Tambahkan indikator Valid/Tidak Valid" untuk
// Debit=Kredit, Aset=Liabilitas+Ekuitas, Laba Rugi=Laba Berjalan, dan
// Kas Arus Kas=Kas Neraca — sebelumnya tersebar sendiri-sendiri di tiap tab,
// sekarang ditarik jadi satu tampilan cross-check.
function ValidasiSistem({ j }) {
  const v = j.systemValidation;
  return (
    <div>
      <div className="card mb-4">
        <div className="form-group" style={{ marginBottom: 0, maxWidth: 220 }}>
          <label className="form-label">Per Tanggal</label>
          <input type="date" className="form-input" value={j.validationDate} onChange={(e) => j.setValidationDate(e.target.value)} />
        </div>
      </div>

      {j.systemValidationLoading ? <PageLoader /> : !v ? (
        <EmptyState title="Belum ada data" description="Data validasi sistem tidak tersedia" />
      ) : (
        <>
          <div className="card mb-4" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Badge variant={v.is_valid ? "green" : "red"}>{v.is_valid ? "VALID" : "TIDAK VALID"}</Badge>
            <span className="text-sm">
              {v.is_valid
                ? "Seluruh laporan keuangan sudah saling konsisten per tanggal ini."
                : "Ada laporan yang TIDAK saling cocok — cek baris bertanda merah di bawah."}
            </span>
          </div>

          <div className="card">
            <div className="chart-card__title">Cross-Check Laporan Keuangan</div>
            <div className="table-container">
              <table>
                <thead>
                  <tr><th>Rumus</th><th>Sisi Kiri</th><th>Sisi Kanan</th><th>Selisih</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {v.checks.map((c) => (
                    <tr key={c.id}>
                      <td className="text-sm font-bold">{c.label}</td>
                      <td className="font-mono text-xs">{c.left_label}<br />{formatRupiah(c.left)}</td>
                      <td className="font-mono text-xs">{c.right_label}<br />{formatRupiah(c.right)}</td>
                      <td className={`font-mono ${c.is_valid ? "text-positive" : "text-negative"}`}>{formatRupiah(c.selisih)}</td>
                      <td><Badge variant={c.is_valid ? "green" : "red"}>{c.is_valid ? "Valid" : "Tidak Valid"}</Badge></td>
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