// src/features/products/components/CategoryUnitManagerModal.jsx
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { ConfirmDialog } from "../../../components/UI";

// Modal untuk mengelola (melihat & menghapus) master data Kategori dan
// Satuan. Kategori boleh dihapus meski masih dipakai produk (produk terkait
// otomatis jadi "Tanpa Kategori"). Satuan TIDAK boleh dihapus kalau masih
// dipakai produk manapun — tombol hapus tetap ditampilkan, tapi backend akan
// menolak dan pesan errornya ditampilkan lewat toast (lihat unitService.deleteUnit).
export default function CategoryUnitManagerModal({ categories, units, onDeleteCategory, onDeleteUnit, onClose }) {
  const [tab, setTab] = useState("kategori");
  const [pendingDelete, setPendingDelete] = useState(null); // { type, item }
  const [deleting, setDeleting] = useState(false);

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    if (pendingDelete.type === "kategori") await onDeleteCategory(pendingDelete.item);
    else await onDeleteUnit(pendingDelete.item);
    setDeleting(false);
    setPendingDelete(null);
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal--medium">
        <div className="modal-header">
          <h2 className="modal-title">Kelola Kategori &amp; Satuan</h2>
        </div>
        <div className="modal-body">
          <div className="product-form-tabs">
            <button type="button" className={`product-form-tab ${tab === "kategori" ? "active" : ""}`} onClick={() => setTab("kategori")}>
              Kategori
            </button>
            <button type="button" className={`product-form-tab ${tab === "satuan" ? "active" : ""}`} onClick={() => setTab("satuan")}>
              Satuan
            </button>
          </div>

          {tab === "kategori" && (
            <div className="manager-list">
              {categories.length === 0 && <div className="text-sm text-muted">Belum ada kategori</div>}
              {categories.map((c) => (
                <div className="manager-list__row" key={c.id}>
                  <div>
                    <div className="font-bold">{c.name}</div>
                    <div className="text-xs text-muted">
                      {c.product_count > 0 ? `Dipakai ${c.product_count} produk` : "Belum dipakai produk apa pun"}
                    </div>
                  </div>
                  <button className="btn btn-ghost btn-icon btn-sm" title="Hapus kategori" onClick={() => setPendingDelete({ type: "kategori", item: c })}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {tab === "satuan" && (
            <div className="manager-list">
              {units.length === 0 && <div className="text-sm text-muted">Belum ada satuan</div>}
              {units.map((u) => {
                const usage = (u.additional_usage_count || 0) + (u.base_usage_count || 0);
                return (
                  <div className="manager-list__row" key={u.id}>
                    <div>
                      <div className="font-bold">{u.name}</div>
                      <div className="text-xs text-muted">
                        {usage > 0 ? `Dipakai ${usage} produk — tidak bisa dihapus` : "Belum dipakai produk apa pun"}
                      </div>
                    </div>
                    <button className="btn btn-ghost btn-icon btn-sm" title="Hapus satuan" onClick={() => setPendingDelete({ type: "satuan", item: u })}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Tutup</button>
        </div>
      </div>

      {pendingDelete && (
        <ConfirmDialog
          title={pendingDelete.type === "kategori" ? "Hapus Kategori?" : "Hapus Satuan?"}
          message={`Hapus "${pendingDelete.item.name}"? Tindakan ini tidak bisa dibatalkan.`}
          danger
          loading={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
