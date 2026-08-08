// src/hooks/usePrinter.js
//
// Koneksi printer thermal RPP02N & sejenisnya via:
//   1. Serial (WebSerial)  ← UTAMA untuk Bluetooth Classic/SPP & USB-Serial
//   2. USB    (WebUSB)     ← untuk printer USB langsung
//
// CATATAN PENTING:
//   RPP02N pakai Bluetooth Classic (SPP) — BUKAN BLE.
//   Web Bluetooth API hanya support BLE, sehingga TIDAK bisa dipakai.
//   Setelah printer di-pair di Windows, Windows buat virtual COM port (mis. COM3/COM4).
//   COM port itulah yang diakses via WebSerial API.
//
// Syarat: Chrome/Edge, HTTPS atau localhost
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useCallback } from "react";

// ── ESC/POS builder ───────────────────────────────────────────────────────────
const ESC = 0x1b;
const GS = 0x1d;

function buildEscPos(lines) {
  const enc = new TextEncoder();
  const parts = [];

  parts.push(new Uint8Array([ESC, 0x40])); // init printer
  parts.push(new Uint8Array([ESC, 0x61, 0x01])); // align center

  for (const line of lines) {
    if (line === null) {
      parts.push(enc.encode("--------------------------------\n"));
      continue;
    }
    if (line.type === "title") {
      parts.push(new Uint8Array([ESC, 0x61, 0x01]));
      parts.push(new Uint8Array([GS, 0x21, 0x11])); // double size
      parts.push(enc.encode(line.text + "\n"));
      parts.push(new Uint8Array([GS, 0x21, 0x00])); // normal
      continue;
    }
    if (line.type === "center") {
      parts.push(new Uint8Array([ESC, 0x61, 0x01]));
      parts.push(enc.encode(line.text + "\n"));
      continue;
    }
    if (line.type === "left") {
      parts.push(new Uint8Array([ESC, 0x61, 0x00]));
      parts.push(enc.encode(line.text + "\n"));
      continue;
    }
    if (line.type === "row") {
      parts.push(new Uint8Array([ESC, 0x61, 0x00]));
      const maxWidth = 32;
      const left = String(line.left || "").slice(0, maxWidth - 10);
      const right = String(line.right || "");
      const pad = maxWidth - left.length - right.length;
      parts.push(
        enc.encode(left + " ".repeat(Math.max(1, pad)) + right + "\n"),
      );
      continue;
    }
    parts.push(new Uint8Array([ESC, 0x61, 0x00]));
    parts.push(enc.encode(String(line) + "\n"));
  }

  parts.push(enc.encode("\n\n\n"));
  parts.push(new Uint8Array([GS, 0x56, 0x41, 0x05])); // full cut

  const total = parts.reduce((s, a) => s + a.length, 0);
  const buf = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    buf.set(p, offset);
    offset += p.length;
  }
  return buf;
}

// ── Receipt lines builder ─────────────────────────────────────────────────────
export function buildReceiptLines(transaction, storeSettings = {}) {
  const fmt = (n) => "Rp " + Number(n || 0).toLocaleString("id-ID");
  const lines = [];

  lines.push({ type: "title", text: storeSettings.store_name || "TOKO" });
  if (storeSettings.store_address)
    lines.push({ type: "center", text: storeSettings.store_address });
  if (storeSettings.store_phone)
    lines.push({ type: "center", text: "Telp: " + storeSettings.store_phone });
  lines.push(null);

  const now = new Date();
  const p2 = (n) => String(n).padStart(2, "0");
  const tgl = `${p2(now.getDate())}/${p2(now.getMonth() + 1)}/${now.getFullYear()} ${p2(now.getHours())}:${p2(now.getMinutes())}`;

  lines.push({
    type: "left",
    text: "Kode : " + (transaction.transaction_code || "-"),
  });
  lines.push({
    type: "left",
    text: "Kasir: " + (transaction.cashier_name || "-"),
  });
  lines.push({ type: "left", text: "Tgl  : " + tgl });
  if (transaction.customer_name)
    lines.push({ type: "left", text: "Pelgn: " + transaction.customer_name });
  lines.push(null);

  (transaction.items || []).forEach((item) => {
    lines.push({ type: "left", text: item.product_name || item.name });
    lines.push({
      type: "row",
      left: `  ${item.quantity} x ${fmt(item.unit_price)}`,
      right: fmt(item.subtotal),
    });
  });

  lines.push(null);
  if (transaction.discount_amount > 0)
    lines.push({
      type: "row",
      left: "Diskon",
      right: "-" + fmt(transaction.discount_amount),
    });
  lines.push({
    type: "row",
    left: "TOTAL",
    right: fmt(transaction.final_amount),
  });
  lines.push({
    type: "row",
    left: "Bayar (" + (transaction.payment_method || "cash") + ")",
    right: fmt(transaction.payment_amount),
  });
  if (transaction.change_amount >= 0)
    lines.push({
      type: "row",
      left: "Kembali",
      right: fmt(transaction.change_amount),
    });
  lines.push(null);

  lines.push({
    type: "center",
    text:
      storeSettings.store_tagline ||
      storeSettings.receipt_footer ||
      "Terima kasih!",
  });
  return lines;
}

