# Testing — QasirQu Backend

> **Update:** test di project ini sekarang **integration test** — konek ke
> database MySQL asli (`pos_refactor_test`), BUKAN mock. Lihat bagian
> "Integration testing (database asli)" di bawah untuk detail & cara setup.
> Riwayat sebelumnya (mock penuh, tanpa DB) ada di bagian akhir file ini
> untuk referensi.

## Integration testing (database asli)

Setiap test menjalankan service layer dengan koneksi MySQL **sungguhan** ke
database khusus test (`pos_refactor_test`), terpisah dari database dev
(`pos_refactor`). Tidak ada `jest.mock(...)` untuk model/database lagi.

### Setup sekali di awal

1. Pastikan database dev (`pos_refactor`) di local/XAMPP kamu **sudah
   ter-update** (semua file migrasi di `database/` sudah pernah dijalankan).
   Ini penting karena skema database test di-**clone dari database dev**,
   bukan dari `init.sql` mentah — lihat penjelasan di
   `scripts/setup-test-db.js`.
2. `.env.test` sudah dibuatkan (host/user/password sama seperti `.env`,
   cuma `DB_NAME` beda: `pos_refactor_test`). Sesuaikan kalau kredensial
   MySQL kamu beda.

### Cara jalanin

```bash
cd backend
npm test              # otomatis clone skema (pretest) lalu jalankan jest --runInBand
npm run test:watch
npm run test:coverage
```

`npm test` otomatis menjalankan `scripts/setup-test-db.js` lebih dulu
(hook `pretest`), yang men-DROP & bikin ulang `pos_refactor_test` dengan
skema terbaru dari `pos_refactor` — jadi database test SELALU bersih &
sinkron tiap kali test dijalankan.

**Kenapa `--runInBand` (serial, bukan paralel)?** Karena semua test berbagi
satu database fisik yang sama. Kalau dijalankan paralel, satu test bisa
men-`TRUNCATE` tabel yang sedang dipakai test lain di worker berbeda.

### Pola di tiap file test

```js
const { connectTestDb, closeTestDb, resetDatabase } = require("../setup/db");

beforeAll(async () => { await connectTestDb(); });
afterAll(async () => { await closeTestDb(); });
beforeEach(async () => { await resetDatabase(); }); // truncate semua tabel + seed user admin/kasir (id 1 & 2)
```

`resetDatabase()` (di `tests/setup/db.js`) mengosongkan SEMUA tabel sebelum
tiap test (`TRUNCATE`, dengan `FOREIGN_KEY_CHECKS` dimatikan sementara),
lalu menyeed 2 user dasar (`id 1` = admin, `id 2` = kasir) karena banyak
tabel (transactions, journal_entries, dst.) mensyaratkan `user_id`/
`created_by` yang valid.

Di dalam test, ganti pemanggilan `xModel.method.mockResolvedValue(...)`
dengan **insert langsung ke tabel** (pakai `getPool()` dari
`config/database`) untuk menyiapkan data awal, dan ganti pengecekan
`expect(model.method).toHaveBeenCalledWith(...)` dengan **query ulang ke
tabel** untuk verifikasi hasil sungguhan. Contoh lengkap sudah dikerjakan
di `tests/services/productService.test.js` — jadikan itu template untuk
file test lain (`journalService`, `transactionService`, `purchaseService`,
`payableService`, `settingService`, dan test di `tests/models/`,
`tests/middleware/`, `tests/config/`).

### Status konversi

| File | Status |
|---|---|
| `tests/services/productService.test.js` | ✅ sudah pakai DB asli |
| `tests/services/journalService.test.js` | ⏳ belum dikonversi (masih mock) |
| `tests/services/transactionService.test.js` | ⏳ belum dikonversi |
| `tests/services/purchaseService.test.js` | ⏳ belum dikonversi |
| `tests/services/payableService.test.js` | ⏳ belum dikonversi |
| `tests/services/settingService.test.js` | ⏳ belum dikonversi |
| `tests/models/*.test.js` | ⏳ belum dikonversi |
| `tests/middleware/auth.test.js` | ⏳ belum dikonversi |
| `tests/config/database.test.js` | ⏳ belum dikonversi (kemungkinan besar file ini sudah menguji koneksi asli — cek ulang, bisa jadi tidak perlu diubah) |

---

## Riwayat: unit test dengan mock (sebelum konversi)

Sebelumnya, test di project ini adalah **unit test murni** — model
(`models/*.js`) di-mock sepenuhnya (`jest.mock`), sehingga seluruh test
berjalan **tanpa koneksi database**, hanya menguji aturan/logika bisnis di
service layer.

