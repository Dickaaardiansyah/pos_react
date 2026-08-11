// src/features/capital/CapitalPage.jsx
// ─────────────────────────────────────────────────────────────────────────────
// VIEW LAYER — Modal Usaha (Owner's Capital): Modal Awal, setoran/penarikan
// modal tambahan, dan ringkasan ekuitas usaha. Sebelumnya jadi salah satu
// tab di dalam Jurnal Akuntansi — sekarang dipisah jadi menu sendiri di
// sidebar supaya tidak tercampur dengan buku besar/jurnal umum, meski di
// balik layar tetap terhubung otomatis lewat jurnal double-entry yang sama
// (lihat "Tentang Perhitungan Ini" di bawah).
// ─────────────────────────────────────────────────────────────────────────────
import { Wallet, TrendingUp, TrendingDown } from "lucide-react";
import { useCapital } from "./hooks";
import { PageLoader, EmptyState, Pagination, Badge, RupiahInput, SearchInput } from "../../components/UI";
import { formatRupiah, formatDate } from "../../utils/format";

const CAPITAL_TYPE_LABELS = { setoran: "Setoran", penarikan: "Penarikan (Prive)" };

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
        {!c.summaryLoading && s && !s.has_modal_awal && (
          <div className="card mb-4" style={{ borderLeft: "3px solid var(--color-warning, #f59e0b)" }}>
            <div className="chart-card__title">Modal Awal belum diinput</div>
            <div className="text-sm text-muted mb-3">
              Modal Awal adalah setoran modal pertama saat usaha ini mulai dijalankan. Setelah diinput, sistem akan
              memakainya sebagai patokan untuk menghitung apakah ekuitas usaha naik atau turun dari waktu ke waktu,
              terhubung otomatis dengan seluruh pembelian, penjualan, biaya, dan kas kecil.
            </div>
            <CapitalForm c={c} isInitial />
          </div>
        )}

        {c.summaryLoading ? <PageLoader /> : s && (
          <div className="mutation-summary mb-4">
            <div className="mutation-summary__card">
              <div className="mutation-summary__label">Modal Awal</div>
              <div className="mutation-summary__value">{s.has_modal_awal ? formatRupiah(s.modal_awal) : "Belum diinput"}</div>
              {s.tanggal_modal_awal && <div className="mutation-summary__sub">{formatDate(s.tanggal_modal_awal)}</div>}
            </div>
            <div className="mutation-summary__card">
              <div className="mutation-summary__label">Ekuitas Saat Ini</div>
              <div className="mutation-summary__value">{formatRupiah(s.ekuitas_saat_ini)}</div>
              <div className="mutation-summary__sub">Modal + Laba/Rugi kumulatif, per {formatDate(s.as_of_date)}</div>
            </div>
            <div className="mutation-summary__card">
              <div className="mutation-summary__label">Perubahan dari Modal Awal</div>
              <div className={`mutation-summary__value flex items-center gap-2 ${s.status === "naik" ? "text-positive" : s.status === "turun" ? "text-negative" : ""}`}>
                {s.status === "naik" && <TrendingUp size={16} />}
                {s.status === "turun" && <TrendingDown size={16} />}
                {formatRupiah(s.selisih_dari_modal_awal)}
              </div>
              <div className="mutation-summary__sub">
                {s.persentase_perubahan === null ? "Input Modal Awal untuk melihat persentase" : `${s.persentase_perubahan > 0 ? "+" : ""}${s.persentase_perubahan}% — ${s.status === "naik" ? "Naik" : s.status === "turun" ? "Turun" : "Tetap"}`}
              </div>
            </div>
            <div className="mutation-summary__card">
              <div className="mutation-summary__label">Laba/Rugi Kumulatif</div>
              <div className={`mutation-summary__value ${s.laba_rugi_kumulatif >= 0 ? "text-positive" : "text-negative"}`}>{formatRupiah(s.laba_rugi_kumulatif)}</div>
              <div className="mutation-summary__sub">Dari seluruh penjualan &amp; biaya sejak awal</div>
            </div>
            <div className="mutation-summary__card">
              <div className="mutation-summary__label">Setoran Tambahan / Penarikan</div>
              <div className="mutation-summary__value text-sm">
                <div>+ {formatRupiah(s.total_setoran_tambahan)}</div>
                <div>- {formatRupiah(s.total_penarikan)}</div>
              </div>
            </div>
          </div>
        )}

        {s && s.has_modal_awal && (
          <div className="grid-2 mb-4">
            <CapitalForm c={c} isInitial={false} />
            <div className="card">
              <div className="chart-card__title">Tentang Perhitungan Ini</div>
              <div className="text-sm text-muted">
                Ekuitas Saat Ini dihitung otomatis dari Neraca Saldo (saldo akun Modal Pemilik &amp; Prive, ditambah
                laba/rugi kumulatif dari seluruh transaksi penjualan, HPP, dan biaya operasional). Setiap pembelian
                stok, penjualan, atau biaya yang tercatat di sistem akan langsung mempengaruhi angka ini lewat jurnal
                otomatis — jadi kenaikan atau penurunan modal selalu mencerminkan kondisi terkini. Detail jurnalnya
                bisa dilihat di menu Jurnal Akuntansi. Catatan: pinjaman bank/utang lainnya TIDAK dihitung di sini —
                itu kewajiban, bukan modal, dan tercatat lewat menu Utang.
              </div>
            </div>
          </div>
        )}

        <div className="card">
          <div className="chart-card__title">Riwayat Transaksi Modal</div>

          <div className="flex gap-3 mb-3" style={{ flexWrap: "wrap" }}>
            <SearchInput
              value={c.txSearch}
              onChange={c.updateTxSearch}
              placeholder="Cari kode transaksi atau keterangan..."
              className="flex-1"
            />
            <select
              className="form-select"
              style={{ maxWidth: 220 }}
              value={c.txTypeFilter}
              onChange={(e) => c.updateTxTypeFilter(e.target.value)}
            >
              <option value="">Semua Jenis</option>
              <option value="setoran">Setoran</option>
              <option value="penarikan">Penarikan (Prive)</option>
            </select>
          </div>

          {c.txLoading ? <PageLoader /> : c.tx.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title={c.txSearch || c.txTypeFilter ? "Tidak ada transaksi yang cocok" : "Belum ada transaksi modal"}
              description={c.txSearch || c.txTypeFilter ? "Coba ubah kata kunci pencarian atau filter jenisnya" : "Setoran dan penarikan modal akan muncul di sini"}
            />
          ) : (
            <>
              <div className="table-container">
                <table>
                  <thead>
                    <tr><th>Kode</th><th>Tanggal</th><th>Jenis</th><th>Akun</th><th>Jumlah</th><th>Keterangan</th></tr>
                  </thead>
                  <tbody>
                    {c.tx.map((t) => (
                      <tr key={t.id}>
                        <td className="font-mono text-xs">{t.transaction_code}</td>
                        <td className="text-sm">{formatDate(t.transaction_date)}</td>
                        <td>
                          <Badge variant={t.type === "setoran" ? "green" : "red"}>
                            {t.is_initial ? "Modal Awal" : CAPITAL_TYPE_LABELS[t.type]}
                          </Badge>
                        </td>
                        <td className="text-sm">{t.target_account === "bank" ? "Bank" : "Kas"}</td>
                        <td className="font-mono">{formatRupiah(t.amount)}</td>
                        <td className="text-sm">{t.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={c.txPage} totalPages={Math.max(1, Math.ceil(c.txTotal / 20))} total={c.txTotal} limit={20} onPageChange={c.setTxPage} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CapitalForm({ c, isInitial }) {
  const f = c.form;

  async function handleSubmit() {
    await c.submit(isInitial);
  }

  return (
    <div className="card">
      <div className="chart-card__title">{isInitial ? "Input Modal Awal" : "Setoran / Penarikan Modal"}</div>

      {!isInitial && (
        <div className="form-group">
          <label className="form-label">Jenis</label>
          <select className="form-select" value={f.type} onChange={(e) => c.updateForm("type", e.target.value)}>
            <option value="setoran">Setoran Modal Tambahan</option>
            <option value="penarikan">Penarikan Modal (Prive)</option>
          </select>
        </div>
      )}

      <div className="form-group">
        <label className="form-label">Tanggal</label>
        <input type="date" className="form-input" value={f.transaction_date} onChange={(e) => c.updateForm("transaction_date", e.target.value)} />
      </div>

      <div className="form-group">
        <label className="form-label">Akun {f.type === "penarikan" && !isInitial ? "Sumber" : "Tujuan"}</label>
        <select className="form-select" value={f.target_account} onChange={(e) => c.updateForm("target_account", e.target.value)}>
          <option value="kas">Kas</option>
          <option value="bank">Bank / Non-Tunai</option>
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">Jumlah (Rp)</label>
        <RupiahInput placeholder="Mis. 10.000.000" value={f.amount} onChange={(v) => c.updateForm("amount", v)} />
      </div>

      <div className="form-group">
        <label className="form-label">Keterangan (opsional)</label>
        <input className="form-input" placeholder={isInitial ? "Mis. Modal awal pendirian usaha" : "Mis. Tambahan modal dari pemilik"} value={f.description} onChange={(e) => c.updateForm("description", e.target.value)} />
      </div>

      <button className="btn btn-primary w-full mt-2" onClick={handleSubmit} disabled={c.submitting}>
        {c.submitting ? "Menyimpan..." : isInitial ? "Simpan sebagai Modal Awal" : "Simpan Transaksi Modal"}
      </button>
    </div>
  );
}