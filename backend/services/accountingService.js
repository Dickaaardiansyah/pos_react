// services/accountingService.js
// ─────────────────────────────────────────────────────────────────────────────
// SERVICE LAYER — modul akuntansi baru.
//
// Menyusun Laporan Laba Rugi (Income Statement) lengkap dengan HPP (COGS),
// biaya operasional, laba kotor, laba operasional, pajak, laba bersih, serta
// rasio-rasio keuangan lanjutan (margin, rasio biaya, perputaran persediaan,
// dan estimasi titik impas / break-even point).
// ─────────────────────────────────────────────────────────────────────────────
const accountingModel = require("../models/accountingModel");
const transactionModel = require("../models/transactionModel");
const productModel = require("../models/productModel");
const settingModel = require("../models/settingModel");
const journalModel = require("../models/journalModel");
const { ValidationError, NotFoundError } = require("./productService");
const { defaultDateRange } = require("./transactionService");

// ─── Kode akun Pendapatan & Beban dipakai menyusun Laporan Laba Rugi dari
// saldo jurnal (chart_of_accounts). HARUS tetap sinkron dengan kode akun
// sistem di services/journalService.js (ACC & EXPENSE_CATEGORY_ACCOUNT) —
// kalau kode akun di sana berubah, ubah juga di sini.
const ACC_SALES = "4100"; // Penjualan
const ACC_SALES_DISCOUNT = "4200"; // Diskon Penjualan (kontra pendapatan)
const ACC_OTHER_INCOME = "4900"; // Pendapatan Lain-lain
const ACC_COGS = "5100"; // Harga Pokok Penjualan (HPP)

// Kategori biaya operasional (dipilih user lewat modul Biaya Operasional) →
// kode akun beban yang sesuai. 1:1 dengan EXPENSE_CATEGORY_ACCOUNT di
// journalService.js, karena setiap biaya operasional yang dicatat lewat
// accountingModel.createExpense() auto-posting ke salah satu akun ini.
const CATEGORY_ACCOUNT_CODE = {
  sewa: "5210",
  gaji: "5220",
  listrik_air: "5230",
  pemasaran: "5240",
  transportasi: "5250",
  perawatan: "5260",
  administrasi: "5270",
  lainnya: "5280",
};
const OPERATING_EXPENSE_CODES = Object.values(CATEGORY_ACCOUNT_CODE);

// Akun beban dari posting otomatis di luar biaya operasional toko sehari-
// hari (kas kecil insidental, bunga pinjaman, selisih kas/stok) — masuk
// golongan Beban Non Operasional, bukan Beban Operasional.
const NON_OPERATING_EXPENSE_CODES = ["5310", "5320", "5900", "5910"];

// Saldo satu baris hasil journalModel.incomeStatementAccountBalances(),
// dihitung sesuai posisi saldo normal akunnya (debit atau kredit).
function accountBalance(row) {
  if (!row) return 0;
  const debit = Number(row.total_debit || 0);
  const credit = Number(row.total_credit || 0);
  return row.normal_balance === "debit" ? debit - credit : credit - debit;
}

const EXPENSE_CATEGORIES = [
  { id: "sewa", label: "Sewa Tempat" },
  { id: "gaji", label: "Gaji Karyawan" },
  { id: "listrik_air", label: "Listrik & Air" },
  { id: "pemasaran", label: "Pemasaran/Promosi" },
  { id: "transportasi", label: "Transportasi/Logistik" },
  { id: "perawatan", label: "Perawatan & Perbaikan" },
  { id: "administrasi", label: "Administrasi & ATK" },
  { id: "lainnya", label: "Lainnya" },
];

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function percentage(part, whole) {
  const w = Number(whole) || 0;
  if (w === 0) return 0;
  return round2((Number(part) / w) * 100);
}

const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const QUARTER_DEFS = [
  { label: "Kuartal 1", startMonth: 0, endMonth: 2 },
  { label: "Kuartal 2", startMonth: 3, endMonth: 5 },
  { label: "Kuartal 3", startMonth: 6, endMonth: 8 },
  { label: "Kuartal 4", startMonth: 9, endMonth: 11 },
];

