// src/features/settings/components/EditUserModal.jsx
// Modal edit user dari tab Pengaturan > Pengguna — dipakai admin untuk
// mengubah nama/peran/status, dan (opsional) reset password.
//
// FIX (revisi dosen #15 — terkait): backend sudah lama punya endpoint
// PUT /api/settings/users/:id yang menerima field password (di-hash bcrypt
// kalau diisi), tapi belum ada UI-nya di frontend — jadi satu-satunya cara
// reset password admin selama ini lewat query manual ke database. Modal ini
// menutup celah itu: field password dikosongkan berarti "jangan diubah",
// diisi berarti password lama langsung diganti (di-hash di backend, tidak
// pernah dikirim/disimpan sebagai plain text di luar request ini).
import { useState } from "react";
import { X } from "lucide-react";

export default function EditUserModal({ user, onClose, onSave, loading }) {
  const [form, setForm] = useState({
    name: user.name,
    role: user.role,
    is_active: user.is_active,
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");

  function submit() {
    if (!form.name.trim()) return;
    setError("");
    if (form.password.trim()) {
      if (form.password.trim().length < 8) {
        setError("Password minimal 8 karakter");
        return;
      }
      if (form.password.trim() !== form.confirmPassword.trim()) {
        setError("Konfirmasi password tidak cocok");
        return;
      }
    }
    const payload = {
      name: form.name.trim(),
      role: form.role,
      is_active: form.is_active,
    };
    // Hanya kirim password kalau memang diisi — biar backend tahu ini
    // bukan permintaan ganti password (lihat settingService.updateUser).
    if (form.password.trim()) payload.password = form.password.trim();
    onSave(payload);
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal--small">
        <div className="modal-header">
          <h2 className="modal-title">Edit Pengguna — {user.username}</h2>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Nama</label>
            <input
              className="form-input"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Peran</label>
            <select
              className="form-select"
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            >
              <option value="cashier">Kasir</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select
              className="form-select"
              value={form.is_active ? "1" : "0"}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.value === "1" }))}
            >
              <option value="1">Aktif</option>
              <option value="0">Nonaktif</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Password Baru (opsional)</label>
            <input
              type="password"
              className="form-input"
              placeholder="Kosongkan kalau tidak mau mengubah password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              autoComplete="new-password"
            />
          </div>
          {form.password.trim() && (
            <div className="form-group">
              <label className="form-label">Konfirmasi Password Baru</label>
              <input
                type="password"
                className="form-input"
                placeholder="Ulangi password baru"
                value={form.confirmPassword}
                onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                autoComplete="new-password"
              />
            </div>
          )}
          {error && <p className="text-danger" style={{ fontSize: "0.875rem", marginTop: "-4px" }}>{error}</p>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Batal</button>
          <button className="btn btn-primary" disabled={!form.name.trim() || loading} onClick={submit}>
            {loading ? "Menyimpan..." : "Simpan Perubahan"}
          </button>
        </div>
      </div>
    </div>
  );
}