// src/features/payables/UtangPage.jsx
// ─────────────────────────────────────────────────────────────────────────────
// VIEW LAYER — Pembelian dan Utang: pencatatan hutang ke pemasok, informasi
// jatuh tempo, serta 4 laporan untuk monitoring (Faktur Belum Lunas, Faktur
// Belum Lunas per Pemasok, Umur Utang, Histori Utang). Mirror dari Piutang.jsx.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { Plus, Wallet2, FileText, Truck, Clock, History, Trash2, BadgeDollarSign, Eye, Printer } from "lucide-react";
import {
  usePayables,
  usePayableForm,
  usePayablePayment,
} from "./hooks";
import { PageLoader, EmptyState, SearchInput, Badge, StatCard, RupiahInput } from "../../components/UI";
import { formatRupiah, formatDate, formatQty } from "../../utils/format";

const TABS = [
  { id: "unpaid", label: "Faktur Belum Lunas", icon: FileText },
  { id: "per_supplier", label: "Faktur Belum Lunas per Pemasok", icon: Truck },
  { id: "aging", label: "Umur Utang", icon: Clock },
  { id: "history", label: "Histori Utang", icon: History },
];

const STATUS_BADGE = { belum_lunas: "red", sebagian: "orange", lunas: "green" };
const STATUS_LABEL = { belum_lunas: "Belum Lunas", sebagian: "Sebagian", lunas: "Lunas" };

function dueInfo(dueDate) {
  const days = Math.ceil((new Date(dueDate) - new Date(new Date().toDateString())) / 86400000);
  if (days < 0) return { variant: "red", text: `Terlambat ${Math.abs(days)} hari` };
  if (days === 0) return { variant: "orange", text: "Jatuh tempo hari ini" };
  if (days <= 7) return { variant: "orange", text: `${days} hari lagi` };
  return { variant: "blue", text: `${days} hari lagi` };
}

export default function Utang() {
  const pp = usePayables();
  const [showForm, setShowForm] = useState(false);
  const [payTarget, setPayTarget] = useState(null);

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Pembelian Dan Utang</div>
          <div className="page-subtitle">Pencatatan hutang ke pemasok, jatuh tempo, dan laporan untuk monitoring</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          <Plus size={16} /> Catat Utang
        </button>
      </div>

      <div className="page-body">
        {pp.summary && (
          <div className="stats-grid mb-4">
            <StatCard icon={Wallet2} tone="blue" label="Total Utang Belum Lunas" value={formatRupiah(pp.summary.total_hutang)} />
            <StatCard icon={FileText} tone="purple" label="Jumlah Faktur Belum Lunas" value={pp.summary.total_faktur_belum_lunas} />
            <StatCard icon={Clock} tone="red" label="Utang Jatuh Tempo" value={formatRupiah(pp.summary.total_jatuh_tempo)} change={`${pp.summary.jumlah_jatuh_tempo} faktur`} changeTone="negative" />
          </div>
        )}

        <div className="tab-nav">
          {TABS.map((t) => (
            <button key={t.id} className={`tab-btn ${pp.tab === t.id ? "active" : ""}`} onClick={() => pp.setTab(t.id)}>
              <t.icon size={15} /> {t.label}
            </button>
          ))}
        </div>

        {pp.tab === "unpaid" && <UnpaidTab pp={pp} onPay={setPayTarget} />}
        {pp.tab === "per_supplier" && <PerSupplierTab pp={pp} />}
        {pp.tab === "aging" && <AgingTab pp={pp} />}
        {pp.tab === "history" && <HistoryTab pp={pp} />}
      </div>

      {showForm && (
        <PayableFormModal suppliers={pp.suppliers} onSuccess={pp.reload} onClose={() => setShowForm(false)} />
      )}
      {payTarget && (
        <PayablePaymentModal payable={payTarget} onSuccess={pp.reload} onClose={() => setPayTarget(null)} />
      )}
      {pp.detailMode && (
        <PayableDetailModal
          mode={pp.detailMode}
          data={pp.detail}
          loading={pp.detailLoading}
          onPay={() => { setPayTarget(pp.detail); pp.closeDetail(); }}
          onClose={pp.closeDetail}
        />
      )}
    </div>
  );
}

