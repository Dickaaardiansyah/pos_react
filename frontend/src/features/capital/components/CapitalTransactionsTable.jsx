// src/features/capital/components/CapitalTransactionsTable.jsx
// ─────────────────────────────────────────────────────────────────────────────
// PRESENTATION — Riwayat transaksi modal (Modal Awal, setoran, penarikan)
// dengan pencarian, filter jenis, dan paginasi.
// ─────────────────────────────────────────────────────────────────────────────
import { Wallet } from "lucide-react";
import { PageLoader, EmptyState, Pagination, Badge, SearchInput } from "../../../components/UI";
import { formatRupiah, formatDate } from "../../../utils/format";

const CAPITAL_TYPE_LABELS = { setoran: "Setoran", penarikan: "Penarikan (Prive)" };

export default function CapitalTransactionsTable({ c }) {
  return (
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
  );
}