// ─────────────────────────────────────────────────────────────────────────────
//  HOOK UTAMA
// ─────────────────────────────────────────────────────────────────────────────
export function usePrinter() {
  const [status, setStatus] = useState("idle");
  const [printerType, setPrinterType] = useState(null); // 'serial' | 'usb'
  const [deviceName, setDeviceName] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const serialPortRef = useRef(null); // SerialPort object
  const serialWriteRef = useRef(null); // WritableStreamDefaultWriter
  const usbDeviceRef = useRef(null); // USBDevice object

  // Cek dukungan browser
  const isSerialSupported =
    typeof navigator !== "undefined" && !!navigator.serial;
  const isUsbSupported = typeof navigator !== "undefined" && !!navigator.usb;

  // ── Disconnect ─────────────────────────────────────────────────────────────
  const disconnect = useCallback(async () => {
    try {
      if (serialWriteRef.current) {
        await serialWriteRef.current.releaseLock();
        serialWriteRef.current = null;
      }
      if (serialPortRef.current) {
        await serialPortRef.current.close().catch(() => {});
        serialPortRef.current = null;
      }
      if (usbDeviceRef.current) {
        await usbDeviceRef.current.close().catch(() => {});
        usbDeviceRef.current = null;
      }
    } catch {}
    setStatus("idle");
    setPrinterType(null);
    setDeviceName(null);
    setErrorMsg(null);
  }, []);

  // ── Buka port serial yang sudah didapat (dari dialog ATAU dari izin lama) ──
  const openSerialPort = useCallback(async (port) => {
    await port.open({
      baudRate: 9600,
      dataBits: 8,
      stopBits: 1,
      parity: "none",
      flowControl: "none",
    });

    serialPortRef.current = port;

    const info = port.getInfo?.() || {};
    const name = info.usbProductId
      ? `USB Serial (${info.usbProductId.toString(16).toUpperCase()})`
      : "Bluetooth COM Port";

    setStatus("connected");
    setPrinterType("serial");
    setDeviceName(name);
  }, []);

  // ── Buka device USB yang sudah didapat (dari dialog ATAU dari izin lama) ──
  const openUsbDevice = useCallback(async (device) => {
    await device.open();
    if (device.configuration === null) await device.selectConfiguration(1);
    const iface = device.configuration?.interfaces?.[0];
    if (iface) await device.claimInterface(iface.interfaceNumber);

    usbDeviceRef.current = device;
    setStatus("connected");
    setPrinterType("usb");
    setDeviceName(
      device.productName ||
        `USB Printer (VID:${device.vendorId.toString(16).toUpperCase()})`,
    );
  }, []);

  // ── Auto-reconnect diam-diam ke printer yang PERNAH diizinkan ─────────────
  // Browser menyimpan izin akses port/device yang sudah pernah disetujui
  // pengguna. Fungsi ini mencoba menyambung ulang TANPA menampilkan dialog
  // pemilihan, supaya printer terasa "otomatis tersambung" tiap kali aplikasi
  // dibuka — asalkan printer sebelumnya sudah pernah dihubungkan lewat tombol
  // "Hubungkan" di halaman Pengaturan.
  const autoReconnect = useCallback(async () => {
    if (status === "connected" || status === "connecting") return false;
    setStatus("connecting");
    setErrorMsg(null);

    try {
      if (isSerialSupported) {
        const ports = await navigator.serial.getPorts();
        if (ports.length > 0) {
          try {
            await openSerialPort(ports[0]);
            return true;
          } catch {
            // lanjut coba USB di bawah
          }
        }
      }
      if (isUsbSupported) {
        const devices = await navigator.usb.getDevices();
        if (devices.length > 0) {
          try {
            await openUsbDevice(devices[0]);
            return true;
          } catch {
            // gagal juga, biarkan status idle
          }
        }
      }
    } catch {
      // abaikan — auto reconnect memang best-effort, tidak boleh mengganggu user
    }

    setStatus("idle");
    return false;
  }, [
    status,
    isSerialSupported,
    isUsbSupported,
    openSerialPort,
    openUsbDevice,
  ]);

  // ── Connect Serial (Bluetooth SPP / USB-Serial) ───────────────────────────
  //
  // Cara pakai:
  //   1. Pastikan printer sudah di-pair di Windows Settings > Bluetooth
  //   2. Windows otomatis buat virtual COM port (bisa cek di Device Manager)
  //   3. Klik "Hubungkan Serial (BT/COM)" di halaman Pengaturan
  //   4. Pilih COM port yang muncul di dialog (biasanya "Standard Serial over BT")
  //
  const connectSerial = useCallback(async () => {
    if (!isSerialSupported) {
      setStatus("unsupported");
      setErrorMsg(
        "Browser tidak mendukung Web Serial. Gunakan Chrome/Edge terbaru via HTTPS atau localhost.",
      );
      return false;
    }
    setStatus("connecting");
    setErrorMsg(null);

    let port;
    try {
      // Tampilkan dialog pilih COM port
      // Filter kosong = tampilkan semua port (termasuk Bluetooth COM & USB-Serial)
      port = await navigator.serial.requestPort({ filters: [] });
    } catch (err) {
      // User klik Cancel
      setStatus("idle");
      return false;
    }

    try {
      // Buka port dengan baud rate standar printer thermal
      // RPP02N default: 9600 bps. Beberapa printer pakai 38400 atau 115200.
      await openSerialPort(port);
      return true;
    } catch (err) {
      setStatus("error");
      setErrorMsg(
        err.message?.includes("Access denied") ||
          err.message?.includes("access")
          ? "Akses port ditolak. Port mungkin sedang dipakai aplikasi lain."
          : err.message?.includes("not open")
            ? "Port tidak bisa dibuka. Coba cabut-pasang kabel atau matikan-nyalakan printer."
            : `Gagal membuka port: ${err.message || "error tidak diketahui"}`,
      );
      return false;
    }
  }, [isSerialSupported, openSerialPort]);

  // ── Connect USB (WebUSB) ───────────────────────────────────────────────────
  const connectUSB = useCallback(async () => {
    if (!isUsbSupported) {
      setStatus("unsupported");
      setErrorMsg(
        "Browser tidak mendukung WebUSB. Gunakan Chrome/Edge via HTTPS atau localhost.",
      );
      return false;
    }
    setStatus("connecting");
    setErrorMsg(null);
    try {
      const device = await navigator.usb.requestDevice({
        filters: [
          { vendorId: 0x04b8 }, // Epson
          { vendorId: 0x0519 }, // Star
          { vendorId: 0x0dd4 }, // Custom
          { vendorId: 0x154f }, // SNBC
          { vendorId: 0x20d1 }, // Zjiang
          { vendorId: 0x1fc9 }, // Goojprt/XP
          { vendorId: 0x0483 }, // STMicro
          { vendorId: 0x4b43 }, // Rongta
          { vendorId: 0x28e9 }, // Rongta alt
        ],
      });

      await openUsbDevice(device);
      return true;
    } catch (err) {
      const msg =
        err.name === "NotFoundError"
          ? "Tidak ada printer USB dipilih."
          : err.name === "SecurityError"
            ? "Akses USB ditolak. Pastikan halaman di HTTPS atau localhost."
            : err.message || "Gagal terhubung via USB.";
      setStatus("error");
      setErrorMsg(msg);
      return false;
    }
  }, [isUsbSupported, openUsbDevice]);

  // ── Print ──────────────────────────────────────────────────────────────────
  const print = useCallback(
    async (transaction, storeSettings) => {
      if (status !== "connected") return false;

      const lines = buildReceiptLines(transaction, storeSettings);
      const buffer = buildEscPos(lines);

      try {
        // ── Serial (Bluetooth SPP / USB-COM) ──
        if (printerType === "serial" && serialPortRef.current) {
          const writer = serialPortRef.current.writable.getWriter();
          serialWriteRef.current = writer;
          try {
            // Kirim dalam chunk 64 byte — aman untuk COM port Bluetooth
            const CHUNK = 64;
            for (let i = 0; i < buffer.length; i += CHUNK) {
              await writer.write(buffer.slice(i, i + CHUNK));
              await new Promise((r) => setTimeout(r, 20));
            }
          } finally {
            writer.releaseLock();
            serialWriteRef.current = null;
          }
          return true;
        }

        // ── USB ──
        if (printerType === "usb" && usbDeviceRef.current) {
          const dev = usbDeviceRef.current;
          const ep =
            dev.configuration?.interfaces?.[0]?.alternates?.[0]?.endpoints?.find(
              (e) => e.direction === "out",
            );
          if (!ep) throw new Error("USB endpoint OUT tidak ditemukan");
          await dev.transferOut(ep.endpointNumber, buffer);
          return true;
        }

        return false;
      } catch (err) {
        setStatus("error");
        setErrorMsg(
          "Gagal mencetak: " + (err.message || "error tidak diketahui"),
        );
        return false;
      }
    },
    [status, printerType],
  );

  return {
    status, // 'idle' | 'connecting' | 'connected' | 'error' | 'unsupported'
    printerType, // 'serial' | 'usb' | null
    deviceName,
    errorMsg,
    isSerialSupported,
    isUsbSupported,
    connectSerial,
    connectUSB,
    disconnect,
    print,
    autoReconnect,
  };
}
