// src/features/reports/produk/ExpiredStockReport.jsx
// ─────────────────────────────────────────────────────────────────────────────
// VIEW LAYER — Laporan Barang Expired (modul Produk & Stok). Menampilkan batch
// pembelian per status kadaluarsa (expired / mendekati / aman).
// ─────────────────────────────────────────────────────────────────────────────
import { AlertTriangle, Clock, CheckCircle2, PackageX } from "lucide-react";
import { StatCard, EmptyState, Badge } from "../../../components/UI";
import { formatDate, formatQty } from "../../../utils/format";

const EXPIRED_BADGE = {
  expired: { variant: "red", label: "Expired" },
  warning: { variant: "orange", label: "Mendekati" },
  safe: { variant: "green", label: "Aman" },
};

export function ExpiredStockContent({ r }) {
  const rep = r.expiredReport;
  if (!rep) return null;
  const items = rep.items || rep.data || [];
  return (
    <>
      <div className="stats-grid">
        <StatCard icon={AlertTriangle} tone="red" label="Expired" value={rep.summary?.expired_count || 0} />
        <StatCard icon={Clock} tone="orange" label="Mendekati" value={rep.summary?.warning_count || 0} />
        <StatCard icon={CheckCircle2} tone="green" label="Aman" value={rep.summary?.safe_count || 0} />
      </div>
      <div className="card">
        <div className="chart-card__title">Daftar Batch</div>
        {items.length === 0 ? (
          <EmptyState icon={PackageX} title="Tidak ada data" description="Coba ubah filter status atau tanggal" />
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Produk</th><th>Kode Pembelian</th><th>Tgl Pembelian</th><th>Qty Batch</th>
                  <th>Stok Saat Ini</th><th>Kadaluarsa</th><th>Sisa Hari</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const badge = EXPIRED_BADGE[it.status] || EXPIRED_BADGE.safe;
                  return (
                    <tr key={it.id}>
                      <td>{it.product_name}</td>
                      <td className="font-mono text-sm">{it.purchase_code}</td>
                      <td className="text-sm">{formatDate(it.purchase_date)}</td>
                      <td>{formatQty(it.quantity)} {it.unit}</td>
                      <td>{it.current_stock != null ? `${formatQty(it.current_stock)} ${it.unit}` : "-"}</td>
                      <td className="text-sm">{formatDate(it.expiry_date)}</td>
                      <td className={it.days_left < 0 ? "text-danger" : it.days_left <= (rep.thresholdDays || 30) ? "text-warning" : ""}>
                        {it.days_left < 0 ? `${Math.abs(it.days_left)} hari lalu` : `${it.days_left} hari`}
                      </td>
                      <td><Badge variant={badge.variant}>{badge.label}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

// Catatan: laporan ini belum punya payload cetak/ekspor Excel (sama seperti
// sebelum diekstrak dari ReportsPage.jsx) — tombol Cetak/Export otomatis
// nonaktif untuk jenis laporan ini karena buildExportPayload() tidak
// menemukan builder untuk "barangExpired".
