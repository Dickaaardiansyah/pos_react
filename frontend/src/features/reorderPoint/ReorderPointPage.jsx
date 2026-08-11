// src/features/reorderPoint/ReorderPointPage.jsx
// ─────────────────────────────────────────────────────────────────────────────
// VIEW LAYER — Rekomendasi Restock berbasis Reorder Point (ROP).
// Rumus (lihat Bab 2.1.10 skripsi — Reorder Point, Lead Time, Safety Stock),
// dua satuan waktu didukung, diatur per produk di halaman Produk:
//
//  Versi HARI:  d = rata-rata penjualan harian
//               SS = Hari Cadangan x d
//               ROP = (d x Lead Time) + SS
//
//  Versi JAM:   d_jam = rata-rata penjualan harian / jam operasional toko
//               SS = Jam Cadangan x d_jam
//               ROP = (d_jam x Lead Time) + SS
//
// Produk yang stoknya <= ROP ditandai "Perlu Restock". Hanya produk dengan
// Lead Time terisi (diatur di halaman Produk) yang muncul di sini — lihat
// form-hint pada field tersebut.
// ─────────────────────────────────────────────────────────────────────────────
import { PackageSearch, CopyCheck } from "lucide-react";
import { useReorderPoint } from "./hooks";
import { PageLoader, EmptyState, Badge } from "../../components/UI";
import { formatQty } from "../../utils/format";
import PeriodDropdown from "./PeriodDropdown";

export default function ReorderPoint() {
  const rp = useReorderPoint();

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Rekomendasi Restock</div>
          <div className="page-subtitle">
            Titik pemesanan ulang (Reorder Point) dihitung dari rata-rata penjualan, lead time, dan cadangan tiap produk — bisa dalam satuan hari atau jam
          </div>
        </div>
      </div>

      <div className="page-body">
        <div className="rop-period-bar">
          <div className="rop-period-bar__text">
            <span>
              Dihitung dari rata-rata <strong>{rp.meta.window_days} hari</strong> terakhir
            </span>
            {rp.isAuto && (
              <span className="rop-period-bar__note">
                (dipilih sistem{rp.meta.available_days > 0 && rp.meta.available_days < rp.meta.window_days
                  ? ` — data penjualan baru ada ${rp.meta.available_days} hari`
                  : ""})
              </span>
            )}
          </div>
          <PeriodDropdown days={rp.days} onChange={rp.setDays} />
        </div>

        <div className="filter-bar">
          <input
            type="text"
            className="form-input"
            placeholder="Cari produk..."
            value={rp.search}
            onChange={(e) => rp.setSearch(e.target.value)}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={rp.onlyNeedsReorder}
              onChange={(e) => rp.setOnlyNeedsReorder(e.target.checked)}
            />
            Hanya yang perlu restock
          </label>
        </div>

        {rp.loading ? (
          <PageLoader />
        ) : rp.total === 0 ? (
          <EmptyState
            icon={PackageSearch}
            title="Belum ada produk yang diatur untuk Reorder Point"
            description={'Isi "Lead Time" dan "Cadangan" (hari atau jam) pada halaman Produk (tab Stok) untuk memunculkan produk di sini'}
          />
        ) : rp.items.length === 0 ? (
          <EmptyState icon={PackageSearch} title="Tidak ada produk yang cocok" description="Coba ubah pencarian atau filter" />
        ) : (
          <>
            <div className="mutation-summary">
              <div className="mutation-summary__card">
                <div className="mutation-summary__label">Total Produk Dipantau</div>
                <div className="mutation-summary__value">{rp.total} produk</div>
              </div>
              <div className="mutation-summary__card">
                <div className="mutation-summary__label">Perlu Restock</div>
                <div className="mutation-summary__value">{rp.needsReorderCount} produk</div>
              </div>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Produk</th>
                    <th>Stok Sekarang</th>
                    <th>Rata-rata Jual</th>
                    <th>Lead Time</th>
                    <th>Safety Stock</th>
                    <th>Reorder Point</th>
                    <th>Stok Minimum</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rp.items.map((p) => (
                    <tr key={p.id} className={p.needs_reorder ? "low-stock-row" : ""}>
                      <td>
                        <div className="font-semibold">{p.name}</div>
                        <div className="text-xs text-muted">{p.category_name || "Tanpa Kategori"}</div>
                      </td>
                      <td className="font-mono">{formatQty(p.stock)} {p.unit}</td>
                      <td className="font-mono">{formatQty(p.avg_sales_per_unit)} {p.unit}/{p.rop_time_unit}</td>
                      <td className="font-mono">{formatQty(p.lead_time_value)} {p.rop_time_unit}</td>
                      <td className="font-mono">{formatQty(p.safety_stock)} {p.unit}</td>
                      <td className="font-mono font-bold">{formatQty(p.reorder_point)} {p.unit}</td>
                      <td className="font-mono text-muted">
                        {formatQty(p.min_stock)} {p.unit}
                        <div className="text-xs text-muted">peringatan manual</div>
                      </td>
                      <td>
                        {p.needs_reorder ? (
                          <Badge variant="orange">Perlu Restock</Badge>
                        ) : (
                          <Badge variant="green">Aman</Badge>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          title='Salin nilai Reorder Point ke Stok Minimum produk ini'
                          disabled={rp.copyingId === p.id}
                          onClick={() => rp.copyRopToMinStock(p)}
                        >
                          <CopyCheck size={14} /> Salin ke Stok Min
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}