# Unit Testing — QasirQu Backend

Pengujian unit untuk **service layer** backend QasirQu, menggunakan **Jest**.
Model (`models/*.js`) di-mock sepenuhnya (`jest.mock`), sehingga seluruh test
berjalan **tanpa koneksi database** — murni menguji aturan/logika bisnis di
service layer, konsisten dengan arsitektur MVP proyek (Model → Service →
Controller).

## Cara menjalankan

```bash
cd backend
npm install          # sekali saja, jest sudah masuk devDependencies
npm test             # jalankan semua test
npm run test:watch   # mode watch (re-run otomatis saat file berubah)
npm run test:coverage  # jalankan + laporan cakupan kode (folder coverage/)
```

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
