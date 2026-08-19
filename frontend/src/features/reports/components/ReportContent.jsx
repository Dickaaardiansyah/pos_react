// src/features/reports/components/ReportContent.jsx
import { SalesDailyContent } from "../penjualan/SalesDailyReport";
import { SalesPeriodContent } from "../penjualan/SalesPeriodReport";
import { SalesContent } from "../penjualan/SalesReport";
import { SalesByCustomerContent } from "../penjualan/SalesByCustomerReport";
import { ProductProfitContent } from "../penjualan/ProductProfitReport";
import { PaymentMethodContent } from "../penjualan/PaymentMethodReport";
import { VoidReportContent } from "../penjualan/VoidReport";
import { CashReportContent } from "../kas/CashReport";
import { CashFlowContent } from "../kas/CashFlowReport";
import { ShiftReportContent } from "../kas/ShiftReport";
import { StockInContent } from "../produk/StockInReport";
import { StockOutContent } from "../produk/StockOutReport";
import { StockOpnameContent } from "../produk/StockOpnameReport";
import { ExpiredStockContent } from "../produk/ExpiredStockReport";
import { PurchaseReportContent } from "../pembelian/PurchaseReport";
import { PurchaseBySupplierContent } from "../pembelian/PurchaseBySupplierReport";
import { PayableReportContent } from "../pembelian/PayableReport";
import { UnpaidInvoicesContent } from "../piutang/UnpaidInvoicesReport";
import { UnpaidByCustomerContent } from "../piutang/UnpaidByCustomerReport";
import { AgingContent } from "../piutang/AgingReport";
import { HistoryContent } from "../piutang/HistoryReport";

const CONTENT_BY_TYPE = {
  penjualanHarian: SalesDailyContent,
  penjualanPeriode: SalesPeriodContent,
  penjualan: SalesContent,
  penjualanPelanggan: SalesByCustomerContent,
  labaProduk: ProductProfitContent,
  metodePembayaran: PaymentMethodContent,
  transaksiVoid: VoidReportContent,
  kasMasukKeluar: CashReportContent,
  cashFlow: CashFlowContent,
  shiftKasir: ShiftReportContent,
  barangMasuk: StockInContent,
  barangKeluar: StockOutContent,
  stockOpname: StockOpnameContent,
  barangExpired: ExpiredStockContent,
  pembelian: PurchaseReportContent,
  pembelianSupplier: PurchaseBySupplierContent,
  hutangSupplier: PayableReportContent,
  piutangFakturBelumLunas: UnpaidInvoicesContent,
  piutangPerPelanggan: UnpaidByCustomerContent,
  piutangAging: AgingContent,
  piutangRiwayat: HistoryContent,
};

export default function ReportContent({ r }) {
  const Content = CONTENT_BY_TYPE[r.reportType];
  if (!Content) return null;
  return <Content r={r} />;
}
