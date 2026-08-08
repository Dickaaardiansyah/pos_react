// src/context/PrinterContext.jsx
//
// Menyediakan SATU instance printer (usePrinter) untuk seluruh aplikasi.
//
// Sebelumnya setiap halaman (Kasir, dst.) memanggil usePrinter() sendiri-
// sendiri, sehingga status "connected" di satu halaman tidak terbawa ke
// halaman lain — padahal secara fisik printernya sama. Dengan context ini,
// begitu printer dihubungkan sekali (mis. dari halaman Pengaturan), status
// tersambungnya ikut terlihat di halaman Kasir maupun Riwayat Transaksi.
//
// Selain itu, saat aplikasi pertama kali dibuka, context ini mencoba
// menyambung ulang secara diam-diam (tanpa dialog) ke printer yang PERNAH
// diberi izin sebelumnya — sehingga terasa "otomatis tersambung" tiap kali
// dibuka, selama browser & printer tidak berubah.
import { createContext, useContext, useEffect, useRef } from "react";
import { usePrinter } from "../hooks/usePrinter";

const PrinterContext = createContext(null);

export function PrinterProvider({ children }) {
  const printer = usePrinter();
  const triedAutoReconnect = useRef(false);

  useEffect(() => {
    if (triedAutoReconnect.current) return;
    triedAutoReconnect.current = true;
    // Best-effort: tidak menampilkan dialog, tidak mengganggu jika gagal.
    printer.autoReconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <PrinterContext.Provider value={printer}>
      {children}
    </PrinterContext.Provider>
  );
}

export function usePrinterContext() {
  const ctx = useContext(PrinterContext);
  if (!ctx) {
    throw new Error("usePrinterContext harus dipakai di dalam <PrinterProvider>");
  }
  return ctx;
}