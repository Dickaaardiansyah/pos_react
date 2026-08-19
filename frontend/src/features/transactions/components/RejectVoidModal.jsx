// src/features/transactions/components/RejectVoidModal.jsx
import { X } from "lucide-react";

export default function RejectVoidModal({ note, onNoteChange, loading, onClose, onConfirm }) {
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal--small">
        <div className="modal-header">
          <h2 className="modal-title">Tolak Pengajuan Void</h2>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Catatan Penolakan *</label>
            <textarea
              className="form-input"
              rows={3}
              placeholder="mis. alasan tidak sesuai, perlu konfirmasi ke pelanggan dulu..."
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              autoFocus
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Batal</button>
          <button className="btn btn-danger" disabled={!note.trim() || loading} onClick={onConfirm}>
            Tolak Pengajuan
          </button>
        </div>
      </div>
    </div>
  );
}