function pad2(n) {
  return String(n).padStart(2, "0");
}
function isoDate(y, m, d) {
  return `${y}-${pad2(m + 1)}-${pad2(d)}`;
}
function lastDayOfMonth(y, m) {
  return new Date(y, m + 1, 0).getDate();
}

// Ringkasan baris utama sebuah laporan laba rugi — dipakai untuk laporan
// multi-kolom (multi year, kuartal, multi periode, perbandingan periode)
// di mana rincian per kategori biaya tidak ditampilkan, hanya totalnya.
function toSummary(st) {
  return {
    gross_sales: st.revenue.gross_sales,
    net_sales: st.revenue.net_sales,
    total_cogs: st.cost_of_goods_sold.total_cogs,
    units_sold: st.cost_of_goods_sold.units_sold,
    gross_profit: st.gross_profit,
    operating_expenses_total: st.operating_expenses.total,
    operating_profit: st.operating_profit,
    non_operational_revenue: st.non_operational.revenue.total,
    non_operational_expense: st.non_operational.expense.total,
    non_operational_net: st.non_operational.net,
    net_profit: st.net_profit,
  };
}

function sumSummaries(summaries) {
  const keys = [
    "gross_sales",
    "net_sales",
    "total_cogs",
    "units_sold",
    "gross_profit",
    "operating_expenses_total",
    "operating_profit",
    "non_operational_revenue",
    "non_operational_expense",
    "non_operational_net",
    "net_profit",
  ];
  const total = {};
  keys.forEach((k) => {
    total[k] = round2(summaries.reduce((s, x) => s + Number(x[k] || 0), 0));
  });
  return total;
}

function splitIntoCalendarMonths(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const months = [];
  let cur = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cur <= end) {
    const y = cur.getFullYear();
    const m = cur.getMonth();
    const rangeStart = cur > start ? isoDate(y, m, 1) : startDate;
    const monthEndDay = lastDayOfMonth(y, m);
    const monthEndDate = new Date(y, m, monthEndDay);
    const rangeEnd = monthEndDate < end ? isoDate(y, m, monthEndDay) : endDate;
    months.push({
      label: `${MONTH_NAMES[m]} ${y}`,
      startDate: rangeStart,
      endDate: rangeEnd,
    });
    cur = new Date(y, m + 1, 1);
  }
  return months;
}

function variance(current, previous) {
  const diff = round2(Number(current || 0) - Number(previous || 0));
  const pct = previous
    ? round2((diff / Math.abs(previous)) * 100)
    : current
      ? 100
      : 0;
  return { diff, pct };
}

async function readTaxSettings() {
  const rows = await settingModel.findAllSettings();
  const map = {};
  rows.forEach((r) => {
    map[r.key] = r.value;
  });
  return {
    enabled: map.tax_enabled === "true",
    rate: parseFloat(map.tax_rate || "0") || 0,
  };
}

