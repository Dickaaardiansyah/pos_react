// src/features/cashier/components/BarcodeScanner.jsx
import { ScanBarcode } from "lucide-react";

export default function BarcodeScanner({ inputRef, value, onChange, onSubmit }) {
  return (
    <form onSubmit={onSubmit} className="mb-4">
      <div className="flex items-center gap-2">
        <ScanBarcode size={20} className="text-muted" />
        <input
          ref={inputRef}
          className="barcode-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Scan atau ketik barcode produk..."
          autoFocus
        />
      </div>
    </form>
  );
}
