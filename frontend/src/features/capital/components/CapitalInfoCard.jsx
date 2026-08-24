// src/features/capital/components/CapitalInfoCard.jsx
// ─────────────────────────────────────────────────────────────────────────────
// PRESENTATION — Kartu statis penjelasan bagaimana "Ekuitas Saat Ini" dihitung
// & apa yang tidak termasuk di dalamnya (pinjaman/utang).
// ─────────────────────────────────────────────────────────────────────────────
export default function CapitalInfoCard() {
  return (
    <div className="card">
      <div className="chart-card__title">Tentang Perhitungan Ini</div>
      <div className="text-sm text-muted">
        Ekuitas Saat Ini dihitung otomatis dari Neraca Saldo (saldo akun Modal Pemilik &amp; Prive, ditambah
        laba/rugi kumulatif dari seluruh transaksi penjualan, HPP, dan biaya operasional). Setiap pembelian
        stok, penjualan, atau biaya yang tercatat di sistem akan langsung mempengaruhi angka ini lewat jurnal
        otomatis — jadi kenaikan atau penurunan modal selalu mencerminkan kondisi terkini. Detail jurnalnya
        bisa dilihat di menu Jurnal Akuntansi. Catatan: pinjaman bank/utang lainnya TIDAK dihitung di sini —
        itu kewajiban, bukan modal, dan tercatat lewat menu Utang.
      </div>
    </div>
  );
}