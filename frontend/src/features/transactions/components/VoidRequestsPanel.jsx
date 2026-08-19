// src/features/transactions/components/VoidRequestsPanel.jsx
import { useState } from "react";
import { X, ClipboardCheck, Check, XCircle } from "lucide-react";
import { useVoidRequests } from "../hooks";
import { PageLoader, EmptyState, Badge } from "../../../components/UI";
import { formatRupiah, formatDateTime } from "../../../utils/format";
import RejectVoidModal from "./RejectVoidModal";

// Panel persetujuan void — admin melihat pengajuan (default: yang masih
// 'pending'), bisa menyetujui (langsung mengeksekusi void) atau menolak
// (wajib isi catatan). Lihat services/voidRequestService.js untuk validasi
// di sisi backend.
export default function VoidRequestsPanel({ onClose }) {
  const v = useVoidRequests();
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectNote, setRejectNote] = useState("");

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal--large">
        <div className="modal-header">
          <h2 className="modal-title">Persetujuan Pengajuan Void</h2>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="filter-bar" style={{ marginBottom: 12 }}>
            <select className="form-select" value={v.statusFilter} onChange={(e) => v.setStatusFilter(e.target.value)}>
              <option value="pending">Menunggu Persetujuan</option>
              <option value="approved">Disetujui</option>
              <option value="rejected">Ditolak</option>
              <option value="">Semua</option>
            </select>
          </div>

          {v.loading ? (
            <PageLoader />
          ) : v.requests.length === 0 ? (
            <EmptyState icon={ClipboardCheck} title="Tidak ada pengajuan" description="Belum ada pengajuan void pada status ini" />
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr><th>Kode Transaksi</th><th>Diajukan Oleh</th><th>Alasan</th><th>Nilai</th><th>Diajukan</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                  {v.requests.map((req) => (
                    <tr key={req.id}>
                      <td className="font-mono text-xs">{req.transaction_code}</td>
                      <td>{req.requested_by_name}</td>
                      <td className="text-sm">{req.reason}</td>
                      <td className="font-mono">{formatRupiah(req.final_amount)}</td>
                      <td className="text-sm">{formatDateTime(req.requested_at)}</td>
                      <td>
                        <Badge variant={req.status === "pending" ? "orange" : req.status === "approved" ? "green" : "red"}>
                          {req.status === "pending" ? "Menunggu" : req.status === "approved" ? "Disetujui" : "Ditolak"}
                        </Badge>
                        {req.status !== "pending" && req.review_note && (
                          <div className="text-xs text-muted">{req.review_note}</div>
                        )}
                      </td>
                      <td>
                        {req.status === "pending" && (
                          <div style={{ display: "flex", gap: 4 }}>
                            <button
                              className="btn btn-primary btn-icon btn-sm"
                              title="Setujui"
                              disabled={v.actionLoadingId === req.id}
                              onClick={() => v.approve(req.id)}
                            >
                              <Check size={14} />
                            </button>
                            <button
                              className="btn btn-danger btn-icon btn-sm"
                              title="Tolak"
                              disabled={v.actionLoadingId === req.id}
                              onClick={() => { setRejectingId(req.id); setRejectNote(""); }}
                            >
                              <XCircle size={14} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Tutup</button>
        </div>
      </div>

      {rejectingId && (
        <RejectVoidModal
          note={rejectNote}
          onNoteChange={setRejectNote}
          loading={v.actionLoadingId === rejectingId}
          onClose={() => setRejectingId(null)}
          onConfirm={async () => {
            await v.reject(rejectingId, rejectNote);
            setRejectingId(null);
          }}
        />
      )}
    </div>
  );
}
