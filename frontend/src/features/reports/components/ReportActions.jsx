// src/features/reports/components/ReportActions.jsx
import { Printer, FileSpreadsheet } from "lucide-react";
import { printTabularReport, exportTabularReportExcel } from "../../../utils/printLaporan";
import { buildSalesDailyExportPayload } from "../penjualan/SalesDailyReport";
import { buildSalesPeriodExportPayload } from "../penjualan/SalesPeriodReport";
import { buildSalesExportPayload } from "../penjualan/SalesReport";
import { buildSalesByCustomerExportPayload } from "../penjualan/SalesByCustomerReport";
import { buildProductProfitExportPayload } from "../penjualan/ProductProfitReport";
import { buildPaymentMethodExportPayload } from "../penjualan/PaymentMethodReport";
import { buildVoidReportExportPayload } from "../penjualan/VoidReport";
import { buildCashReportExportPayload } from "../kas/CashReport";
import { buildCashFlowExportPayload } from "../kas/CashFlowReport";
import { buildShiftReportExportPayload } from "../kas/ShiftReport";
import { buildStockInExportPayload } from "../produk/StockInReport";
import { buildStockOutExportPayload } from "../produk/StockOutReport";
import { buildStockOpnameExportPayload } from "../produk/StockOpnameReport";
import { buildPurchaseReportExportPayload } from "../pembelian/PurchaseReport";
import { buildPurchaseBySupplierExportPayload } from "../pembelian/PurchaseBySupplierReport";
import { buildPayableReportExportPayload } from "../pembelian/PayableReport";
import { buildUnpaidInvoicesExportPayload } from "../piutang/UnpaidInvoicesReport";
import { buildUnpaidByCustomerExportPayload } from "../piutang/UnpaidByCustomerReport";
import { buildAgingExportPayload } from "../piutang/AgingReport";
import { buildHistoryExportPayload } from "../piutang/HistoryReport";

// barangExpired sengaja tidak ada di sini — laporan itu belum punya payload
// cetak/ekspor (sama seperti sebelum ReportsPage.jsx dipecah).
const PAYLOAD_BUILDERS = {
  penjualanHarian: buildSalesDailyExportPayload,
  penjualanPeriode: buildSalesPeriodExportPayload,
  penjualan: buildSalesExportPayload,
  penjualanPelanggan: buildSalesByCustomerExportPayload,
  labaProduk: buildProductProfitExportPayload,
  metodePembayaran: buildPaymentMethodExportPayload,
  transaksiVoid: buildVoidReportExportPayload,
  kasMasukKeluar: buildCashReportExportPayload,
  cashFlow: buildCashFlowExportPayload,
  shiftKasir: buildShiftReportExportPayload,
  barangMasuk: buildStockInExportPayload,
  barangKeluar: buildStockOutExportPayload,
  stockOpname: buildStockOpnameExportPayload,
  pembelian: buildPurchaseReportExportPayload,
  pembelianSupplier: buildPurchaseBySupplierExportPayload,
  hutangSupplier: buildPayableReportExportPayload,
  piutangFakturBelumLunas: buildUnpaidInvoicesExportPayload,
  piutangPerPelanggan: buildUnpaidByCustomerExportPayload,
  piutangAging: buildAgingExportPayload,
  piutangRiwayat: buildHistoryExportPayload,
};

function buildExportPayload(r) {
  const builder = PAYLOAD_BUILDERS[r.reportType];
  return builder ? builder(r) : null;
}

export default function ReportActions({ r }) {
  function handlePrint() {
    const payload = buildExportPayload(r);
    if (!payload || !payload.rows?.length) return;
    printTabularReport({ ...payload, storeSettings: r.storeSettings });
  }
  function handleExportExcel() {
    const payload = buildExportPayload(r);
    if (!payload || !payload.rows?.length) return;
    exportTabularReportExcel({
      ...payload,
      storeSettings: r.storeSettings,
      filename: `${payload.title.replace(/\s+/g, "_")}.xlsx`,
    });
  }
  const payload = buildExportPayload(r);
  const disabled = !payload || !payload.rows?.length;
  return (
    <div className="flex gap-2">
      <button className="btn btn-ghost btn-sm" onClick={handlePrint} disabled={disabled} title={disabled ? "Tidak ada data untuk dicetak" : undefined}>
        <Printer size={14} /> Cetak
      </button>
      <button className="btn btn-ghost btn-sm" onClick={handleExportExcel} disabled={disabled} title={disabled ? "Tidak ada data untuk diekspor" : undefined}>
        <FileSpreadsheet size={14} /> Export Excel
      </button>
    </div>
  );
}