const accountingService = {
  expenseCategories() {
    return EXPENSE_CATEGORIES;
  },

  listExpenses(filters) {
    return accountingModel.findExpenses(filters);
  },

  // `user` = req.user (hasil verifikasi JWT). recorded_by SELALU diambil
  // dari sini, TIDAK PERNAH dari payload — supaya kasir/admin tidak bisa
  // memalsukan identitas pencatat biaya (mis. mengirim recorded_by:
  // "Administrator" lewat body request).
  async createExpense(payload, user) {
    const { expense_date, category, description, amount } = payload;
    if (!expense_date || !category || !amount) {
      throw new ValidationError(
        "Tanggal, kategori, dan jumlah biaya wajib diisi",
      );
    }
    if (Number(amount) <= 0)
      throw new ValidationError("Jumlah biaya harus lebih dari 0");

    // Insert biaya + posting jurnal terjadi dalam SATU DB transaction di
    // accountingModel.createExpense — kalau jurnal gagal, biaya ini ikut
    // rollback (tidak lagi best-effort).
    const expense = await accountingModel.createExpense({
      expenseDate: expense_date,
      category,
      description,
      amount,
      recordedBy: user?.name || "Admin",
    });

    return expense;
  },

  async updateExpense(id, payload) {
    const existing = await accountingModel.findExpenseById(id);
    if (!existing) throw new NotFoundError("Data biaya tidak ditemukan");
    await accountingModel.updateExpense(id, existing, {
      expenseDate: payload.expense_date,
      category: payload.category,
      description: payload.description,
      amount: payload.amount,
    });
    return accountingModel.findExpenseById(id);
  },

  async deleteExpense(id) {
    const existing = await accountingModel.findExpenseById(id);
    if (!existing) throw new NotFoundError("Data biaya tidak ditemukan");
    await accountingModel.deleteExpense(id, existing);
  },

  /**
   * Menyusun Laporan Laba Rugi (Income Statement) untuk satu periode —
   * SELURUH angka moneter (pendapatan, HPP, beban) diambil dari saldo akun
   * jurnal (journal_entry_lines, lihat journalModel.incomeStatementAccountBalances),
   * bukan dihitung ulang dari tabel transactions/expenses secara terpisah.
   * Ini membuat Laba Rugi otomatis konsisten dengan Neraca Saldo & Buku Besar,
   * dan otomatis ikut mencatat jurnal manual/penyesuaian yang menyentuh akun
   * Pendapatan/Beban (mis. akrual gaji) — yang sebelumnya tidak pernah
   * kelihatan kalau dihitung langsung dari tabel transaksi.
   *
   *   Penjualan Kotor (akun 4100) − Diskon Penjualan (akun 4200)
   *   = Pendapatan Bersih (Net Sales)
   *   (–) Harga Pokok Penjualan (akun 5100)
   *   = Laba Kotor (Gross Profit)
   *   (–) Beban Operasional (akun 5210–5280)
   *   = Laba Operasional (Operating Profit / EBIT)
   *   (+/–) Pendapatan & Beban Non Operasional (akun 4900, 5310/5320/5900/5910)
   *   = Laba Sebelum Pajak
   *   (–) Pajak Penghasilan (× tarif pajak, jika aktif)
   *   = Laba Bersih (Net Profit)
   *
   * Satuan non-moneter (jumlah transaksi, unit terjual) tetap diambil dari
   * tabel transaksi karena jurnal tidak menyimpan kuantitas — hanya dipakai
   * sebagai keterangan tambahan di laporan, bukan dasar perhitungan laba.
   */
  async incomeStatement({ start_date, end_date }) {
    const { startDate, endDate } = defaultDateRange(start_date, end_date);

    const [accountRows, salesSummary, cogsMeta, inventory, tax] =
      await Promise.all([
        journalModel.incomeStatementAccountBalances(startDate, endDate),
        transactionModel.salesSummary(startDate, endDate),
        transactionModel.costOfGoodsSold(startDate, endDate),
        productModel.sumInventoryValue(),
        readTaxSettings(),
      ]);

    const byCode = {};
    accountRows.forEach((r) => {
      byCode[r.account_code] = r;
    });
    const balanceOf = (code) => accountBalance(byCode[code]);

    // ── Pendapatan ─────────────────────────────────────────────────────────
    const grossSales = balanceOf(ACC_SALES);
    const totalDiscount = balanceOf(ACC_SALES_DISCOUNT);
    const netSales = round2(grossSales - totalDiscount);

    // ── Harga Pokok Penjualan & Laba Kotor ────────────────────────────────
    const cogs = balanceOf(ACC_COGS);
    const grossProfit = round2(netSales - cogs);

    // ── Beban Operasional (per kategori, langsung dari akun jurnal) ───────
    const expensesByCategory = EXPENSE_CATEGORIES.map((cat) => ({
      category: cat.label,
      total: round2(balanceOf(CATEGORY_ACCOUNT_CODE[cat.id])),
    })).filter((e) => e.total !== 0);
    const operatingExpenses = round2(
      OPERATING_EXPENSE_CODES.reduce((s, code) => s + balanceOf(code), 0),
    );
    const operatingProfit = round2(grossProfit - operatingExpenses);

    // ── Pendapatan & Beban Non Operasional ────────────────────────────────
    const nonOperatingRevenue = round2(balanceOf(ACC_OTHER_INCOME));
    const nonOperatingExpense = round2(
      NON_OPERATING_EXPENSE_CODES.reduce((s, code) => s + balanceOf(code), 0),
    );
    const nonOperatingNet = round2(nonOperatingRevenue - nonOperatingExpense);

    const profitBeforeTax = round2(operatingProfit + nonOperatingNet);

    const taxRate = tax.enabled ? tax.rate : 0;
    const taxAmount =
      profitBeforeTax > 0 ? round2(profitBeforeTax * (taxRate / 100)) : 0;
    const netProfit = round2(profitBeforeTax - taxAmount);

    // ── Rasio & analisis lanjutan ──────────────────────────────────────────
    const grossProfitMarginPct = percentage(grossProfit, netSales);
    const operatingProfitMarginPct = percentage(operatingProfit, netSales);
    const netProfitMarginPct = percentage(netProfit, netSales);
    const cogsRatioPct = percentage(cogs, netSales);
    const operatingExpenseRatioPct = percentage(operatingExpenses, netSales);

    // Perputaran persediaan (Inventory Turnover) — mengukur berapa kali nilai
    // persediaan "berputar" menjadi penjualan selama periode berjalan.
    // Menggunakan nilai persediaan akhir (posisi saat ini) sebagai pendekatan
    // karena sistem tidak menyimpan snapshot nilai persediaan di awal periode.
    const endingInventoryAtCost = Number(
      inventory?.inventory_value_at_cost || 0,
    );
    const inventoryTurnoverRatio =
      endingInventoryAtCost > 0 ? round2(cogs / endingInventoryAtCost) : null;

    // Titik Impas (Break-Even Point) — pendekatan sederhana dengan menganggap
    // seluruh beban operasional periode berjalan sebagai biaya tetap (fixed cost)
    // dan margin kontribusi = margin laba kotor.
    const contributionMarginRatio = netSales > 0 ? grossProfit / netSales : 0;
    const breakEvenRevenue =
      contributionMarginRatio > 0
        ? round2(operatingExpenses / contributionMarginRatio)
        : null;

    return {
      period: { startDate, endDate },
      revenue: {
        gross_sales: round2(grossSales),
        total_discount: round2(totalDiscount),
        net_sales: netSales,
        total_transactions: Number(salesSummary?.total_transactions || 0),
      },
      cost_of_goods_sold: {
        total_cogs: round2(cogs),
        units_sold: Number(cogsMeta?.total_units_sold || 0),
      },
      gross_profit: grossProfit,
      operating_expenses: {
        total: operatingExpenses,
        by_category: expensesByCategory,
      },
      operating_profit: operatingProfit,
      non_operational: {
        revenue: { total: nonOperatingRevenue },
        expense: { total: nonOperatingExpense },
        net: nonOperatingNet,
      },
      profit_before_tax: profitBeforeTax,
      tax: { enabled: tax.enabled, rate_percent: taxRate, amount: taxAmount },
      net_profit: netProfit,
      ratios: {
        gross_profit_margin_percent: grossProfitMarginPct,
        operating_profit_margin_percent: operatingProfitMarginPct,
        net_profit_margin_percent: netProfitMarginPct,
        cogs_ratio_percent: cogsRatioPct,
        operating_expense_ratio_percent: operatingExpenseRatioPct,
      },
      inventory: {
        ending_inventory_at_cost: round2(endingInventoryAtCost),
        ending_inventory_at_retail: round2(
          Number(inventory?.inventory_value_at_retail || 0),
        ),
        total_units_in_stock: Number(inventory?.total_units || 0),
        inventory_turnover_ratio: inventoryTurnoverRatio,
      },
      break_even_analysis: {
        contribution_margin_ratio_percent: round2(
          contributionMarginRatio * 100,
        ),
        estimated_break_even_revenue: breakEvenRevenue,
      },
    };
  },

  /**
   * Laba/Rugi (Multi Year) — ringkasan laba rugi per akhir tahun untuk
   * beberapa tahun terakhir sekaligus, plus kolom total keseluruhan.
   */
  async multiYearIncomeStatement({ years, end_year } = {}) {
    const span = Math.min(Math.max(parseInt(years, 10) || 3, 2), 5);
    const endYear = parseInt(end_year, 10) || new Date().getFullYear();
    const startYear = endYear - span + 1;

    const periods = [];
    for (let y = startYear; y <= endYear; y++) {
      const st = await this.incomeStatement({
        start_date: `${y}-01-01`,
        end_date: `${y}-12-31`,
      });
      periods.push({
        label: String(y),
        start_date: st.period.startDate,
        end_date: st.period.endDate,
        summary: toSummary(st),
      });
    }

    return {
      report_type: "multi_year",
      end_year: endYear,
      years: span,
      periods,
      total: sumSummaries(periods.map((p) => p.summary)),
    };
  },

  /**
   * Laba/Rugi (Kuartal) — ringkasan laba rugi per kuartal (Q1–Q4) untuk
   * satu tahun yang dipilih, plus kolom total setahun.
   */
  async quarterlyIncomeStatement({ year } = {}) {
    const y = parseInt(year, 10) || new Date().getFullYear();

    const periods = [];
    for (const q of QUARTER_DEFS) {
      const startDate = isoDate(y, q.startMonth, 1);
      const endDate = isoDate(y, q.endMonth, lastDayOfMonth(y, q.endMonth));
      const st = await this.incomeStatement({
        start_date: startDate,
        end_date: endDate,
      });
      periods.push({
        label: q.label,
        start_date: st.period.startDate,
        end_date: st.period.endDate,
        summary: toSummary(st),
      });
    }

    return {
      report_type: "quarterly",
      year: y,
      periods,
      total: sumSummaries(periods.map((p) => p.summary)),
    };
  },

  /**
   * Laba/Rugi (Multi Periode) — ringkasan laba rugi bulanan untuk setiap
   * bulan kalender dalam rentang tanggal yang dipilih, plus kolom total.
   */
  async multiPeriodIncomeStatement({ start_date, end_date } = {}) {
    const { startDate, endDate } = defaultDateRange(start_date, end_date);
    const months = splitIntoCalendarMonths(startDate, endDate);
    if (months.length > 24)
      throw new ValidationError(
        "Rentang periode terlalu panjang, maksimal 24 bulan",
      );

    const periods = [];
    for (const m of months) {
      const st = await this.incomeStatement({
        start_date: m.startDate,
        end_date: m.endDate,
      });
      periods.push({
        label: m.label,
        start_date: st.period.startDate,
        end_date: st.period.endDate,
        summary: toSummary(st),
      });
    }

    return {
      report_type: "multi_period",
      period: { startDate, endDate },
      periods,
      total: sumSummaries(periods.map((p) => p.summary)),
    };
  },

  /**
   * Laba/Rugi (Perbandingan Periode) — membandingkan dua periode bebas,
   * menampilkan selisih (variance) dan persentase perubahan tiap baris.
   */
  async comparisonIncomeStatement({
    period1_start,
    period1_end,
    period2_start,
    period2_end,
  } = {}) {
    if (!period1_start || !period1_end || !period2_start || !period2_end) {
      throw new ValidationError("Kedua periode pembanding wajib diisi lengkap");
    }

    const [st1, st2] = await Promise.all([
      this.incomeStatement({
        start_date: period1_start,
        end_date: period1_end,
      }),
      this.incomeStatement({
        start_date: period2_start,
        end_date: period2_end,
      }),
    ]);

    const formatLabel = (st) => {
      const d1 = st.period.startDate.split("-").reverse().join("-");
      const d2 = st.period.endDate.split("-").reverse().join("-");
      return `${d1} s/d ${d2}`;
    };

    const s1 = toSummary(st1);
    const s2 = toSummary(st2);
    const keys = Object.keys(s2);
    const varianceByKey = {};
    keys.forEach((k) => {
      varianceByKey[k] = variance(s2[k], s1[k]);
    });

    return {
      report_type: "comparison",
      period1: {
        label: formatLabel(st1),
        start_date: st1.period.startDate,
        end_date: st1.period.endDate,
        summary: s1,
      },
      period2: {
        label: formatLabel(st2),
        start_date: st2.period.startDate,
        end_date: st2.period.endDate,
        summary: s2,
      },
      variance: varianceByKey,
    };
  },

  async monthlyTrend() {
    const rows = await accountingModel.monthlyGrossProfitTrend();
    return rows.map((r) => {
      const revenue = Number(r.revenue || 0);
      const cogs = Number(r.cogs || 0);
      const grossProfit = revenue - cogs;
      return {
        month: r.month,
        revenue: round2(revenue),
        cogs: round2(cogs),
        gross_profit: round2(grossProfit),
        gross_profit_margin_percent: percentage(grossProfit, revenue),
      };
    });
  },
};

module.exports = accountingService;
