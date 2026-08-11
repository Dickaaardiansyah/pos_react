// src/features/reports/produk/StockOpnameReport.jsx
// ─────────────────────────────────────────────────────────────────────────────
// VIEW LAYER — Laporan Stock Opname (modul Produk).
// Rekap sesi opname: produk, stok sistem, stok fisik, selisih, alasan.
// Sumber: stock-opname list + detail per sesi.
// ─────────────────────────────────────────────────────────────────────────────
import { ClipboardList, Package, AlertTriangle, CheckCircle2 } from "lucide-react";
import { StatCard, EmptyState, Badge } from "../../../components/UI";
import { formatRupiah, formatDate, formatQty } from "../../../utils/format";

export function StockOpnameContent({ r }) {
  const sessions = r.opnameReport?.sessions || [];
  const summary = r.opnameReport?.summary || {};
  const selected = r.opnameReport?.selectedDetail || null;

  return (
    <>
      <div className="stats-grid">
        <StatCard icon={ClipboardList} tone="blue" label="Total Sesi" value={summary.total_sessions || sessions.length || 0} />
        <StatCard icon={Package} tone="cyan" label="Total Item Dicek" value={summary.total_items || 0} />
        <StatCard icon={AlertTriangle} tone="orange" label="Total Selisih (−)" value={formatQty(summary.total_minus || 0)} />
        <StatCard icon={CheckCircle2} tone="green" label="Total Selisih (+)" value={formatQty(summary.total_plus || 0)} />
      </div>

      <div className="card mb-4">
        <div className="chart-card__title">Daftar Sesi Stock Opname</div>
        {sessions.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Belum ada sesi stock opname"
            description="Coba pilih rentang tanggal lain"
          />
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Tanggal</th>
                  <th>User</th>
                  <th>Item</th>
                  <th>Catatan</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id}>
                    <td className="font-mono text-sm">{s.opname_code}</td>
                    <td>{formatDate(s.opname_date || s.created_at)}</td>
                    <td>{s.recorded_by_name || s.recorded_by || "-"}</td>
                    <td>{s.item_count ?? s.items_count ?? "-"}</td>
                    <td className="text-sm text-muted">{s.notes || "-"}</td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => r.loadOpnameDetail?.(s.id)}
                      >
                        Detail
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <div className="card">
          <div className="chart-card__title">
            Detail: {selected.opname_code} — {formatDate(selected.opname_date)}
          </div>
          {(selected.items || []).length === 0 ? (
            <EmptyState icon={Package} title="Tidak ada item" />
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Produk</th>
                    <th>Sistem</th>
                    <th>Fisik</th>
                    <th>Selisih</th>
                    <th>Alasan / Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.items.map((item, i) => {
                    const sys = Number(item.system_stock ?? item.system_qty ?? 0);
                    const phys = Number(item.physical_stock ?? item.physical_qty ?? 0);
                    const diff = phys - sys;
                    return (
                      <tr key={item.id || i}>
                        <td>{item.product_name || item.name}</td>
                        <td className="font-mono">{formatQty(sys)}</td>
                        <td className="font-mono">{formatQty(phys)}</td>
                        <td>
                          <Badge variant={diff < 0 ? "red" : diff > 0 ? "green" : "blue"}>
                            {diff > 0 ? `+${formatQty(diff)}` : formatQty(diff)}
                          </Badge>
                        </td>
                        <td className="text-sm text-muted">{item.notes || item.reason || "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );
}

export function buildStockOpnameExportPayload(r) {
  const selected = r.opnameReport?.selectedDetail;
  if (selected?.items?.length) {
    const rows = selected.items.map((item) => {
      const sys = Number(item.system_stock ?? item.system_qty ?? 0);
      const phys = Number(item.physical_stock ?? item.physical_qty ?? 0);
      return {
        produk: item.product_name || item.name,
        sistem: formatQty(sys),
        fisik: formatQty(phys),
        selisih: formatQty(phys - sys),
        alasan: item.notes || item.reason || "-",
      };
    });
    return {
      title: `Laporan Stock Opname — ${selected.opname_code}`,
      periodLabel: formatDate(selected.opname_date),
      columns: [
        { key: "produk", label: "Produk" },
        { key: "sistem", label: "Sistem" },
        { key: "fisik", label: "Fisik" },
        { key: "selisih", label: "Selisih" },
        { key: "alasan", label: "Alasan" },
      ],
      rows,
      summary: [],
    };
  }
  const sessions = r.opnameReport?.sessions || [];
  const summary = r.opnameReport?.summary || {};
  const rows = sessions.map((s) => ({
    kode: s.opname_code,
    tanggal: formatDate(s.opname_date || s.created_at),
    user: s.recorded_by_name || s.recorded_by || "-",
    item: s.item_count ?? s.items_count ?? 0,
    catatan: s.notes || "-",
  }));
  return {
    title: "Laporan Stock Opname",
    periodLabel: `${formatDate(r.startDate)} – ${formatDate(r.endDate)}`,
    columns: [
      { key: "kode", label: "Kode" },
      { key: "tanggal", label: "Tanggal" },
      { key: "user", label: "User" },
      { key: "item", label: "Item" },
      { key: "catatan", label: "Catatan" },
    ],
    rows,
    summary: [
      { label: "Total Sesi", value: summary.total_sessions || sessions.length || 0 },
      { label: "Total Item Dicek", value: summary.total_items || 0 },
    ],
  };
}