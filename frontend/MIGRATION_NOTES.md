# Catatan Refaktor: MVP-layer → Feature Folder + TanStack Query

## Apa yang berubah

**Sebelum:** kode dipisah per *tipe layer* — semua model di `src/models/`,
semua presenter (custom hook) di `src/presenters/`, semua halaman di
`src/views/pages/`. Untuk memahami satu fitur (mis. Pelanggan), harus buka
3 folder berbeda.

**Sesudah:** kode dipisah per *fitur* — `src/features/customers/` berisi
`api.js` (panggilan REST), `hooks.js` (state + logic), dan
`CustomersPage.jsx` (UI) sekaligus. ini pola "colocation" yang jadi standar
React saat ini: semua yang berubah bersama, disimpan bersama.

Fetching data server juga tidak lagi manual `useState`+`useEffect`+
try/catch/finally yang diulang di 18 file — sekarang pakai
**TanStack Query** (`@tanstack/react-query`), yang menangani cache, retry,
dan invalidasi otomatis.

## Struktur folder baru

```
src/
  lib/
    httpClient.js      # fetch wrapper + auth token (persis yang lama)
    queryClient.js      # konfigurasi TanStack Query + query keys terpusat
  components/            # shared UI (Sidebar, modal, dll) — dulu views/components
  context/               # AuthContext, ShiftContext, PrinterContext — tidak berubah
  hooks/                  # useLocalStorage, useDebounce, dll — tidak berubah
  utils/, styles/         # tidak berubah
  features/
    auth/            { api.js, useLogin.js, LoginPage.jsx }
    customers/       { api.js, hooks.js, CustomersPage.jsx }
    products/        { api.js, hooks.js, ProductsPage.jsx }
    reorderPoint/    { hooks.js, ReorderPointPage.jsx }
    stockMutation/   { api.js, hooks.js, StockMutationPage.jsx }
    settings/        { api.js, hooks.js, SettingsPage.jsx }
    cashRegister/    { api.js, hooks.js, CashRegisterPage.jsx }
    dashboard/       { hooks.js, DashboardPage.jsx }
    transactions/    { api.js, hooks.js, TransactionsPage.jsx }
    payables/        { api.js, hooks.js, UtangPage.jsx }
    receivables/     { api.js, hooks.js, PiutangPage.jsx }
    purchase/        { api.js, hooks.js, PurchasePage.jsx }
    journal/         { api.js, hooks.js, JournalPage.jsx }
    stockOpname/     { api.js, hooks.js, StockOpnamePage.jsx }
    labaRugi/        { api.js, hooks.js, LabaRugiPage.jsx }
    reports/         { hooks.js, ReportsPage.jsx }
    cashier/         { hooks.js, CashierPage.jsx }
    notifications/   { api.js, hooks.js }  # dipakai NotificationBell
```

## Kaidah yang dipakai untuk memilih react-query vs custom hook biasa

- **Data dari server yang bisa di-cache** (daftar produk, riwayat transaksi,
  laporan, dll) → `useQuery`. Aksi yang mengubah data di server (hapus,
  simpan, bayar) → `useMutation` + `queryClient.invalidateQueries`.
- **State form/keranjang murni lokal** (form tambah produk, keranjang
  kasir, form pembelian, form stock opname) → **tetap custom hook biasa**
  (`useState` + fungsi), TIDAK dipaksa ke react-query. Ini bukan data yang
  perlu di-cache, jadi react-query cuma menambah kerumitan tanpa manfaat.
- **Sesi shift/kas** (`ShiftContext`) tetap Context API, bukan react-query,
  karena statusnya dipakai bersama secara global (Sidebar, Kasir, Kas Kecil)
  dengan efek samping (buka/tutup kas) yang lebih pas sebagai Context.

## Bonus: code-splitting per halaman

`App.jsx` sekarang memuat tiap halaman lewat `React.lazy()` + `Suspense`.
Sebelumnya seluruh app jadi satu bundle ~1 MB; sekarang bundle awal turun
jadi ~276 kB, sisanya baru diunduh browser saat halaman itu dibuka.

## PENTING — yang belum saya tes

Saya tidak punya akses ke backend/database live kalian, jadi build hanya
saya verifikasi lewat `npm run build` (sukses, tidak ada error import).
**Wajib dites manual sebelum deploy**, terutama:

1. **Kasir** — tambah item, pilih varian/satuan, checkout tunai/kredit/QRIS/
   Open Bill, cetak struk.
2. **Kas Kecil** — buka shift, catat pemasukan/pengeluaran, tutup shift.
3. **Pembelian** — tambah item, upload nota, submit tunai & kredit.
4. Semua halaman dengan tab (Journal, Payables, Receivables, LabaRugi,
   Reports) — pastikan tiap tab memuat data dengan benar saat pertama kali
   diklik.
5. Notifikasi (bel) — badge unread count & tandai dibaca.

Kalau ada perilaku yang beda dari sebelumnya, hook lama biasanya masih bisa
dibandingkan lewat riwayat git (semua logic bisnis dipindah, bukan ditulis
ulang dari nol — kecuali bagian yang eksplisit disebut "react-query" di atas).
