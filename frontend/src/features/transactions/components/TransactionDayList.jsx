// src/features/transactions/components/TransactionDayList.jsx
import { Eye, Calendar, ChevronDown, ChevronUp, Ban } from "lucide-react";
import { Badge } from "../../../components/UI";
import { formatRupiah, formatDateTime, formatDate } from "../../../utils/format";

const PAYMENT_LABEL = { cash: "Tunai", debit: "Debit/Kredit", qris: "QRIS", transfer: "Transfer" };
const STATUS_LABEL = { completed: "Selesai", cancelled: "Dibatalkan", pending: "Pending" };
const STATUS_BADGE = { completed: "green", cancelled: "red", pending: "orange" };

export default function TransactionDayList({ groups, collapsedGroups, onToggleGroup, onViewDetail, onOpenVoidModal, isAdmin }) {
  return (
    <div className="tx-day-list">
      {groups.map((group) => {
        const collapsed = collapsedGroups.has(group.dateKey);
        return (
          <div className="tx-day-group" key={group.dateKey}>
            <button className="tx-day-header" onClick={() => onToggleGroup(group.dateKey)}>
              <div className="tx-day-header__left">
                <Calendar size={14} />
                <span className="tx-day-header__date">{formatDate(group.date)}</span>
                <Badge variant="blue">{group.transactions.length} transaksi</Badge>
              </div>
              <div className="tx-day-header__right">
                <span className="tx-day-header__total">
                  Total: <strong>{formatRupiah(group.total)}</strong>
                </span>
                {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
              </div>
            </button>

            {!collapsed && (
              <>
                <div className="table-container tx-day-table">
                  <table>
                    <thead>
                      <tr><th>Kode</th><th>Waktu</th><th>Kasir</th><th>Pelanggan</th><th>Metode</th><th>Status</th><th>Total</th><th></th></tr>
                    </thead>
                    <tbody>
                      {group.transactions.map((tx) => (
                        <tr key={tx.id}>
                          <td className="font-mono text-xs">{tx.transaction_code}</td>
                          <td className="text-sm">{formatDateTime(tx.created_at)}</td>
                          <td>{tx.cashier_name}</td>
                          <td>{tx.customer_name || <span className="text-muted">Umum</span>}</td>
                          <td><Badge variant="blue">{PAYMENT_LABEL[tx.payment_method] || tx.payment_method}</Badge></td>
                          <td><Badge variant={STATUS_BADGE[tx.status] || "blue"}>{STATUS_LABEL[tx.status] || tx.status}</Badge></td>
                          <td className={`font-mono font-bold${tx.status === "cancelled" ? " text-muted" : ""}`} style={tx.status === "cancelled" ? { textDecoration: "line-through" } : undefined}>
                            {formatRupiah(tx.final_amount)}
                          </td>
                          <td>
                            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => onViewDetail(tx.id)} title="Lihat detail"><Eye size={14} /></button>
                            {tx.status === "completed" && (
                              tx.pending_void_request_id ? (
                                <Badge variant="orange">Menunggu Persetujuan</Badge>
                              ) : (
                                <button
                                  className="btn btn-ghost btn-icon btn-sm"
                                  onClick={() => onOpenVoidModal(tx)}
                                  title={isAdmin ? "Batalkan transaksi" : "Ajukan pembatalan"}
                                >
                                  <Ban size={14} />
                                </button>
                              )
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="tx-day-footer">
                  <span>{group.transactions.length} transaksi</span>
                  <span>Total: <strong>{formatRupiah(group.total)}</strong></span>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
