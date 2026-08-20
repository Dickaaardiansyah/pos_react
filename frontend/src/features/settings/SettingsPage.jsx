// src/features/settings/SettingsPage.jsx
import { useState } from "react";
import { Save, UserPlus, Trash2, Pencil, Download, Printer as PrinterIcon, Usb, Cable, Unplug, CheckCircle2, AlertCircle, HelpCircle } from "lucide-react";
import { useSettings } from "./hooks";
import EditUserModal from "./components/EditUserModal";
import { usePrinterContext } from "../../context/PrinterContext";
import { useAuth } from "../../context/AuthContext";
import { printReceiptSmart } from "../../utils/printReceipt";
import { PageLoader, Badge } from "../../components/UI";
import toast from "react-hot-toast";

const TABS = [
  { id: "store", label: "Info Toko", roles: ["admin"] },
  { id: "printer", label: "Printer Struk", roles: ["admin", "cashier"] },
  { id: "users", label: "Pengguna", roles: ["admin"] },
  { id: "export", label: "Ekspor Data", roles: ["admin"] },
];

export default function Settings() {
  const s = useSettings();
  const { isAdmin } = useAuth();
  const tabs = TABS.filter((t) => t.roles.includes(isAdmin ? "admin" : "cashier"));
  const [tab, setTab] = useState(isAdmin ? "store" : "printer");

  if (s.loading) return <PageLoader text="Memuat pengaturan..." />;

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Pengaturan</div>
          <div className="page-subtitle">Konfigurasi toko, pengguna, dan data</div>
        </div>
      </div>

      <div className="page-body">
        <div className="tab-nav">
          {tabs.map((t) => <button key={t.id} className={`tab-btn ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>{t.label}</button>)}
        </div>

        {tab === "store" && isAdmin && <StoreSettingsTab s={s} />}
        {tab === "printer" && <PrinterTab s={s} />}
        {tab === "users" && isAdmin && <UsersTab s={s} />}
        {tab === "export" && isAdmin && <ExportTab s={s} />}
      </div>
    </div>
  );
}

function StoreSettingsTab({ s }) {
  return (
    <div className="card" style={{ maxWidth: 520 }}>
      <div className="form-group">
        <label className="form-label">Nama Toko</label>
        <input className="form-input" value={s.settings.store_name || ""} onChange={(e) => s.setField("store_name", e.target.value)} />
      </div>
      <div className="form-group">
        <label className="form-label">Alamat</label>
        <textarea className="form-textarea" value={s.settings.store_address || ""} onChange={(e) => s.setField("store_address", e.target.value)} />
      </div>
      <div className="grid-2">
        <div className="form-group">
          <label className="form-label">No. Telepon</label>
          <input className="form-input" value={s.settings.store_phone || ""} onChange={(e) => s.setField("store_phone", e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Email</label>
          <input className="form-input" value={s.settings.store_email || ""} onChange={(e) => s.setField("store_email", e.target.value)} />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Catatan Kaki Struk</label>
        <input className="form-input" value={s.settings.receipt_footer || ""} onChange={(e) => s.setField("receipt_footer", e.target.value)} />
      </div>
      <div className="form-group">
        <label className="form-label">Jam Operasional Toko (jam/hari)</label>
        <input type="number" min="1" max="24" step="0.5" className="form-input" value={s.settings.store_operating_hours || 10} onChange={(e) => s.setField("store_operating_hours", e.target.value)} />
        <div className="form-hint">Dipakai untuk menghitung Reorder Point berbasis jam (Produk → Lead Time dengan satuan "Jam")</div>
      </div>
      <div className="divider" />
      <div className="form-group">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={s.settings.tax_enabled === true || s.settings.tax_enabled === "true"} onChange={(e) => s.setField("tax_enabled", e.target.checked)} />
          Aktifkan pajak penghasilan pada Laporan Laba Rugi
        </label>
      </div>
      {(s.settings.tax_enabled === true || s.settings.tax_enabled === "true") && (
        <div className="form-group">
          <label className="form-label">Tarif Pajak (%)</label>
          <input type="number" className="form-input" value={s.settings.tax_rate || 0} onChange={(e) => s.setField("tax_rate", e.target.value)} />
        </div>
      )}
      <button className="btn btn-primary mt-2" onClick={s.saveSettings} disabled={s.saving}>
        <Save size={14} /> {s.saving ? "Menyimpan..." : "Simpan Pengaturan"}
      </button>
    </div>
  );
}

const PRINTER_STATUS_INFO = {
  connected: { label: "Tersambung", variant: "green", icon: CheckCircle2 },
  connecting: { label: "Menyambungkan...", variant: "blue", icon: HelpCircle },
  error: { label: "Gagal Tersambung", variant: "red", icon: AlertCircle },
  unsupported: { label: "Browser Tidak Didukung", variant: "red", icon: AlertCircle },
  idle: { label: "Tidak Tersambung", variant: "red", icon: AlertCircle },
};

function PrinterTab({ s }) {
  const printer = usePrinterContext();
  const [testing, setTesting] = useState(false);

  const info = PRINTER_STATUS_INFO[printer.status] || PRINTER_STATUS_INFO.idle;
  const StatusIcon = info.icon;

  async function handleTestPrint() {
    setTesting(true);
    try {
      const dummy = {
        transaction_code: "TEST-0001",
        cashier_name: "Kasir",
        customer_name: "",
        created_at: new Date().toISOString(),
        items: [{ product_name: "Contoh Produk", quantity: 1, unit_price: 10000, subtotal: 10000 }],
        total_amount: 10000,
        discount_amount: 0,
        final_amount: 10000,
        payment_method: "cash",
        payment_amount: 10000,
        change_amount: 0,
      };
      await printReceiptSmart(dummy, s.settings, printer);
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 560 }}>
      <div className="flex items-center gap-2 mb-3">
        <PrinterIcon size={18} />
        <span className="font-bold">Status Printer Struk</span>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <Badge variant={info.variant}>
          <span className="flex items-center gap-1"><StatusIcon size={12} /> {info.label}</span>
        </Badge>
        {printer.deviceName && <span className="text-sm text-muted">{printer.deviceName}</span>}
      </div>

      {printer.errorMsg && (
        <p className="text-sm mb-3" style={{ color: "var(--accent-red, #dc2626)" }}>{printer.errorMsg}</p>
      )}

      <p className="text-sm text-muted mb-4">
        Printer thermal (mis. RPP02N) tidak bisa tersambung otomatis begitu saja saat membuka
        aplikasi — browser mengharuskan koneksi pertama kali dipilih manual lewat tombol di bawah
        ini (via Bluetooth/COM atau USB). Setelah dihubungkan sekali, aplikasi akan mencoba
        menyambung ulang secara otomatis tanpa dialog setiap kali dibuka lagi, dan status
        tersambungnya akan terlihat di halaman Kasir maupun Riwayat Transaksi.
      </p>

      {printer.status === "connected" ? (
        <div className="flex gap-2 flex-wrap">
          <button className="btn btn-ghost" onClick={printer.disconnect}>
            <Unplug size={14} /> Putuskan Sambungan
          </button>
          <button className="btn btn-primary" onClick={handleTestPrint} disabled={testing}>
            <PrinterIcon size={14} /> {testing ? "Mencetak..." : "Tes Cetak Struk"}
          </button>
        </div>
      ) : (
        <div className="flex gap-2 flex-wrap">
          <button className="btn btn-primary" onClick={printer.connectSerial} disabled={printer.status === "connecting"}>
            <Cable size={14} /> Hubungkan Serial (Bluetooth/COM)
          </button>
          <button className="btn btn-ghost" onClick={printer.connectUSB} disabled={printer.status === "connecting"}>
            <Usb size={14} /> Hubungkan USB
          </button>
        </div>
      )}

      {!printer.isSerialSupported && !printer.isUsbSupported && (
        <p className="text-sm mt-3" style={{ color: "var(--accent-red, #dc2626)" }}>
          Browser ini tidak mendukung Web Serial maupun WebUSB. Gunakan Chrome/Edge terbaru
          melalui HTTPS atau localhost untuk menghubungkan printer.
        </p>
      )}
    </div>
  );
}

function UsersTab({ s }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", username: "", password: "", role: "cashier" });
  const [submitting, setSubmitting] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  async function submit() {
    if (!form.name || !form.username || !form.password) { toast.error("Lengkapi semua field"); return; }
    setSubmitting(true);
    const ok = await s.createUser(form);
    setSubmitting(false);
    if (ok) { setForm({ name: "", username: "", password: "", role: "cashier" }); setShowForm(false); }
  }

  async function submitEdit(payload) {
    setSavingEdit(true);
    const ok = await s.updateUser(editingUser.id, payload);
    setSavingEdit(false);
    if (ok) setEditingUser(null);
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <div className="font-bold text-sm">{s.users.length} pengguna terdaftar</div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm((v) => !v)}><UserPlus size={14} /> Tambah User</button>
      </div>

      {showForm && (
        <div className="card mb-4" style={{ maxWidth: 480 }}>
          <div className="grid-2">
            <div className="form-group"><label className="form-label">Nama</label><input className="form-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Username</label><input className="form-input" value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} /></div>
          </div>
          <div className="grid-2">
            <div className="form-group"><label className="form-label">Password</label><input type="password" className="form-input" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} /></div>
            <div className="form-group">
              <label className="form-label">Peran</label>
              <select className="form-select" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
                <option value="cashier">Kasir</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <button className="btn btn-primary" onClick={submit} disabled={submitting}>{submitting ? "Menyimpan..." : "Simpan User"}</button>
        </div>
      )}

      <div className="table-container">
        <table>
          <thead><tr><th>Nama</th><th>Username</th><th>Peran</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {s.users.map((u) => (
              <tr key={u.id} className={!u.is_active ? "user-row-inactive" : ""}>
                <td className="font-bold">{u.name}</td>
                <td className="font-mono text-xs">{u.username}</td>
                <td><Badge variant={u.role === "admin" ? "purple" : "blue"}>{u.role === "admin" ? "Admin" : "Kasir"}</Badge></td>
                <td><Badge variant={u.is_active ? "green" : "red"}>{u.is_active ? "Aktif" : "Nonaktif"}</Badge></td>
                <td>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setEditingUser(u)} title="Edit / reset password"><Pencil size={14} /></button>
                  {u.is_active ? (
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => s.removeUser(u)}><Trash2 size={14} /></button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingUser && (
        <EditUserModal
          user={editingUser}
          loading={savingEdit}
          onClose={() => setEditingUser(null)}
          onSave={submitEdit}
        />
      )}
    </div>
  );
}

function ExportTab({ s }) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  return (
    <div className="grid-2">
      <div className="card">
        <div className="chart-card__title">Ekspor Transaksi (CSV)</div>
        <div className="form-group"><label className="form-label">Dari Tanggal</label><input type="date" className="form-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Sampai Tanggal</label><input type="date" className="form-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
        <button className="btn btn-primary" onClick={() => s.exportTransactions({ start_date: startDate, end_date: endDate })}>
          <Download size={14} /> Unduh CSV Transaksi
        </button>
      </div>
      <div className="card">
        <div className="chart-card__title">Ekspor Produk (CSV)</div>
        <p className="text-sm text-muted mb-3">Mengunduh seluruh data produk beserta stok dan harga saat ini.</p>
        <button className="btn btn-primary" onClick={s.exportProducts}><Download size={14} /> Unduh CSV Produk</button>
      </div>
    </div>
  );
}