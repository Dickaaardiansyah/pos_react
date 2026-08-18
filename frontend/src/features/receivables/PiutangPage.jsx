// src/features/receivables/PiutangPage.jsx
// ─────────────────────────────────────────────────────────────────────────────
// VIEW LAYER — Piutang dan Penjualan: pencatatan piutang pelanggan, informasi
// jatuh tempo, serta 4 laporan untuk monitoring (Faktur Belum Lunas, Faktur
// Belum Lunas per Pelanggan, Umur Piutang, Histori Piutang).
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from "react";
import { Plus, Wallet2, FileText, Users, Clock, History, Trash2, BadgeDollarSign, Eye } from "lucide-react";
import {
  useReceivables,
  useReceivableForm,
  useReceivablePayment,
} from "./hooks";
import { PageLoader, EmptyState, SearchInput, Badge, StatCard, RupiahInput } from "../../components/UI";
import { formatRupiah, formatDate, formatQty } from "../../utils/format";
import { receivablesApi as receivableModel } from "./api";

const TABS = [
  { id: "unpaid", label: "Faktur Belum Lunas", icon: FileText },
  { id: "per_customer", label: "Faktur Belum Lunas per Pelanggan", icon: Users },
  { id: "aging", label: "Umur Piutang", icon: Clock },
  { id: "history", label: "Histori Piutang", icon: History },
];

const STATUS_BADGE = { belum_lunas: "red", sebagian: "orange", lunas: "green", dibatalkan: "gray" };
const STATUS_LABEL = { belum_lunas: "Belum Lunas", sebagian: "Sebagian", lunas: "Lunas", dibatalkan: "Dibatalkan" };

function dueInfo(dueDate) {
  const days = Math.ceil((new Date(dueDate) - new Date(new Date().toDateString())) / 86400000);
  if (days < 0) return { variant: "red", text: `Terlambat ${Math.abs(days)} hari` };
  if (days === 0) return { variant: "orange", text: "Jatuh tempo hari ini" };
  if (days <= 7) return { variant: "orange", text: `${days} hari lagi` };
  return { variant: "blue", text: `${days} hari lagi` };
}

export default function Piutang() {
  const rp = useReceivables();
  const [showForm, setShowForm] = useState(false);
  const [payTarget, setPayTarget] = useState(null);
  const [detailTarget, setDetailTarget] = useState(null);

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Piutang dan Penjualan</div>
          <div className="page-subtitle">Pencatatan piutang pelanggan, jatuh tempo, dan laporan untuk monitoring</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          <Plus size={16} /> Catat Piutang
        </button>
      </div>

      <div className="page-body">
        {rp.summary && (
          <div className="stats-grid mb-4">
            <StatCard icon={Wallet2} tone="blue" label="Total Piutang Belum Lunas" value={formatRupiah(rp.summary.total_piutang)} />
            <StatCard icon={FileText} tone="purple" label="Jumlah Faktur Belum Lunas" value={rp.summary.total_faktur_belum_lunas} />
            <StatCard icon={Clock} tone="red" label="Piutang Jatuh Tempo" value={formatRupiah(rp.summary.total_jatuh_tempo)} change={`${rp.summary.jumlah_jatuh_tempo} faktur`} changeTone="negative" />
          </div>
        )}

        <div className="tab-nav">
          {TABS.map((t) => (
            <button key={t.id} className={`tab-btn ${rp.tab === t.id ? "active" : ""}`} onClick={() => rp.setTab(t.id)}>
              <t.icon size={15} /> {t.label}
            </button>
          ))}
        </div>

        {rp.tab === "unpaid" && (
          <UnpaidTab rp={rp} onPay={setPayTarget} onDetail={setDetailTarget} />
        )}
        {rp.tab === "per_customer" && <PerCustomerTab rp={rp} onPay={setPayTarget} onDetail={setDetailTarget} />}
        {rp.tab === "aging" && <AgingTab rp={rp} onDetail={setDetailTarget} />}
        {rp.tab === "history" && <HistoryTab rp={rp} />}
      </div>

      {showForm && (
        <ReceivableFormModal customers={rp.customers} onSuccess={rp.reload} onClose={() => setShowForm(false)} />
      )}
      {payTarget && (
        <ReceivablePaymentModal
          receivable={payTarget}
          onSuccess={() => {
            rp.reload();
            rp.reloadCustomerInvoices();
          }}
          onClose={() => setPayTarget(null)}
        />
      )}
      {detailTarget && (
        <ReceivableDetailModal
          receivableId={detailTarget.id}
          onPay={() => { setPayTarget(detailTarget); setDetailTarget(null); }}
          onClose={() => setDetailTarget(null)}
        />
      )}
    </div>
  );
}

