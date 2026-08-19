// src/features/dashboard/components/InventoryStatsGrid.jsx
import { useNavigate } from "react-router-dom";
import { Wallet, Boxes, Receipt, CreditCard, AlertTriangle, PackageSearch } from "lucide-react";
import { StatCard } from "../../../components/UI";
import { formatRupiah } from "../../../utils/format";
import StatsSectionLabel from "./StatsSectionLabel";

export default function InventoryStatsGrid({ summary }) {
  const navigate = useNavigate();

  return (
    <>
      <StatsSectionLabel icon={Wallet} title="Kas, Piutang, Hutang & Stok" />
      <div className="stats-grid mb-3">
        <StatCard
          icon={Wallet} tone={summary.cashShiftOpen ? "blue" : "orange"} label="Saldo Kas"
          value={formatRupiah(summary.cashBalance)}
          change={summary.cashShiftOpen ? "Sesi kas sedang terbuka" : "Belum ada sesi kas terbuka"}
          changeTone="neutral"
        />
        <StatCard
          icon={Boxes} tone="purple" label="Nilai Persediaan"
          value={formatRupiah(summary.inventoryValueAtCost)}
          change="Posisi saat ini: stok x harga modal rata-rata terkini" changeTone="neutral"
          tooltip="Dihitung dari harga modal rata-rata bergerak (moving average) saat ini, bukan akumulasi HPP historis. Karena harga modal tiap produk terus diperbarui setiap ada pembelian baru, angka ini wajar berbeda dari total HPP di Laporan Laba Rugi periode berjalan."
        />
        <StatCard
          icon={Receipt} tone={summary.receivablesOverdue > 0 ? "red" : "cyan"} label="Piutang Belum Tertagih"
          value={formatRupiah(summary.receivablesOutstanding)}
          change={summary.receivablesOverdue > 0 ? `${formatRupiah(summary.receivablesOverdue)} jatuh tempo` : "Tidak ada yang jatuh tempo"}
          changeTone={summary.receivablesOverdue > 0 ? "negative" : "positive"}
          onClick={() => navigate("/piutang")}
        />
        <StatCard
          icon={CreditCard} tone={summary.payablesOverdue > 0 ? "red" : "orange"} label="Hutang Belum Dibayar"
          value={formatRupiah(summary.payablesOutstanding)}
          change={summary.payablesOverdue > 0 ? `${formatRupiah(summary.payablesOverdue)} jatuh tempo` : "Tidak ada yang jatuh tempo"}
          changeTone={summary.payablesOverdue > 0 ? "negative" : "positive"}
          onClick={() => navigate("/utang")}
        />
        <StatCard
          icon={AlertTriangle} tone={summary.lowStockCount > 0 ? "orange" : "green"}
          label="Stok Menipis" value={summary.lowStockCount}
          change={`dari ${summary.totalProducts} total produk`} changeTone="neutral"
        />
        <StatCard
          icon={PackageSearch} tone={summary.needsReorderCount > 0 ? "orange" : "green"}
          label="Perlu Reorder (ROP)" value={summary.needsReorderCount}
          change={
            summary.reorderMonitoredCount > 0
              ? `dari ${summary.reorderMonitoredCount} produk dipantau ROP`
              : "Belum ada produk yang diatur Lead Time-nya"
          }
          changeTone="neutral"
          onClick={() => navigate("/reorder-point")}
        />
      </div>
    </>
  );
}
