// src/features/reports/components/ReportPicker.jsx
import {
  TrendingUp, Receipt, Users, Wallet, ArrowUpCircle, Clock, Truck, PackageX,
  ClipboardList, ShoppingBag, CreditCard, History, Ban,
} from "lucide-react";

const REPORT_ICONS = {
  penjualanHarian: Receipt,
  penjualanPeriode: TrendingUp,
  penjualan: TrendingUp,
  penjualanPelanggan: Users,
  labaProduk: Wallet,
  kasMasukKeluar: ArrowUpCircle,
  cashFlow: Wallet,
  shiftKasir: Clock,
  barangMasuk: Truck,
  barangKeluar: PackageX,
  stockOpname: ClipboardList,
  barangExpired: PackageX,
  pembelian: ShoppingBag,
  pembelianSupplier: Users,
  hutangSupplier: CreditCard,
  piutangFakturBelumLunas: Receipt,
  piutangPerPelanggan: Users,
  piutangAging: Clock,
  piutangRiwayat: History,
  metodePembayaran: CreditCard,
  transaksiVoid: Ban,
};

const GROUP_LABELS = {
  penjualan: "Penjualan",
  kas: "Kas",
  produk: "Produk & Stok",
  pembelian: "Pembelian",
  piutang: "Piutang",
};

export default function ReportPicker({ reportTypes, onSelect }) {
  const groups = {};
  reportTypes.forEach((rt) => {
    const g = rt.group || "lain";
    if (!groups[g]) groups[g] = [];
    groups[g].push(rt);
  });

  return (
    <div>
      {Object.entries(groups).map(([group, items]) => (
        <div key={group} className="report-picker-group">
          <div className="report-picker-group__label">{GROUP_LABELS[group] || group}</div>
          <div className="report-picker">
            {items.map((rt) => {
              const Icon = REPORT_ICONS[rt.id] || TrendingUp;
              return (
                <button key={rt.id} className="report-picker__item" onClick={() => onSelect(rt.id)}>
                  <span className="report-picker__icon"><Icon size={22} /></span>
                  <span className="report-picker__text">
                    <span className="report-picker__title">{rt.title}</span>
                    <span className="report-picker__desc">{rt.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
