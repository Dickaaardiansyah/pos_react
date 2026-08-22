// src/utils/printBuktiHutang.js
// ─────────────────────────────────────────────────────────────────────────────
// Cetak "Bukti Hutang / Pembayaran Hutang" untuk satu faktur payables lewat
// window.print() (dialog cetak browser) — dipakai dari halaman Pembelian Dan
// Utang (menu Hutang), tombol "Cetak Bukti". Gaya mengikuti printLaporan.js
// (hitam-putih, siap cetak/PDF di kertas kecil/A5) supaya konsisten dengan
// dokumen cetak lain di aplikasi.
// ─────────────────────────────────────────────────────────────────────────────
import { formatRupiah, formatDate, formatDateTime, escapeHtml } from "./format";

const STATUS_LABEL = {
  belum_lunas: "BELUM LUNAS",
  sebagian: "DIBAYAR SEBAGIAN",
  lunas: "LUNAS",
};

function css() {
  return `
    @page { size: A5; margin: 12mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #000; background: #fff; margin: 0; padding: 16px; font-size: 12px; }
    .bh-header { text-align: center; margin-bottom: 10px; }
    .bh-store { font-size: 16px; font-weight: 700; }
    .bh-address { font-size: 10.5px; color: #333; margin-top: 2px; }
    .bh-title { font-size: 14px; font-weight: 700; margin-top: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
    .bh-status { display: inline-block; margin-top: 4px; padding: 2px 10px; border: 1.5px solid #000; font-weight: 700; font-size: 11px; letter-spacing: 0.5px; }
    .bh-divider { border: none; border-top: 1.5px solid #000; margin: 10px 0; }
    .bh-row { display: flex; justify-content: space-between; font-size: 12px; padding: 2px 0; }
    .bh-row b { text-align: right; }
    table.bh-table { width: 100%; border-collapse: collapse; margin-top: 6px; }
    table.bh-table th { padding: 4px; font-size: 11px; text-align: right; border-bottom: 1.5px solid #000; font-weight: 700; }
    table.bh-table th:first-child, table.bh-table th:nth-child(2) { text-align: left; }
    table.bh-table td { padding: 4px; font-size: 11.5px; border-bottom: 1px solid #ddd; text-align: right; }
    table.bh-table td:first-child, table.bh-table td:nth-child(2) { text-align: left; }
    .bh-total { display: flex; justify-content: space-between; font-weight: 700; font-size: 13px; margin-top: 8px; padding-top: 6px; border-top: 1.5px solid #000; }
    .bh-section-title { font-weight: 700; font-size: 12px; margin: 12px 0 4px; }
    .bh-signature { display: flex; justify-content: space-between; margin-top: 36px; font-size: 11px; text-align: center; }
    .bh-signature div { width: 45%; }
    .bh-signature .line { margin-top: 44px; border-top: 1px solid #000; padding-top: 4px; }
    .bh-footer { margin-top: 18px; font-size: 9.5px; color: #555; text-align: center; }
    @media print { .bh-noprint { display: none; } }
  `;
}

/**
 * payable: hasil payableModel.getById() → { invoice_code, supplier_name,
 *   invoice_date, due_date, amount, paid_amount, status, notes, items?, payments? }
 * storeSettings: { store_name, store_address }
 */
export function printBuktiHutang(payable, storeSettings = {}) {
  const storeName = storeSettings?.store_name || "Toko Saya";
  const storeAddress = storeSettings?.store_address || "";
  const sisa = Number(payable.amount) - Number(payable.paid_amount);
  const printedAt = formatDateTime(
    new Date().toISOString().slice(0, 19).replace("T", " "),
  );

  const itemsHTML =
    payable.items && payable.items.length > 0
      ? `
        <div class="bh-section-title">Daftar Barang (Pembelian)</div>
        <table class="bh-table">
          <thead><tr><th>Produk</th><th>Qty</th><th>Harga</th><th>Subtotal</th></tr></thead>
          <tbody>
            ${payable.items
              .map(
                (it) => `
              <tr>
                <td>${escapeHtml(it.product_name)}${it.unit ? ` (${escapeHtml(it.unit)})` : ""}</td>
                <td>${escapeHtml(it.quantity)}</td>
                <td>${escapeHtml(formatRupiah(it.unit_cost))}</td>
                <td>${escapeHtml(formatRupiah(it.subtotal_cost))}</td>
              </tr>`,
              )
              .join("")}
          </tbody>
        </table>`
      : "";

  const paymentsHTML =
    payable.payments && payable.payments.length > 0
      ? `
        <div class="bh-section-title">Riwayat Pembayaran</div>
        <table class="bh-table">
          <thead><tr><th>Tanggal</th><th>Metode</th><th>Jumlah</th></tr></thead>
          <tbody>
            ${payable.payments
              .map(
                (p) => `
              <tr>
                <td>${escapeHtml(formatDate(p.payment_date))}</td>
                <td>${escapeHtml(p.payment_method)}</td>
                <td>${escapeHtml(formatRupiah(p.amount))}</td>
              </tr>`,
              )
              .join("")}
          </tbody>
        </table>`
      : `<p style="font-size:11px;color:#555;margin-top:8px;">Belum ada pembayaran tercatat untuk faktur ini.</p>`;

  const html = `
    <html>
    <head>
      <title>Bukti Hutang ${escapeHtml(payable.invoice_code)} - ${escapeHtml(storeName)}</title>
      <meta charset="utf-8" />
      <style>${css()}</style>
    </head>
    <body>
      <div class="bh-header">
        <div class="bh-store">${escapeHtml(storeName)}</div>
        ${storeAddress ? `<div class="bh-address">${escapeHtml(storeAddress)}</div>` : ""}
        <div class="bh-title">Bukti Hutang Supplier</div>
        <div class="bh-status">${escapeHtml(STATUS_LABEL[payable.status] || payable.status)}</div>
      </div>
      <hr class="bh-divider" />

      <div class="bh-row"><span>No. Faktur</span><b>${escapeHtml(payable.invoice_code)}</b></div>
      <div class="bh-row"><span>Pemasok</span><b>${escapeHtml(payable.supplier_name)}</b></div>
      <div class="bh-row"><span>Tanggal Faktur</span><b>${escapeHtml(formatDate(payable.invoice_date))}</b></div>
      <div class="bh-row"><span>Jatuh Tempo</span><b>${escapeHtml(formatDate(payable.due_date))}</b></div>
      ${payable.notes ? `<div class="bh-row"><span>Catatan</span><b>${escapeHtml(payable.notes)}</b></div>` : ""}

      ${itemsHTML}

      <div class="bh-row" style="margin-top:8px;"><span>Total Tagihan</span><b>${escapeHtml(formatRupiah(payable.amount))}</b></div>
      <div class="bh-row"><span>Sudah Dibayar</span><b>${escapeHtml(formatRupiah(payable.paid_amount))}</b></div>
      <div class="bh-total"><span>Sisa Hutang</span><span>${escapeHtml(formatRupiah(sisa))}</span></div>

      ${paymentsHTML}

      <div class="bh-signature">
        <div><div class="line">Pemasok</div></div>
        <div><div class="line">${escapeHtml(storeName)}</div></div>
      </div>

      <div class="bh-footer">Dicetak: ${escapeHtml(printedAt)} — Sistem POS</div>
      <script>window.onload = () => { window.print(); }<\/script>
    </body>
    </html>
  `;

  const win = window.open("", "_blank", "width=480,height=720");
  if (!win) return false;
  win.document.write(html);
  win.document.close();
  return true;
}
