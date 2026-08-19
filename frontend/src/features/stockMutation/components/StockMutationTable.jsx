// src/features/stockMutation/components/StockMutationTable.jsx
import { ArrowLeftRight } from "lucide-react";
import { EmptyState, Pagination, Badge } from "../../../components/UI";
import { formatNumber, formatDateTime } from "../../../utils/format";

const JENIS_BADGE_VARIANT = {
  penjualan: "blue",
  pembelian: "green",
  stock_opname: "orange",
  retur: "purple",
  penyesuaian_manual: "red",
  stok_awal: "blue",
  transfer_gudang: "purple",
};
const PAGE_SIZE = 25;

export default function StockMutationTable({ mutations, total, page, onPageChange }) {
  if (mutations.length === 0) {
    return <EmptyState icon={ArrowLeftRight} title="Tidak ada mutasi stok" description="Coba ubah rentang tanggal atau filter" />;
  }

  return (
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
            {mutations.map((m) => (
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
      <Pagination page={page} totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))} total={total} limit={PAGE_SIZE} onPageChange={onPageChange} />
    </>
  );
}
