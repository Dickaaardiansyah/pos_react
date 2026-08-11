// src/features/reports/penjualan/SalesDailyReport.jsx
// ─────────────────────────────────────────────────────────────────────────────
// VIEW LAYER — Laporan Penjualan Harian (modul Penjualan). Menampilkan seluruh
// transaksi pada satu tanggal tertentu lengkap dengan ringkasan di bagian atas.
// Dipisah ke file sendiri (bukan digabung ke ReportsPage.jsx) supaya laporan
// baru ke depannya konsisten dikelompokkan per modul/fungsi.
// ─────────────────────────────────────────────────────────────────────────────
import { Receipt, ShoppingCart, Percent, Wallet, TrendingUp } from "lucide-react";
import { StatCard, EmptyState, Badge } from "../../../components/UI";
import { formatRupiah, formatDate, formatQty } from "../../../utils/format";

// Waktu saja (HH:MM) — tanggalnya sudah tetap sesuai filter, jadi kolom jam
// cukup diambil langsung dari string "YYYY-MM-DD HH:MM:SS" tanpa parsing timezone.
function timeOnly(dateStr) {
  if (!dateStr) return "-";
  const m = String(dateStr).match(/(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : "-";
}

function statusBadgeVariant(status) {
  if (status === "cancelled") return "red";
  if (status === "pending") return "orange";
  return "green";
}

function paymentStatusBadgeVariant(label) {
  if (label === "Lunas") return "green";
  if (label === "Sebagian") return "orange";
  if (label === "Belum Lunas") return "red";
  return "blue";
}

export function SalesDailyContent({ r }) {
  const rep = r.dailyReport;
  if (!rep) return null;
  const s = rep.summary || {};
  const items = rep.transactions || [];

  return (
    <>
      <div className="stats-grid">
        <StatCard icon={ShoppingCart} tone="blue" label="Total Transaksi" value={s.total_transactions || 0} />
        <StatCard icon={Receipt} tone="cyan" label="Total Item Terjual" value={formatQty(s.total_items_qty || 0)} />
        <StatCard icon={TrendingUp} tone="green" label="Penjualan Kotor" value={formatRupiah(s.gross_sales || 0)} />
        <StatCard icon={Percent} tone="orange" label="Total Diskon" value={formatRupiah(s.total_discount || 0)} />
        <StatCard icon={Percent} tone="purple" label="Total Pajak" value={formatRupiah(s.total_tax || 0)} />
        <StatCard icon={Wallet} tone="green" label="Penjualan Bersih" value={formatRupiah(s.net_sales || 0)} />
        <StatCard icon={TrendingUp} tone="blue" label="Rata-rata / Transaksi" value={formatRupiah(s.avg_transaction || 0)} />
      </div>

      <div className="card">
        {items.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="Belum ada transaksi pada tanggal ini"
            description="Coba pilih tanggal lain untuk melihat rincian penjualan harian"
          />
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>No. Transaksi</th><th>Jam</th><th>Kasir</th><th>Pelanggan</th>
                  <th>Item</th><th>Subtotal</th><th>Diskon</th><th>Pajak</th><th>Total</th>
                  <th>Metode Bayar</th><th>Status Transaksi</th><th>Status Bayar</th>
                </tr>
              </thead>
              <tbody>
                {items.map((t) => (
                  <tr key={t.id}>
                    <td className="font-mono text-sm">{t.transaction_code}</td>
                    <td>{timeOnly(t.created_at)}</td>
                    <td>{t.cashier_name}</td>
                    <td>{t.customer_name}</td>
                    <td>{formatQty(t.item_qty)}</td>
                    <td className="font-mono">{formatRupiah(t.subtotal)}</td>
                    <td className="font-mono text-muted">{formatRupiah(t.discount)}</td>
                    <td className="font-mono text-muted">{formatRupiah(t.tax)}</td>
                    <td className="font-mono">{formatRupiah(t.total)}</td>
                    <td>{t.payment_method_label}</td>
                    <td><Badge variant={statusBadgeVariant(t.status)}>{t.status_label}</Badge></td>
                    <td><Badge variant={paymentStatusBadgeVariant(t.payment_status)}>{t.payment_status}</Badge></td>
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

// ── Payload cetak / ekspor Excel — dipakai dari ReportsPage.jsx ────────────
export function buildSalesDailyExportPayload(r) {
  const rep = r.dailyReport;
  if (!rep) return {};
  const s = rep.summary || {};
  return {
    title: "Laporan Penjualan Harian",
    periodLabel: formatDate(r.dailyDate),
    columns: [
      { key: "transaction_code", label: "No. Transaksi" }, { key: "time", label: "Jam" },
      { key: "cashier_name", label: "Kasir" }, { key: "customer_name", label: "Pelanggan" },
      { key: "item_qty", label: "Item" }, { key: "subtotal", label: "Subtotal" },
      { key: "discount", label: "Diskon" }, { key: "tax", label: "Pajak" }, { key: "total", label: "Total" },
      { key: "payment_method_label", label: "Metode Bayar" }, { key: "status_label", label: "Status Transaksi" },
      { key: "payment_status", label: "Status Bayar" },
    ],
    rows: (rep.transactions || []).map((t) => ({
      transaction_code: t.transaction_code,
      time: timeOnly(t.created_at),
      cashier_name: t.cashier_name,
      customer_name: t.customer_name,
      item_qty: formatQty(t.item_qty),
      subtotal: formatRupiah(t.subtotal),
      discount: formatRupiah(t.discount),
      tax: formatRupiah(t.tax),
      total: formatRupiah(t.total),
      payment_method_label: t.payment_method_label,
      status_label: t.status_label,
      payment_status: t.payment_status,
    })),
    summary: [
      { label: "Total Transaksi", value: s.total_transactions || 0 },
      { label: "Total Item Terjual", value: formatQty(s.total_items_qty || 0) },
      { label: "Penjualan Kotor", value: formatRupiah(s.gross_sales || 0) },
      { label: "Total Diskon", value: formatRupiah(s.total_discount || 0) },
      { label: "Total Pajak", value: formatRupiah(s.total_tax || 0) },
      { label: "Penjualan Bersih", value: formatRupiah(s.net_sales || 0) },
      { label: "Rata-rata / Transaksi", value: formatRupiah(s.avg_transaction || 0) },
    ],
  };
}