// src/features/reports/produk/StockOutReport.jsx
// ─────────────────────────────────────────────────────────────────────────────
// VIEW LAYER — Laporan Barang Keluar (modul Produk).
// Semua pergerakan stok keluar: penjualan, rusak/kadaluarsa (via opname),
// penyesuaian manual, retur, dll. Sumber: stock-mutations (type=out + summary).
// ─────────────────────────────────────────────────────────────────────────────
import { PackageX, TrendingDown, Layers } from "lucide-react";
import { StatCard, EmptyState, Badge } from "../../../components/UI";
import { formatRupiah, formatDate, formatDateTime, formatQty } from "../../../utils/format";

const JENIS_VARIANT = {
  penjualan: "green",
  stock_opname: "orange",
  penyesuaian_manual: "purple",
  retur: "blue",
  pembelian: "cyan",
};

export function StockOutContent({ r }) {
  const list = r.stockOutReport?.data || [];
  const byType = r.stockOutReport?.byType || [];
  const summary = r.stockOutReport?.summary || {};

  return (
    <>
      <div className="stats-grid">
        <StatCard icon={PackageX} tone="orange" label="Total Baris Keluar" value={summary.total_rows || list.length || 0} />
        <StatCard icon={TrendingDown} tone="red" label="Total Qty Keluar" value={formatQty(summary.total_qty_out || 0)} />
        <StatCard icon={Layers} tone="blue" label="Jenis Mutasi" value={byType.length || 0} />
      </div>

      {byType.length > 0 && (
        <div className="card mb-4">
          <div className="chart-card__title">Ringkasan per Jenis</div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Jenis Mutasi</th>
                  <th>Qty Keluar</th>
                  <th>Qty Masuk</th>
                </tr>
              </thead>
              <tbody>
                {byType.map((t, i) => (
                  <tr key={i}>
                    <td>
                      <Badge variant={JENIS_VARIANT[t.jenis] || "blue"}>
                        {t.label || t.jenis}
                      </Badge>
                    </td>
                    <td className="font-mono text-danger">{formatQty(t.total_qty_keluar || 0)}</td>
                    <td className="font-mono text-success">{formatQty(t.total_qty_masuk || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card">
        <div className="chart-card__title">Detail Barang Keluar</div>
        {list.length === 0 ? (
          <EmptyState
            icon={PackageX}
            title="Belum ada barang keluar"
            description="Coba pilih rentang tanggal lain atau filter jenis"
          />
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Produk</th>
                  <th>Jenis</th>
                  <th>Qty Keluar</th>
                  <th>Stok Sebelum</th>
                  <th>Stok Sesudah</th>
                  <th>Referensi</th>
                  <th>Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {list.map((m, i) => (
                  <tr key={m.id || i}>
                    <td className="text-sm">{formatDateTime(m.created_at || m.waktu)}</td>
                    <td>{m.product_name || m.name || "-"}</td>
                    <td>
                      <Badge variant={JENIS_VARIANT[m.jenis_mutasi || m.jenis] || "blue"}>
                        {m.jenis_label || m.jenis_mutasi || m.jenis || m.type}
                      </Badge>
                    </td>
                    <td className="font-mono text-danger">{formatQty(m.qty_keluar || m.quantity || 0)}</td>
                    <td className="font-mono text-muted">{formatQty(m.previous_stock ?? "-")}</td>
                    <td className="font-mono">{formatQty(m.new_stock ?? "-")}</td>
                    <td className="font-mono text-sm">{m.reference || "-"}</td>
                    <td className="text-sm text-muted">{m.notes || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

export function buildStockOutExportPayload(r) {
  const list = r.stockOutReport?.data || [];
  const summary = r.stockOutReport?.summary || {};
  const rows = list.map((m) => ({
    waktu: formatDateTime(m.created_at || m.waktu),
    produk: m.product_name || m.name || "-",
    jenis: m.jenis_label || m.jenis_mutasi || m.jenis || m.type,
    qty_keluar: formatQty(m.qty_keluar || m.quantity || 0),
    stok_sebelum: m.previous_stock != null ? formatQty(m.previous_stock) : "-",
    stok_sesudah: m.new_stock != null ? formatQty(m.new_stock) : "-",
    referensi: m.reference || "-",
    keterangan: m.notes || "-",
  }));
  return {
    title: "Laporan Barang Keluar",
    periodLabel: `${formatDate(r.startDate)} – ${formatDate(r.endDate)}`,
    columns: [
      { key: "waktu", label: "Waktu" },
      { key: "produk", label: "Produk" },
      { key: "jenis", label: "Jenis" },
      { key: "qty_keluar", label: "Qty Keluar" },
      { key: "stok_sebelum", label: "Stok Sebelum" },
      { key: "stok_sesudah", label: "Stok Sesudah" },
      { key: "referensi", label: "Referensi" },
      { key: "keterangan", label: "Keterangan" },
    ],
    rows,
    summary: [
      { label: "Total Baris Keluar", value: summary.total_rows || list.length || 0 },
      { label: "Total Qty Keluar", value: formatQty(summary.total_qty_out || 0) },
    ],
  };
}