// src/features/stockOpname/StockOpnamePage.jsx
// ─────────────────────────────────────────────────────────────────────────────
// VIEW LAYER — Stock Opname: sesi pemeriksaan stok fisik vs stok sistem.
// Menyimpan sesi otomatis menyesuaikan stok produk & mencatat histori.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { ClipboardCheck, Plus, Trash2, Eye, X, ListChecks } from "lucide-react";
import { useStockOpname, useStockOpnameForm } from "./hooks";
import { PageLoader, EmptyState, SearchInput, Pagination, Badge } from "../../components/UI";
import { formatRupiah, formatDate, formatDateTime, formatQty } from "../../utils/format";

const TABS = [
  { id: "list", label: "Riwayat Stock Opname" },
  { id: "new", label: "Stock Opname Baru" },
];

export default function StockOpname() {
  const so = useStockOpname();

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Stock Opname</div>
          <div className="page-subtitle">Periksa stok fisik &amp; sesuaikan otomatis dengan stok sistem</div>
        </div>
      </div>

      <div className="page-body">
        <div className="tab-nav">
          {TABS.map((t) => (
            <button key={t.id} className={`tab-btn ${so.tab === t.id ? "active" : ""}`} onClick={() => so.setTab(t.id)}>{t.label}</button>
          ))}
        </div>

        {so.tab === "list" && (so.loading ? <PageLoader /> : <SessionList so={so} />)}
        {so.tab === "new" && <NewOpnameForm onSuccess={() => { so.reload(); so.setTab("list"); }} />}
      </div>

      {so.selected && <SessionDetailModal session={so.selected} onClose={() => so.setSelected(null)} />}
    </div>
  );
}

