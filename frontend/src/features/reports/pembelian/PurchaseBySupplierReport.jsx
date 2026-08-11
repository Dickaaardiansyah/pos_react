// src/features/reports/pembelian/PurchaseBySupplierReport.jsx
// ─────────────────────────────────────────────────────────────────────────────
// VIEW LAYER — Laporan Pembelian per Supplier (modul Pembelian).
// Total pembelian, jumlah transaksi, produk, pembayaran, hutang.
// Sumber: purchase report → perSupplier.
// ─────────────────────────────────────────────────────────────────────────────
import { Users, Truck, Wallet } from "lucide-react";
import { StatCard, EmptyState, Badge } from "../../../components/UI";
import { formatRupiah, formatDate, formatQty } from "../../../utils/format";

export function PurchaseBySupplierContent({ r }) {
  const rep = r.purchaseReport;
  if (!rep) return null;
  const list = rep.perSupplier || [];
  const total = list.reduce((s, x) => s + Number(x.total_cost || x.total_amount || 0), 0);
  const totalTx = list.reduce((s, x) => s + Number(x.transaction_count || 0), 0);

  return (
    <>
      <div className="stats-grid">
        <StatCard icon={Users} tone="blue" label="Jumlah Supplier" value={list.length} />
        <StatCard icon={Truck} tone="cyan" label="Total Transaksi" value={totalTx} />
        <StatCard icon={Wallet} tone="green" label="Total Pembelian" value={formatRupiah(total)} />
      </div>

      <div className="card">
        <div className="chart-card__title">Pembelian per Supplier</div>
        {list.length === 0 ? (
          <EmptyState
            icon={Truck}
            title="Belum ada data pembelian per supplier"
            description="Coba ubah rentang tanggal"
          />
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Jumlah Transaksi</th>
                  <th>Qty</th>
                  <th>Total Pembelian</th>
                  <th>Total Dibayar</th>
                  <th>Sisa Hutang</th>
                </tr>
              </thead>
              <tbody>
                {list.map((row, i) => {
                  const cost = Number(row.total_cost || row.total_amount || 0);
                  const paid = Number(row.total_paid || row.paid_amount || 0);
                  const debt = Number(row.total_debt || row.outstanding || Math.max(0, cost - paid));
                  return (
                    <tr key={row.supplier_id || i}>
                      <td>{row.supplier_name || row.name || "-"}</td>
                      <td>{row.transaction_count || 0}</td>
                      <td>{formatQty(row.total_qty || 0)}</td>
                      <td className="font-mono">{formatRupiah(cost)}</td>
                      <td className="font-mono text-success">{formatRupiah(paid)}</td>
                      <td>
                        {debt > 0 ? (
                          <Badge variant="orange">{formatRupiah(debt)}</Badge>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
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

export function buildPurchaseBySupplierExportPayload(r) {
  const list = r.purchaseReport?.perSupplier || [];
  const rows = list.map((row) => {
    const cost = Number(row.total_cost || row.total_amount || 0);
    const paid = Number(row.total_paid || row.paid_amount || 0);
    const debt = Number(row.total_debt || row.outstanding || Math.max(0, cost - paid));
    return {
      supplier: row.supplier_name || row.name || "-",
      transaksi: row.transaction_count || 0,
      qty: formatQty(row.total_qty || 0),
      total_pembelian: formatRupiah(cost),
      total_dibayar: formatRupiah(paid),
      sisa_hutang: formatRupiah(debt),
    };
  });
  const totalCost = list.reduce((s, x) => s + Number(x.total_cost || x.total_amount || 0), 0);
  const totalTx = list.reduce((s, x) => s + Number(x.transaction_count || 0), 0);
  return {
    title: "Laporan Pembelian per Supplier",
    periodLabel: `${formatDate(r.startDate)} – ${formatDate(r.endDate)}`,
    columns: [
      { key: "supplier", label: "Supplier" },
      { key: "transaksi", label: "Transaksi" },
      { key: "qty", label: "Qty" },
      { key: "total_pembelian", label: "Total Pembelian" },
      { key: "total_dibayar", label: "Total Dibayar" },
      { key: "sisa_hutang", label: "Sisa Hutang" },
    ],
    rows,
    summary: [
      { label: "Jumlah Supplier", value: list.length },
      { label: "Total Transaksi", value: totalTx },
      { label: "Total Pembelian", value: formatRupiah(totalCost) },
    ],
  };
}