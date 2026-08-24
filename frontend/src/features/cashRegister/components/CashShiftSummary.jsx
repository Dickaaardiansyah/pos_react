// src/features/cashRegister/components/CashShiftSummary.jsx
// ─────────────────────────────────────────────────────────────────────────────
// PRESENTATION — Kartu ringkasan modal awal, penjualan tunai, kas masuk/keluar,
// dan 5 kategori kas lintas-modul (piutang/hutang/pembelian/modal/biaya) untuk
// sesi kas yang sedang berjalan.
// ─────────────────────────────────────────────────────────────────────────────
import { formatRupiah, formatDateTime } from "../../../utils/format";

export default function CashShiftSummary({ shift }) {
  const s = shift;
  return (
    <>
      <div className="mutation-summary mb-4">
        <div className="mutation-summary__card">
          <div className="mutation-summary__label">Modal Awal</div>
          <div className="mutation-summary__value">{formatRupiah(s.opening_balance)}</div>
          <div className="mutation-summary__sub">Dibuka {formatDateTime(s.opened_at)}</div>
        </div>
        <div className="mutation-summary__card">
          <div className="mutation-summary__label">Total Penjualan Tunai</div>
          <div className="mutation-summary__value">{formatRupiah(s.total_cash_sales)}</div>
        </div>
        <div className="mutation-summary__card">
          <div className="mutation-summary__label">Total Kas Masuk</div>
          <div className="mutation-summary__value text-positive">+{formatRupiah(s.total_cash_in)}</div>
        </div>
        <div className="mutation-summary__card">
          <div className="mutation-summary__label">Total Kas Keluar</div>
          <div className="mutation-summary__value text-negative">-{formatRupiah(s.total_cash_out)}</div>
        </div>
        {/* FIX (revisi dosen #17): 5 kategori kas yang sebelumnya diabaikan
            di perhitungan tutup kas — sekarang ikut tampil di sini supaya
            kasir bisa lihat kenapa saldo sistem berubah walau dia sendiri
            tidak input apa-apa (mis. kasir lain bayar hutang tunai dari
            modul Hutang saat sesi kas ini masih terbuka). */}
        {Number(s.total_cash_receivable) > 0 && (
          <div className="mutation-summary__card">
            <div className="mutation-summary__label">Pembayaran Piutang Tunai</div>
            <div className="mutation-summary__value text-positive">+{formatRupiah(s.total_cash_receivable)}</div>
          </div>
        )}
        {Number(s.total_cash_capital_in) > 0 && (
          <div className="mutation-summary__card">
            <div className="mutation-summary__label">Setoran Modal Tunai</div>
            <div className="mutation-summary__value text-positive">+{formatRupiah(s.total_cash_capital_in)}</div>
          </div>
        )}
        {Number(s.total_cash_payable) > 0 && (
          <div className="mutation-summary__card">
            <div className="mutation-summary__label">Pembayaran Hutang Tunai</div>
            <div className="mutation-summary__value text-negative">-{formatRupiah(s.total_cash_payable)}</div>
          </div>
        )}
        {Number(s.total_cash_purchase) > 0 && (
          <div className="mutation-summary__card">
            <div className="mutation-summary__label">Pembelian Tunai</div>
            <div className="mutation-summary__value text-negative">-{formatRupiah(s.total_cash_purchase)}</div>
          </div>
        )}
        {Number(s.total_cash_capital_out) > 0 && (
          <div className="mutation-summary__card">
            <div className="mutation-summary__label">Prive (Penarikan Modal) Tunai</div>
            <div className="mutation-summary__value text-negative">-{formatRupiah(s.total_cash_capital_out)}</div>
          </div>
        )}
        {Number(s.total_cash_expense) > 0 && (
          <div className="mutation-summary__card">
            <div className="mutation-summary__label">Biaya Operasional</div>
            <div className="mutation-summary__value text-negative">-{formatRupiah(s.total_cash_expense)}</div>
          </div>
        )}
        <div className="mutation-summary__card">
          <div className="mutation-summary__label">Estimasi Saldo Kas Saat Ini</div>
          <div className="mutation-summary__value">{formatRupiah(s.expected_balance)}</div>
          <div className="mutation-summary__sub">Modal awal + penjualan tunai (termasuk DP Open Bill) + kas masuk + piutang tunai + setoran modal − kas keluar − hutang tunai − pembelian tunai − prive − biaya operasional</div>
        </div>
      </div>

      <div className="ui-alert-note">
        Catatan: saldo di atas sudah mencakup penjualan tunai, kas masuk/keluar manual sesi ini,
        DAN transaksi lain yang memakai laci kas yang sama selama sesi ini terbuka — pembayaran
        piutang/hutang tunai, pembelian tunai ke supplier, setoran/prive modal tunai, dan biaya
        operasional. Kalau kartu-kartu di atas tidak muncul, berarti memang belum ada transaksi
        dari kategori itu pada sesi ini.
      </div>
    </>
  );
}