function SessionList({ so }) {
  if (so.sessions.length === 0) {
    return <EmptyState icon={ClipboardCheck} title="Belum ada stock opname" description="Buat sesi stock opname pertama Anda" />;
  }
  return (
    <>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Kode</th><th>Tanggal</th><th>Total Produk</th><th>Item Selisih</th>
              <th>Selisih Qty</th><th>Nilai Selisih</th><th>Petugas</th><th></th>
            </tr>
          </thead>
          <tbody>
            {so.sessions.map((s) => (
              <tr key={s.id}>
                <td className="font-mono text-xs">{s.opname_code}</td>
                <td className="text-sm">{formatDate(s.opname_date)}</td>
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
                <td><button className="btn btn-ghost btn-icon btn-sm" onClick={() => so.viewDetail(s.id)}><Eye size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={so.page} totalPages={Math.max(1, Math.ceil(so.total / 20))} total={so.total} limit={20} onPageChange={so.setPage} />
    </>
  );
}

function SessionDetailModal({ session, onClose }) {
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal--large">
        <div className="modal-header">
          <h2 className="modal-title">Detail Stock Opname — {session.opname_code}</h2>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="statement-row"><span>Tanggal</span><span>{formatDate(session.opname_date)}</span></div>
          <div className="statement-row"><span>Petugas</span><span>{session.recorded_by || "-"}</span></div>
          {session.notes && <div className="statement-row"><span>Catatan</span><span>{session.notes}</span></div>}
          <div className="divider" />
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Produk</th><th>SKU</th><th>Stok Sistem</th><th>Stok Fisik</th>
                  <th>Selisih</th><th>Nilai Selisih</th><th>Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {session.items?.map((item) => (
                  <tr key={item.id}>
                    <td>{item.product_name}</td>
                    <td className="font-mono text-xs">{item.product_barcode}</td>
                    <td className="font-mono">{formatQty(item.system_stock)} {item.unit}</td>
                    <td className="font-mono">{formatQty(item.physical_stock)} {item.unit}</td>
                    <td className={`font-mono ${item.difference > 0 ? "text-positive" : item.difference < 0 ? "text-negative" : ""}`}>
                      {item.difference > 0 ? "+" : ""}{formatQty(item.difference)}
                    </td>
                    <td className={`font-mono ${item.difference_value > 0 ? "text-positive" : item.difference_value < 0 ? "text-negative" : ""}`}>
                      {formatRupiah(item.difference_value)}
                    </td>
                    <td className="text-sm">{item.notes || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Tutup</button>
        </div>
      </div>
    </div>
  );
}

function NewOpnameForm({ onSuccess }) {
  const f = useStockOpnameForm(onSuccess);
  const [search, setSearch] = useState("");

  const selectedIds = new Set(f.items.map((i) => i.product_id));
  const visibleProducts = f.products.filter((p) => !selectedIds.has(p.id) && p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div className="grid-2 mb-4">
        <div className="card">
          <div className="chart-card__title">Informasi Sesi</div>
          <div className="form-group">
            <label className="form-label">Tanggal Stock Opname</label>
            <input type="date" className="form-input" value={f.opnameDate} onChange={(e) => f.setOpnameDate(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Catatan (opsional)</label>
            <input className="form-input" value={f.notes} onChange={(e) => f.setNotes(e.target.value)} placeholder="Mis. Opname akhir bulan" />
          </div>
        </div>

        <div className="card">
          <div className="chart-card__title">Ringkasan Selisih</div>
          <div className="statement-row"><span>Produk Diperiksa</span><span className="statement-value">{f.items.length}</span></div>
          <div className="statement-row"><span>Produk Selisih</span><span className="statement-value">{f.totalSelisihItems}</span></div>
          <div className="statement-row"><span>Total Selisih Qty</span><span className="statement-value">{f.totalDifferenceQty > 0 ? "+" : ""}{f.totalDifferenceQty}</span></div>
          <div className="statement-row statement-row--total">
            <span>Total Nilai Selisih</span>
            <span className="statement-value">{formatRupiah(f.totalDifferenceValue)}</span>
          </div>
        </div>
      </div>

      <div className="card mb-4">
        <div className="flex gap-3 items-center mb-3" style={{ flexWrap: "wrap" }}>
          <div className="chart-card__title" style={{ marginBottom: 0, flex: 1 }}>Tambah Produk untuk Diperiksa</div>
          <SearchInput value={search} onChange={setSearch} placeholder="Cari produk..." className="w-full" />
          {visibleProducts.length > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={() => f.addAllVisible(visibleProducts)}>
              <ListChecks size={14} /> Tambah Semua ({visibleProducts.length})
            </button>
          )}
        </div>
        {f.loadingProducts ? <PageLoader text="Memuat produk..." /> : (
          <div style={{ maxHeight: 220, overflowY: "auto" }}>
            {visibleProducts.length === 0 ? (
              <div className="text-sm text-muted">Tidak ada produk lagi untuk ditambahkan</div>
            ) : visibleProducts.map((p) => (
              <div key={p.id} className="cart-item" style={{ cursor: "pointer" }} onClick={() => f.addItem(p)}>
                <div style={{ flex: 1 }}>
                  <div className="cart-item-name">{p.name}</div>
                  <div className="cart-item-price">Stok Sistem: {formatQty(p.stock)} {p.unit} • {p.barcode}</div>
                </div>
                <Plus size={16} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="chart-card__title">Daftar Pemeriksaan Stok</div>
        {f.items.length === 0 ? (
          <EmptyState title="Belum ada produk dipilih" description="Tambahkan produk dari daftar di atas" />
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Produk</th><th>SKU</th><th>Stok Sistem</th><th style={{ minWidth: 110 }}>Stok Fisik</th>
                  <th>Selisih</th><th>Nilai Selisih</th><th style={{ minWidth: 160 }}>Keterangan</th><th></th>
                </tr>
              </thead>
              <tbody>
                {f.items.map((item) => (
                  <tr key={item.product_id}>
                    <td>{item.product_name}</td>
                    <td className="font-mono text-xs">{item.barcode}</td>
                    <td className="font-mono">{formatQty(item.system_stock)} {item.unit}</td>
                    <td>
                      <input
                        type="number" step="0.001" min="0" className="form-input" style={{ width: 90 }}
                        value={item.physical_stock}
                        onChange={(e) => f.updateItem(item.product_id, "physical_stock", e.target.value)}
                      />
                    </td>
                    <td className={`font-mono ${item.difference > 0 ? "text-positive" : item.difference < 0 ? "text-negative" : ""}`}>
                      {item.difference > 0 ? "+" : ""}{formatQty(item.difference)}
                    </td>
                    <td className={`font-mono ${item.difference_value > 0 ? "text-positive" : item.difference_value < 0 ? "text-negative" : ""}`}>
                      {formatRupiah(item.difference_value)}
                    </td>
                    <td>
                      <input
                        className="form-input" style={{ minWidth: 150 }}
                        value={item.notes} placeholder="Opsional"
                        onChange={(e) => f.updateItem(item.product_id, "notes", e.target.value)}
                      />
                    </td>
                    <td><button className="btn btn-ghost btn-icon btn-sm" onClick={() => f.removeItem(item.product_id)}><Trash2 size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <button className="btn btn-primary btn-lg w-full mt-4" onClick={f.submit} disabled={f.submitting || f.items.length === 0}>
          {f.submitting ? "Menyimpan..." : "Simpan Stock Opname"}
        </button>
      </div>
    </div>
  );
}