function UnpaidTab({ pp, onPay }) {
  return (
    <>
      <div className="filter-bar">
        <SearchInput value={pp.search} onChange={pp.setSearch} placeholder="Cari no. faktur atau nama pemasok..." className="w-full" />
      </div>
      {pp.loading ? (
        <PageLoader />
      ) : pp.unpaid.length === 0 ? (
        <EmptyState icon={FileText} title="Tidak ada faktur belum lunas" description="Semua hutang ke pemasok sudah lunas" />
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>No. Faktur</th><th>Pemasok</th><th>Tgl Faktur</th><th>Jatuh Tempo</th>
                <th>Tagihan</th><th>Dibayar</th><th>Sisa</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {pp.unpaid.map((p) => {
                const due = dueInfo(p.due_date);
                return (
                  <tr key={p.id}>
                    <td className="font-mono text-sm">{p.invoice_code}</td>
                    <td className="font-bold">{p.supplier_name}</td>
                    <td className="text-sm">{formatDate(p.invoice_date)}</td>
                    <td>
                      <div className="text-sm">{formatDate(p.due_date)}</div>
                      <Badge variant={due.variant}>{due.text}</Badge>
                    </td>
                    <td className="font-mono">{formatRupiah(p.amount)}</td>
                    <td className="font-mono text-positive">{formatRupiah(p.paid_amount)}</td>
                    <td className="font-mono font-bold">{formatRupiah(p.amount - p.paid_amount)}</td>
                    <td><Badge variant={STATUS_BADGE[p.status]}>{STATUS_LABEL[p.status]}</Badge></td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-primary btn-sm" onClick={() => onPay(p)}>
                          <BadgeDollarSign size={13} /> Bayar
                        </button>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => pp.openDetail(p)} title="Detail faktur">
                          <Eye size={14} />
                        </button>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => pp.openHistory(p)} title="Riwayat pembayaran">
                          <History size={14} />
                        </button>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => pp.printBukti(p)} title="Cetak bukti">
                          <Printer size={14} />
                        </button>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => pp.removePayable(p)} title="Hapus">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function PerSupplierTab({ pp }) {
  if (pp.loading) return <PageLoader />;
  if (pp.perSupplier.length === 0)
    return <EmptyState icon={Truck} title="Belum ada hutang" description="Belum ada pemasok dengan hutang berjalan" />;
  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th>Pemasok</th><th>Jumlah Faktur</th><th>Total Tagihan</th><th>Total Dibayar</th>
            <th>Sisa Utang</th><th>Jatuh Tempo Terdekat</th>
          </tr>
        </thead>
        <tbody>
          {pp.perSupplier.map((s) => (
            <tr key={s.supplier_id}>
              <td className="font-bold">{s.supplier_name}</td>
              <td>{s.total_faktur}</td>
              <td className="font-mono">{formatRupiah(s.total_tagihan)}</td>
              <td className="font-mono text-positive">{formatRupiah(s.total_dibayar)}</td>
              <td className="font-mono font-bold">{formatRupiah(s.total_sisa)}</td>
              <td className="text-sm">{formatDate(s.jatuh_tempo_terdekat)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const BUCKET_LABEL = {
  belum_jatuh_tempo: "Belum Jatuh Tempo",
  "1-30": "1–30 Hari",
  "31-60": "31–60 Hari",
  "61-90": "61–90 Hari",
  "90+": "Lebih dari 90 Hari",
};
const BUCKET_BADGE = { belum_jatuh_tempo: "blue", "1-30": "orange", "31-60": "orange", "61-90": "red", "90+": "red" };

function AgingTab({ pp }) {
  if (pp.loading) return <PageLoader />;
  if (pp.aging.length === 0)
    return <EmptyState icon={Clock} title="Tidak ada hutang berjalan" description="Belum ada hutang yang perlu dipantau umurnya" />;
  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th>No. Faktur</th><th>Pemasok</th><th>Jatuh Tempo</th><th>Sisa Tagihan</th><th>Umur Utang</th>
          </tr>
        </thead>
        <tbody>
          {pp.aging.map((a) => (
            <tr key={a.id}>
              <td className="font-mono text-sm">{a.invoice_code}</td>
              <td className="font-bold">{a.supplier_name}</td>
              <td className="text-sm">{formatDate(a.due_date)}</td>
              <td className="font-mono font-bold">{formatRupiah(a.sisa_tagihan)}</td>
              <td><Badge variant={BUCKET_BADGE[a.bucket]}>{BUCKET_LABEL[a.bucket]}</Badge></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HistoryTab({ pp }) {
  return (
    <>
      <div className="filter-bar">
        <input type="date" className="form-input" value={pp.historyStart} onChange={(e) => pp.setHistoryStart(e.target.value)} />
        <span className="text-muted text-sm">s/d</span>
        <input type="date" className="form-input" value={pp.historyEnd} onChange={(e) => pp.setHistoryEnd(e.target.value)} />
        <select className="form-select" value={pp.historySupplier} onChange={(e) => pp.setHistorySupplier(e.target.value)}>
          <option value="">Semua Pemasok</option>
          {pp.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      {pp.loading ? (
        <PageLoader />
      ) : pp.history.length === 0 ? (
        <EmptyState icon={History} title="Tidak ada histori" description="Belum ada pembayaran hutang pada rentang ini" />
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Tanggal Bayar</th><th>No. Faktur</th><th>Pemasok</th><th>Metode</th><th>Jumlah Dibayar</th><th>Catatan</th>
              </tr>
            </thead>
            <tbody>
              {pp.history.map((h) => (
                <tr key={h.id}>
                  <td className="text-sm">{formatDate(h.payment_date)}</td>
                  <td className="font-mono text-sm">{h.invoice_code}</td>
                  <td className="font-bold">{h.supplier_name}</td>
                  <td className="text-sm text-muted">{h.payment_method}</td>
                  <td className="font-mono text-positive">{formatRupiah(h.amount)}</td>
                  <td className="text-sm text-muted">{h.notes || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function PayableDetailModal({ mode, data, loading, onPay, onClose }) {
  const isHistory = mode === "history";
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">{isHistory ? "Riwayat Pembayaran Hutang" : "Detail Faktur Hutang"}</h2>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {loading && <PageLoader />}
          {!loading && data && !isHistory && (
            <>
              <div className="grid-2 mb-3">
                <div>
                  <div className="text-xs text-muted">No. Faktur</div>
                  <div className="font-mono font-bold">{data.invoice_code}</div>
                </div>
                <div>
                  <div className="text-xs text-muted">Pemasok</div>
                  <div className="font-bold">{data.supplier_name}</div>
                </div>
                <div>
                  <div className="text-xs text-muted">Tanggal Faktur</div>
                  <div>{formatDate(data.invoice_date)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted">Jatuh Tempo</div>
                  <div>{formatDate(data.due_date)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted">Status</div>
                  <Badge variant={STATUS_BADGE[data.status]}>{STATUS_LABEL[data.status]}</Badge>
                </div>
                <div>
                  <div className="text-xs text-muted">Sisa Hutang</div>
                  <div className="font-mono font-bold">{formatRupiah(data.amount - data.paid_amount)}</div>
                </div>
              </div>

              <div className="divider" style={{ margin: "12px 0" }} />

              <div className="font-bold text-sm mb-2">Daftar Barang (Pembelian)</div>
              {data.items && data.items.length > 0 ? (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr><th>Produk</th><th>Qty</th><th>Harga</th><th>Subtotal</th></tr>
                    </thead>
                    <tbody>
                      {data.items.map((it) => (
                        <tr key={it.id}>
                          <td>{it.product_name}{it.unit ? ` (${it.unit})` : ""}</td>
                          <td>{formatQty(it.quantity)}</td>
                          <td className="font-mono">{formatRupiah(it.unit_cost)}</td>
                          <td className="font-mono">{formatRupiah(it.subtotal_cost)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={3} className="text-right font-bold">Total.</td>
                        <td className="font-mono font-bold">{formatRupiah(data.amount)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted">
                  Faktur ini dicatat manual (bukan dari Pembelian kredit), jadi tidak ada rincian barang.
                </p>
              )}
            </>
          )}

          {!loading && data && isHistory && (
            <>
              <p className="text-sm text-muted mb-3">
                {data.invoice_code} — {data.supplier_name}<br />
                Total tagihan: <b>{formatRupiah(data.amount)}</b> • Sudah dibayar: <b className="text-positive">{formatRupiah(data.paid_amount)}</b>
              </p>
              {data.payments && data.payments.length > 0 ? (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr><th>Tanggal</th><th>Metode</th><th>Jumlah</th><th>Catatan</th></tr>
                    </thead>
                    <tbody>
                      {data.payments.map((p) => (
                        <tr key={p.id}>
                          <td className="text-sm">{formatDate(p.payment_date)}</td>
                          <td className="text-sm text-muted">{p.payment_method}</td>
                          <td className="font-mono text-positive">{formatRupiah(p.amount)}</td>
                          <td className="text-sm text-muted">{p.notes || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState icon={History} title="Belum ada pembayaran" description="Faktur ini belum pernah dibayar sebagian maupun lunas" />
              )}
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Tutup</button>
          {!loading && data && data.status !== "lunas" && (
            <button className="btn btn-primary" onClick={onPay}>
              <BadgeDollarSign size={14} /> Bayar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PayableFormModal({ suppliers, onSuccess, onClose }) {
  const f = usePayableForm({ suppliers, onSuccess, onClose });
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">Catat Utang Baru</h2>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={f.submit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Pemasok Terdaftar (opsional)</label>
              <select className="form-select" value={f.form.supplier_id} onChange={(e) => f.selectSupplier(e.target.value)}>
                <option value="">— Pilih dari daftar pemasok —</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Nama Pemasok *</label>
              <input className="form-input" value={f.form.supplier_name} onChange={(e) => f.setField("supplier_name", e.target.value)} placeholder="Nama pemasok" autoFocus />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Jumlah Utang *</label>
                <RupiahInput value={f.form.amount} onChange={(v) => f.setField("amount", v)} />
              </div>
              <div className="form-group">
                <label className="form-label">Sudah Dibayar (DP)</label>
                <RupiahInput value={f.form.paid_amount} onChange={(v) => f.setField("paid_amount", v)} />
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Tanggal Faktur</label>
                <input type="date" className="form-input" value={f.form.invoice_date} onChange={(e) => f.setField("invoice_date", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Jatuh Tempo *</label>
                <input type="date" className="form-input" value={f.form.due_date} onChange={(e) => f.setField("due_date", e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Catatan</label>
              <textarea className="form-input" rows={2} value={f.form.notes} onChange={(e) => f.setField("notes", e.target.value)} placeholder="Catatan tambahan (opsional)" />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Batal</button>
            <button type="submit" className="btn btn-primary" disabled={f.saving}>{f.saving ? "Menyimpan..." : "Simpan"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PayablePaymentModal({ payable, onSuccess, onClose }) {
  const f = usePayablePayment({ payable, onSuccess, onClose });
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal--small">
        <div className="modal-header">
          <h2 className="modal-title">Catat Pembayaran Utang</h2>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={f.submit}>
          <div className="modal-body">
            <p className="text-sm text-muted mb-3">
              {payable.invoice_code} — {payable.supplier_name}<br />
              Sisa utang: <b>{formatRupiah(f.sisa)}</b>
            </p>
            <div className="form-group">
              <label className="form-label">Jumlah Dibayar *</label>
              <RupiahInput
                value={f.form.amount}
                onChange={(v) => f.setField("amount", v === "" ? "" : Math.min(v, f.sisa))}
                autoFocus
              />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Tanggal Bayar</label>
                <input type="date" className="form-input" value={f.form.payment_date} onChange={(e) => f.setField("payment_date", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Metode</label>
                <select className="form-select" value={f.form.payment_method} onChange={(e) => f.setField("payment_method", e.target.value)}>
                  <option value="cash">Tunai</option>
                  <option value="debit">Debit</option>
                  <option value="qris">QRIS</option>
                  <option value="transfer">Transfer</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Catatan</label>
              <textarea className="form-input" rows={2} value={f.form.notes} onChange={(e) => f.setField("notes", e.target.value)} placeholder="Catatan tambahan (opsional)" />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Batal</button>
            <button type="submit" className="btn btn-primary" disabled={f.saving}>{f.saving ? "Menyimpan..." : "Simpan Pembayaran"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}