// src/features/stockMutation/StockMutationPage.jsx
// ─────────────────────────────────────────────────────────────────────────────
// VIEW LAYER — Mutasi Stok: seluruh pergerakan stok (penjualan, pembelian,
// stock opname, penyesuaian manual) yang sudah dicatat otomatis oleh
// masing-masing modul ke stock_history. Halaman ini murni menampilkan &
// memfilternya.
// ─────────────────────────────────────────────────────────────────────────────
import { ArrowLeftRight } from "lucide-react";
import { useStockMutation } from "./hooks";
import { PageLoader, EmptyState, Pagination, Badge, SearchFilterSelect } from "../../components/UI";
import { formatNumber, formatDateTime } from "../../utils/format";

const JENIS_BADGE_VARIANT = {
  penjualan: "blue",
  pembelian: "green",
  stock_opname: "orange",
  retur: "purple",
  penyesuaian_manual: "red",
  stok_awal: "blue",
  transfer_gudang: "purple",
};

export default function StockMutation() {
  const sm = useStockMutation();

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Mutasi Stok</div>
          <div className="page-subtitle">Riwayat seluruh pergerakan stok: penjualan, pembelian, stock opname &amp; penyesuaian manual</div>
        </div>
      </div>

      <div className="page-body">
        <div className="filter-bar">
          <input type="date" className="form-input" value={sm.startDate} onChange={(e) => sm.setStartDate(e.target.value)} />
          <span className="text-muted text-sm">s/d</span>
          <input type="date" className="form-input" value={sm.endDate} onChange={(e) => sm.setEndDate(e.target.value)} />
          <div style={{ width: 220 }}>
            <SearchFilterSelect
              options={sm.products}
              value={sm.productId}
              onChange={sm.setProductId}
              placeholder="Cari Produk..."
              emptyText="Produk tidak ditemukan"
            />
          </div>
          <select className="form-select" value={sm.jenis} onChange={(e) => sm.setJenis(e.target.value)}>
            <option value="">Semua Jenis Mutasi</option>
            {sm.jenisOptions.map((j) => <option key={j.id} value={j.id}>{j.label}</option>)}
          </select>
          <button className="btn btn-ghost btn-sm" onClick={sm.resetFilters}>Reset</button>
        </div>

        {sm.loading ? <PageLoader /> : (
          <>
            {sm.summary.length > 0 && (
              <div className="mutation-summary">
                {sm.summary.map((s) => (
                  <div key={s.jenis_mutasi} className="mutation-summary__card">
                    <div className="mutation-summary__label">{s.jenis_mutasi_label}</div>
                    <div className="mutation-summary__value">{s.total_mutasi} mutasi</div>
                    <div className="mutation-summary__sub">Masuk +{formatNumber(s.total_qty_masuk)} • Keluar -{formatNumber(s.total_qty_keluar)}</div>
                  </div>
                ))}
              </div>
            )}

            {sm.mutations.length === 0 ? (
              <EmptyState icon={ArrowLeftRight} title="Tidak ada mutasi stok" description="Coba ubah rentang tanggal atau filter" />
            ) : (
              <>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Tanggal</th><th>Produk</th><th>Jenis Mutasi</th>
                        <th>Qty Masuk</th><th>Qty Keluar</th><th>Saldo Sebelum</th><th>Saldo Sesudah</th>
                        <th>User</th><th>Referensi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sm.mutations.map((m) => (
                        <tr key={m.id}>
                          <td className="text-sm">{formatDateTime(m.created_at)}</td>
                          <td>{m.product_name}</td>
                          <td><Badge variant={JENIS_BADGE_VARIANT[m.jenis_mutasi] || "blue"}>{m.jenis_mutasi_label}</Badge></td>
                          <td className="font-mono text-positive">{m.qty_masuk > 0 ? `+${formatNumber(m.qty_masuk)}` : "-"}</td>
                          <td className="font-mono text-negative">{m.qty_keluar > 0 ? `-${formatNumber(m.qty_keluar)}` : "-"}</td>
                          <td className="font-mono">{formatNumber(m.saldo_sebelum)} {m.unit}</td>
                          <td className="font-mono font-bold">{formatNumber(m.saldo_sesudah)} {m.unit}</td>
                          <td className="text-sm">{m.user || "-"}</td>
                          <td className="font-mono text-xs">{m.reference || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination page={sm.page} totalPages={Math.max(1, Math.ceil(sm.total / 25))} total={sm.total} limit={25} onPageChange={sm.setPage} />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}