function UnpaidTab({ rp, onPay, onDetail }) {
  return (
    <>
      <div className="filter-bar">
        <SearchInput value={rp.search} onChange={rp.setSearch} placeholder="Cari no. faktur atau nama pelanggan..." className="w-full" />
      </div>
      {rp.loading ? (
        <PageLoader />
      ) : rp.unpaid.length === 0 ? (
        <EmptyState icon={FileText} title="Tidak ada faktur belum lunas" description="Semua piutang pelanggan sudah lunas" />
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>No. Faktur</th><th>Pelanggan</th><th>Tgl Faktur</th><th>Jatuh Tempo</th>
                <th>Tagihan</th><th>Dibayar</th><th>Sisa</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rp.unpaid.map((r) => {
                const due = dueInfo(r.due_date);
                return (
                  <tr key={r.id}>
                    <td className="font-mono text-sm">{r.invoice_code}</td>
                    <td className="font-bold">{r.customer_name}</td>
                    <td className="text-sm">{formatDate(r.invoice_date)}</td>
                    <td>
                      <div className="text-sm">{formatDate(r.due_date)}</div>
                      <Badge variant={due.variant}>{due.text}</Badge>
                    </td>
                    <td className="font-mono">{formatRupiah(r.amount)}</td>
                    <td className="font-mono text-positive">{formatRupiah(r.paid_amount)}</td>
                    <td className="font-mono font-bold">{formatRupiah(r.amount - r.paid_amount)}</td>
                    <td><Badge variant={STATUS_BADGE[r.status]}>{STATUS_LABEL[r.status]}</Badge></td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => onDetail(r)} title="Lihat detail barang">
                          <Eye size={14} />
                        </button>
                        <button className="btn btn-primary btn-sm" onClick={() => onPay(r)}>
                          <BadgeDollarSign size={13} /> Bayar
                        </button>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => rp.removeReceivable(r)}>
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

function PerCustomerTab({ rp, onPay, onDetail }) {
  if (rp.selectedCustomer) {
    return (
      <CustomerInvoicesView
        rp={rp}
        customer={rp.selectedCustomer}
        invoices={rp.customerInvoices}
        loading={rp.loadingCustomerInvoices}
        onBack={rp.closeCustomerInvoices}
        onPay={onPay}
        onDetail={onDetail}
      />
    );
  }

  if (rp.loading) return <PageLoader />;
  if (rp.perCustomer.length === 0)
    return <EmptyState icon={Users} title="Belum ada piutang" description="Belum ada pelanggan dengan piutang berjalan" />;
  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th>Pelanggan</th><th>Jumlah Faktur</th><th>Total Tagihan</th><th>Total Dibayar</th>
            <th>Sisa Piutang</th><th>Jatuh Tempo Terdekat</th><th></th>
          </tr>
        </thead>
        <tbody>
          {rp.perCustomer.map((c) => (
            <tr key={c.customer_id}>
              <td className="font-bold">{c.customer_name}</td>
              <td>{c.total_faktur}</td>
              <td className="font-mono">{formatRupiah(c.total_tagihan)}</td>
              <td className="font-mono text-positive">{formatRupiah(c.total_dibayar)}</td>
              <td className="font-mono font-bold">{formatRupiah(c.total_sisa)}</td>
              <td className="text-sm">{formatDate(c.jatuh_tempo_terdekat)}</td>
              <td>
                <button className="btn btn-primary btn-sm" onClick={() => rp.openCustomerInvoices(c)}>
                  <FileText size={13} /> Lihat Tagihan
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Menu Open Bill: setelah pilih pelanggan → tampilkan daftar tagihan (Open
// Bill) pelanggan tersebut, dengan aksi bayar sebagian/lunas per faktur.
function CustomerInvoicesView({ customer, invoices, loading, onBack, onPay, onDetail }) {
  return (
    <>
      <div className="filter-bar" style={{ alignItems: "center" }}>
        <button className="btn btn-ghost btn-sm" onClick={onBack}>← Kembali ke daftar pelanggan</button>
        <span className="font-bold">{customer.customer_name}</span>
      </div>
      {loading ? (
        <PageLoader />
      ) : invoices.length === 0 ? (
        <EmptyState icon={FileText} title="Tidak ada tagihan" description="Pelanggan ini tidak punya faktur Open Bill yang belum lunas" />
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>No. Faktur</th><th>Tgl Faktur</th><th>Jatuh Tempo</th>
                <th>Tagihan</th><th>Dibayar</th><th>Sisa</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((r) => {
                const due = dueInfo(r.due_date);
                return (
                  <tr key={r.id}>
                    <td className="font-mono text-sm">{r.invoice_code}</td>
                    <td className="text-sm">{formatDate(r.invoice_date)}</td>
                    <td>
                      <div className="text-sm">{formatDate(r.due_date)}</div>
                      <Badge variant={due.variant}>{due.text}</Badge>
                    </td>
                    <td className="font-mono">{formatRupiah(r.amount)}</td>
                    <td className="font-mono text-positive">{formatRupiah(r.paid_amount)}</td>
                    <td className="font-mono font-bold">{formatRupiah(r.amount - r.paid_amount)}</td>
                    <td><Badge variant={STATUS_BADGE[r.status]}>{STATUS_LABEL[r.status]}</Badge></td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => onDetail(r)} title="Lihat detail barang">
                          <Eye size={14} />
                        </button>
                        <button className="btn btn-primary btn-sm" onClick={() => onPay(r)}>
                          <BadgeDollarSign size={13} /> Bayar
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

const BUCKET_LABEL = {
  belum_jatuh_tempo: "Belum Jatuh Tempo",
  "1-30": "1–30 Hari",
  "31-60": "31–60 Hari",
  "61-90": "61–90 Hari",
  "90+": "Lebih dari 90 Hari",
};
const BUCKET_BADGE = { belum_jatuh_tempo: "blue", "1-30": "orange", "31-60": "orange", "61-90": "red", "90+": "red" };

function AgingTab({ rp, onDetail }) {
  if (rp.loading) return <PageLoader />;
  if (rp.aging.length === 0)
    return <EmptyState icon={Clock} title="Tidak ada piutang berjalan" description="Belum ada piutang yang perlu dipantau umurnya" />;
  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th>No. Faktur</th><th>Pelanggan</th><th>Jatuh Tempo</th><th>Sisa Tagihan</th><th>Umur Piutang</th><th></th>
          </tr>
        </thead>
        <tbody>
          {rp.aging.map((a) => (
            <tr key={a.id}>
              <td className="font-mono text-sm">{a.invoice_code}</td>
              <td className="font-bold">{a.customer_name}</td>
              <td className="text-sm">{formatDate(a.due_date)}</td>
              <td className="font-mono font-bold">{formatRupiah(a.sisa_tagihan)}</td>
              <td><Badge variant={BUCKET_BADGE[a.bucket]}>{BUCKET_LABEL[a.bucket]}</Badge></td>
              <td>
                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => onDetail(a)} title="Lihat detail barang">
                  <Eye size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HistoryTab({ rp }) {
  return (
    <>
      <div className="filter-bar">
        <input type="date" className="form-input" value={rp.historyStart} onChange={(e) => rp.setHistoryStart(e.target.value)} />
        <span className="text-muted text-sm">s/d</span>
        <input type="date" className="form-input" value={rp.historyEnd} onChange={(e) => rp.setHistoryEnd(e.target.value)} />
        <select className="form-select" value={rp.historyCustomer} onChange={(e) => rp.setHistoryCustomer(e.target.value)}>
          <option value="">Semua Pelanggan</option>
          {rp.customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      {rp.loading ? (
        <PageLoader />
      ) : rp.history.length === 0 ? (
        <EmptyState icon={History} title="Tidak ada histori" description="Belum ada pembayaran piutang pada rentang ini" />
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Tanggal Bayar</th><th>No. Faktur</th><th>Pelanggan</th><th>Metode</th><th>Jumlah Dibayar</th><th>Catatan</th>
              </tr>
            </thead>
            <tbody>
              {rp.history.map((h) => (
                <tr key={h.id}>
                  <td className="text-sm">{formatDate(h.payment_date)}</td>
                  <td className="font-mono text-sm">{h.invoice_code}</td>
                  <td className="font-bold">{h.customer_name}</td>
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

function ReceivableFormModal({ customers, onSuccess, onClose }) {
  const f = useReceivableForm({ customers, onSuccess, onClose });
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">Catat Piutang Baru</h2>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={f.submit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Pelanggan Terdaftar (opsional)</label>
              <select className="form-select" value={f.form.customer_id} onChange={(e) => f.selectCustomer(e.target.value)}>
                <option value="">— Pilih dari daftar pelanggan —</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Nama Pelanggan *</label>
              <input className="form-input" value={f.form.customer_name} onChange={(e) => f.setField("customer_name", e.target.value)} placeholder="Nama pelanggan" autoFocus />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Jumlah Piutang *</label>
                <RupiahInput value={f.form.amount} onChange={(v) => f.setField("amount", v)} />
              </div>
              <div className="form-group">
                <label className="form-label">Sudah Dibayar (DP)</label>
                <RupiahInput value={f.form.paid_amount} onChange={(v) => f.setField("paid_amount", v)} />
              </div>
            </div>
            {Number(f.form.paid_amount) > 0 && (
              <div className="form-group">
                <label className="form-label">Metode Pembayaran DP</label>
                <select className="form-select" value={f.form.payment_method} onChange={(e) => f.setField("payment_method", e.target.value)}>
                  <option value="cash">Tunai</option>
                  <option value="debit">Debit</option>
                  <option value="qris">QRIS</option>
                  <option value="transfer">Transfer</option>
                </select>
              </div>
            )}
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

function ReceivableDetailModal({ receivableId, onPay, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    receivableModel
      .getById(receivableId)
      .then((r) => active && setData(r.data))
      .catch((e) => active && setError(e.message || "Gagal memuat detail piutang"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [receivableId]);

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">Detail Faktur Open Bill</h2>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {loading && <PageLoader />}
          {!loading && error && <p className="text-sm text-negative">{error}</p>}
          {!loading && data && (
            <>
              <div className="grid-2 mb-3">
                <div>
                  <div className="text-xs text-muted">No. Faktur</div>
                  <div className="font-mono font-bold">{data.invoice_code}</div>
                </div>
                <div>
                  <div className="text-xs text-muted">Pelanggan</div>
                  <div className="font-bold">{data.customer_name}</div>
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
                  <div className="text-xs text-muted">Sisa Piutang</div>
                  <div className="font-mono font-bold">{formatRupiah(data.amount - data.paid_amount)}</div>
                </div>
              </div>

              <div className="divider" style={{ margin: "12px 0" }} />

              <div className="font-bold text-sm mb-2">Daftar Barang</div>
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
                          <td className="font-mono">{formatRupiah(it.unit_price)}</td>
                          <td className="font-mono">{formatRupiah(it.subtotal)}</td>
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
                  Faktur ini dicatat manual (bukan dari transaksi Kasir), jadi tidak ada rincian barang.
                </p>
              )}

              {data.payments && data.payments.length > 0 && (
                <>
                  <div className="font-bold text-sm mt-4 mb-2">Riwayat Pembayaran</div>
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr><th>Tanggal</th><th>Metode</th><th>Jumlah</th></tr>
                      </thead>
                      <tbody>
                        {data.payments.map((p) => (
                          <tr key={p.id}>
                            <td className="text-sm">{formatDate(p.payment_date)}</td>
                            <td className="text-sm text-muted">{p.payment_method}</td>
                            <td className="font-mono text-positive">{formatRupiah(p.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
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

function ReceivablePaymentModal({ receivable, onSuccess, onClose }) {
  const f = useReceivablePayment({ receivable, onSuccess, onClose });
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal--small">
        <div className="modal-header">
          <h2 className="modal-title">Catat Pembayaran Piutang</h2>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={f.submit}>
          <div className="modal-body">
            <p className="text-sm text-muted mb-3">
              {receivable.invoice_code} — {receivable.customer_name}<br />
              Sisa piutang: <b>{formatRupiah(f.sisa)}</b>
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