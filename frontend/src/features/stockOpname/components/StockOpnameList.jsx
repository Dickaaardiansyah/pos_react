// src/features/stockOpname/components/StockOpnameList.jsx
import { ClipboardCheck, Eye } from "lucide-react";
import { EmptyState, Pagination, Badge, SearchInput } from "../../../components/UI";
import { formatRupiah, formatDate } from "../../../utils/format";

const PAGE_SIZE = 20;

export default function StockOpnameList({ sessions, total, page, search, fetching, onSearchChange, onPageChange, onViewDetail }) {
  return (
    <>
      <div className="flex gap-3 items-center mb-3" style={{ flexWrap: "wrap" }}>
        <SearchInput
          value={search}
          onChange={onSearchChange}
          placeholder="Cari berdasarkan nama produk / barcode..."
          className="w-full"
        />
      </div>

      {sessions.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title={search ? "Tidak ditemukan" : "Belum ada stock opname"}
          description={search ? `Tidak ada sesi yang memuat produk "${search}"` : "Buat sesi stock opname pertama Anda"}
        />
      ) : (
        <>
          <div className="table-container" style={{ opacity: fetching ? 0.6 : 1, transition: "opacity 0.15s" }}>
            <table>
              <thead>
                <tr>
                  <th>Kode</th><th>Tanggal</th><th>Produk</th><th>Total Produk</th><th>Item Selisih</th>
                  <th>Selisih Qty</th><th>Nilai Selisih</th><th>Petugas</th><th></th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id}>
                    <td className="font-mono text-xs">{s.opname_code}</td>
                    <td className="text-sm">{formatDate(s.opname_date)}</td>
                    <td className="text-sm" style={{ maxWidth: 220 }}>{s.product_names || "-"}</td>
                    <td>{s.total_items}</td>
                    <td>
                      {s.total_items_selisih > 0 ? <Badge variant="orange">{s.total_items_selisih} produk</Badge> : <Badge variant="green">Sesuai</Badge>}
                    </td>
                    <td className={`font-mono ${s.total_difference_qty > 0 ? "text-positive" : s.total_difference_qty < 0 ? "text-negative" : ""}`}>
                      {s.total_difference_qty > 0 ? "+" : ""}{s.total_difference_qty}
                    </td>
                    <td className={`font-mono font-bold ${s.total_difference_value > 0 ? "text-positive" : s.total_difference_value < 0 ? "text-negative" : ""}`}>
                      {formatRupiah(s.total_difference_value)}
                    </td>
                    <td className="text-sm">{s.recorded_by || "-"}</td>
                    <td><button className="btn btn-ghost btn-icon btn-sm" onClick={() => onViewDetail(s.id)}><Eye size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))} total={total} limit={PAGE_SIZE} onPageChange={onPageChange} />
        </>
      )}
    </>
  );
}