## Struktur

```
tests/
└── services/
    ├── journalService.test.js       (23 test)
    ├── transactionService.test.js   (13 test)
    ├── purchaseService.test.js      (9 test)
    ├── productService.test.js       (18 test)
    └── payableService.test.js       (15 test)
```

Total: **78 test case**, seluruhnya lolos (`Tests: 78 passed, 78 total`).

## Apa yang diuji per file

### `journalService.test.js` — Engine akuntansi double-entry
- `postEntry`: validasi minimal 2 baris, akun wajib ada, debit/kredit tidak
  boleh negatif, satu baris tidak boleh isi debit & kredit sekaligus, jurnal
  harus balance (total debit = total kredit), jurnal tidak boleh bernilai
  nol, pembulatan 2 desimal (`round2`) diterapkan sebelum pengecekan balance.
- `postSaleJournal`: penjualan tunai, Open Bill dengan DP sebagian, Open Bill
  penuh tanpa DP, penjualan dengan diskon — semua dipastikan **tetap
  balance**.
- `createAccount` / `updateAccount`: validasi field wajib, tipe akun & saldo
  normal, larangan duplikat kode akun, proteksi akun sistem (tidak bisa
  dinonaktifkan).

### `transactionService.test.js` — Checkout kasir
- Validasi keranjang kosong, syarat nama pelanggan untuk Open Bill, wajib
  sesi kas aktif sebelum transaksi.
- **Kepemilikan transaksi (cashier_id, shift_id) selalu diambil dari token
  login**, bukan dari body request — mencegah pemalsuan identitas kasir.
- Klasifikasi error dari model (pesan "kurang/tidak/wajib" → 400, selain itu
  → 500).
- Pembatalan (void) transaksi: alasan wajib diisi, akun admin harus aktif,
  transaksi harus ditemukan & berstatus `completed`.

### `purchaseService.test.js` — Pencatatan pembelian
- Validasi item (product_id, quantity, unit_cost).
- Pembelian **kredit** wajib nama supplier, tidak pernah tertaut ke sesi kas.
- Pembelian **tunai** ditautkan ke sesi kas aktif milik kasir yang mencatat
  (kalau ada), kode faktur hutang dibuat otomatis untuk kredit.

### `productService.test.js` — Validasi produk & stok
- `createProduct`: field wajib, barcode unik, **aturan harga grosir** (harga
  grosir diisi → jumlah beli minimum wajib ≥ 2), riwayat stok awal.
- `updateStock`: tipe perubahan valid (in/out/adjustment), validasi jumlah
  numerik & positif, aturan khusus tiap tipe (stok tidak boleh minus untuk
  `out`, nilai absolut untuk `adjustment`), `createdBy` selalu dari user
  token.

### `payableService.test.js` — Hutang & pelunasan
- `create`: validasi field wajib, jumlah dibayar di muka tidak boleh melebihi
  jumlah hutang, status otomatis (`belum_lunas` / `sebagian` / `lunas`).
- `remove`: larangan hapus hutang yang sudah ada pembayaran atau tertaut ke
  pembelian kredit (menjaga integritas jurnal).
- `recordPayment` (**pelunasan hutang**): pembayaran metode `cash` ditautkan
  ke sesi kas aktif kasir, metode lain (transfer/qris/dst) tidak pernah
  tertaut ke kas, tanggal default ke hari ini.

## Pola mocking yang dipakai

Setiap file test me-mock module `models/*.js` yang dipakai service terkait:

```js
jest.mock("../../models/journalModel");
const journalModel = require("../../models/journalModel");
const journalService = require("../../services/journalService");

beforeEach(() => {
  jest.clearAllMocks();
  journalModel.findAccountByCode.mockImplementation(async (code) => { ... });
});
```

Ini memastikan setiap test **terisolasi** (tidak saling memengaruhi) dan
**cepat** (tidak menunggu I/O database), cocok dipakai sebagai bukti
pengujian white-box pada bab metodologi skripsi maupun dijalankan otomatis
di CI/CD.

## Rekomendasi pengembangan lanjutan

Service lain yang belum tercakup dan bisa ditambahkan dengan pola yang sama:
- `receivableService.js` (piutang — mirror dari `payableService`)
- `cashRegisterService.js` (buka/tutup sesi kas, `expected_cash`)
- `stockOpnameService.js` (penyesuaian stok fisik vs sistem)
- `voidRequestService.js` (pengajuan & persetujuan pembatalan transaksi)
