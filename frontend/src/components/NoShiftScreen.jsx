// src/components/NoShiftScreen.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Ditampilkan di halaman Kasir & Kas Kecil ketika belum ada sesi kas yang
// dibuka — menggantikan alur lama (isi form modal awal manual di tengah
// halaman) dengan gerbang penuh yang mengharuskan "Mulai Shift" dulu.
// Untuk admin, tombol "Mulai Shift" disembunyikan — buka/tutup kas memang
// dibatasi khusus akun kasir (lihat authorize("cashier") di
// routes/cashRegister.routes.js), admin hanya mengawasi lewat tab Riwayat.
// ─────────────────────────────────────────────────────────────────────────────
import { ShoppingCart, ShieldAlert } from "lucide-react";

export default function NoShiftScreen({ onStart, isAdmin }) {
  if (isAdmin) {
    return (
      <div className="shift-gate fade-in">
        <div className="shift-gate__illustration">
          <ShieldAlert size={40} />
        </div>
        <div className="shift-gate__title">Belum Ada Shift Berjalan</div>
        <div className="shift-gate__subtitle">
          Buka &amp; tutup kas khusus dilakukan oleh akun kasir. Login sebagai
          kasir untuk memulai shift, atau pantau riwayatnya di tab Riwayat.
        </div>
      </div>
    );
  }

  return (
    <div className="shift-gate fade-in">
      <div className="shift-gate__illustration">
        <ShoppingCart size={40} />
      </div>
      <div className="shift-gate__title">Belum Mulai Shift</div>
      <div className="shift-gate__subtitle">
        Tekan tombol "Mulai Shift" untuk memulai pekerjaan Anda
      </div>
      <button className="btn-shift" onClick={onStart}>Mulai Shift</button>
    </div>
  );
}