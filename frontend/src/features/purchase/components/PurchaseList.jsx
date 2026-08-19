// src/features/purchase/components/PurchaseList.jsx
import { Eye, FileText, Truck } from "lucide-react";
import { EmptyState, Pagination, Badge, SearchInput } from "../../../components/UI";
import { formatRupiah, formatDate, formatQty } from "../../../utils/format";

const PAYABLE_STATUS_BADGE = { belum_lunas: "red", sebagian: "orange", lunas: "green" };
const PAYABLE_STATUS_LABEL = { belum_lunas: "Belum Lunas", sebagian: "Sebagian", lunas: "Lunas" };
const PAGE_SIZE = 20;

export default function PurchaseList({ purchases, total, page, search, onSearchChange, onPageChange, onViewDetail, onViewNota }) {
  return (
    <>
      <SearchInput
        value={search}
        onChange={onSearchChange}
        placeholder="Cari kode pembelian atau nama supplier..."
        className="mb-3 w-full"
      />

      {purchases.length === 0 ? (
        search ? (
          <EmptyState icon={Truck} title="Tidak ditemukan" description={`Tidak ada pembelian yang cocok dengan "${search}"`} />
        ) : (
          <EmptyState icon={Truck} title="Belum ada pembelian" description="Catat pembelian stok pertama Anda" />
        )
      ) : (
        <>
          <div className="table-container">
            <table>
              <thead><tr><th>Kode</th><th>Tanggal</th><th>Supplier</th><th>Total Item</th><th>Total Biaya</th><th>Cara Bayar</th><th>Nota</th><th></th></tr></thead>
              <tbody>
                {purchases.map((p) => (
                  <tr key={p.id}>
                    <td className="font-mono text-xs">{p.purchase_code}</td>
                    <td className="text-sm">{formatDate(p.purchase_date)}</td>
                    <td>{p.supplier_name || p.supplier_name_ref || "-"}</td>
                    <td>{formatQty(p.total_qty)}</td>
                    <td className="font-mono font-bold">{formatRupiah(p.total_cost)}</td>
                    <td>
                      {p.payment_method === "kredit" ? (
                        <Badge variant={PAYABLE_STATUS_BADGE[p.payable_status] || "orange"}>
                          Kredit{p.payable_status ? ` • ${PAYABLE_STATUS_LABEL[p.payable_status]}` : ""}
                        </Badge>
                      ) : (
                        <Badge variant="green">Tunai</Badge>
                      )}
                    </td>
                    <td>
                      {p.nota_url ? (
                        <button type="button" className="btn-link" title="Lihat nota" onClick={() => onViewNota(p.nota_url)}>
                          <FileText size={14} />
                        </button>
                      ) : (
                        <span className="text-muted text-xs">-</span>
                      )}
                    </td>
                    <td><button className="btn btn-ghost btn-icon btn-sm" onClick={() => onViewDetail(p.id)}><Eye size={14} /></button></td>
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
