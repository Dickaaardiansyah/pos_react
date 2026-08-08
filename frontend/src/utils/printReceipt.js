// src/utils/printReceipt.js
//
// Logika cetak struk yang dipakai bersama oleh halaman Kasir (setelah bayar)
// dan halaman Riwayat Transaksi (cetak ulang struk lama). Jika printer thermal
// sedang tersambung, struk dikirim langsung ke printer (ESC/POS). Jika tidak,
// otomatis jatuh ke mode cetak lewat browser (dialog print).
import toast from "react-hot-toast";
import { generateReceiptHTML } from "./format";

export function printReceiptInBrowser(transaction, storeSettings) {
  const html = generateReceiptHTML(transaction, storeSettings);
  const win = window.open("", "_blank", "width=320,height=600");
  if (!win) {
    toast.error("Pop-up diblokir browser. Izinkan pop-up untuk mencetak.");
    return;
  }
  win.document.write(`
    <html><head><title>Struk</title>
    <style>body{margin:0;padding:10px;background:white;}@media print{body{margin:0;}}</style>
    </head><body>${html}
    <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),1000)}<\/script>
    </body></html>
  `);
}

// printer: object hasil usePrinter()/usePrinterContext()
export async function printReceiptSmart(transaction, storeSettings, printer) {
  if (printer?.status === "connected") {
    const ok = await printer.print(transaction, storeSettings);
    if (ok) {
      toast.success("Struk dikirim ke printer!");
      return;
    }
    toast.error("Gagal kirim ke printer, mencetak via browser...");
  }
  printReceiptInBrowser(transaction, storeSettings);
}
