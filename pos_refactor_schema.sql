-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Aug 23, 2026 at 12:01 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `pos_refactor` (SCHEMA ONLY - untuk instalasi baru, tanpa data transaksi/dummy)
--

-- --------------------------------------------------------

--
-- Table structure for table `capital_transactions`
--

CREATE TABLE `capital_transactions` (
  `id` int(10) UNSIGNED NOT NULL,
  `transaction_code` varchar(30) NOT NULL,
  `transaction_date` date NOT NULL,
  `type` enum('setoran','penarikan') NOT NULL,
  `is_initial` tinyint(1) NOT NULL DEFAULT 0 COMMENT '1 = Modal Awal usaha, hanya boleh ada 1 baris dengan nilai ini (divalidasi di service layer)',
  `target_account` enum('kas','bank') NOT NULL DEFAULT 'kas',
  `shift_id` int(10) UNSIGNED DEFAULT NULL COMMENT 'Sesi kas aktif saat setoran/prive lewat KAS ini dicatat (NULL jika target_account=bank atau tidak ada sesi kas terbuka)',
  `amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `description` varchar(255) DEFAULT '',
  `recorded_by` varchar(100) DEFAULT '',
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- --------------------------------------------------------

--
-- Table structure for table `cash_movements`
--

CREATE TABLE `cash_movements` (
  `id` int(10) UNSIGNED NOT NULL,
  `shift_id` int(10) UNSIGNED NOT NULL,
  `type` enum('in','out') NOT NULL COMMENT 'in = kas masuk di luar penjualan, out = kas keluar/cash out',
  `category` varchar(50) NOT NULL DEFAULT 'lainnya',
  `amount` decimal(15,2) NOT NULL,
  `description` varchar(255) DEFAULT '',
  `created_by` varchar(100) DEFAULT 'Admin',
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `cash_registers`
--

CREATE TABLE `cash_registers` (
  `id` int(10) UNSIGNED NOT NULL,
  `code` varchar(30) NOT NULL COMMENT 'Kode singkat laci, mis. LACI-1',
  `name` varchar(100) NOT NULL COMMENT 'Nama tampilan, mis. "Kasir Utama"',
  `terminal` varchar(100) DEFAULT NULL COMMENT 'Identitas terminal/komputer fisik (opsional, untuk multi-terminal di kemudian hari)',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `cash_registers`
--

INSERT INTO `cash_registers` (`id`, `code`, `name`, `terminal`, `is_active`, `created_at`) VALUES
(1, 'LACI-1', 'Kasir Utama', NULL, 1, current_timestamp());

-- --------------------------------------------------------

--
-- Table structure for table `cash_shifts`
--

CREATE TABLE `cash_shifts` (
  `id` int(10) UNSIGNED NOT NULL,
  `shift_code` varchar(30) NOT NULL,
  `register_id` int(10) UNSIGNED NOT NULL COMMENT 'Laci kas fisik tempat sesi ini dibuka — lihat cash_registers. Rekonsiliasi fisik dilakukan terhadap laci ini, bukan terhadap opened_by_user_id.',
  `open_guard_register` int(10) UNSIGNED GENERATED ALWAYS AS (case when `status` = 'open' then `register_id` else NULL end) STORED COMMENT 'Kolom generated — jangan diisi manual. Dipakai unique index di bawah untuk mencegah lebih dari satu sesi kas open sekaligus pada laci yang sama.',
  `opening_balance` decimal(15,2) NOT NULL DEFAULT 0.00,
  `opening_notes` varchar(255) DEFAULT '',
  `opened_by` varchar(100) DEFAULT 'Admin',
  `opened_by_user_id` int(10) UNSIGNED DEFAULT NULL COMMENT 'Kasir pemilik sesi ini — SELALU dari req.user.id (JWT), tidak pernah dari body',
  `opened_at` datetime DEFAULT current_timestamp(),
  `closing_balance_system` decimal(15,2) DEFAULT NULL COMMENT 'Saldo seharusnya menurut sistem',
  `closing_balance_physical` decimal(15,2) DEFAULT NULL COMMENT 'Hasil hitung fisik di laci (input manual)',
  `difference` decimal(15,2) DEFAULT NULL COMMENT 'Fisik - Sistem (negatif = kurang, positif = lebih)',
  `total_cash_sales` decimal(15,2) DEFAULT NULL COMMENT 'Snapshot total penjualan tunai selama shift',
  `total_cash_in` decimal(15,2) DEFAULT NULL COMMENT 'Snapshot total kas masuk (di luar penjualan)',
  `total_cash_out` decimal(15,2) DEFAULT NULL COMMENT 'Snapshot total kas keluar',
  `total_cash_receivable` decimal(15,2) DEFAULT NULL COMMENT 'Snapshot: pembayaran piutang tunai yang masuk ke laci selama shift',
  `total_cash_payable` decimal(15,2) DEFAULT NULL COMMENT 'Snapshot: pembayaran hutang tunai yang keluar dari laci selama shift',
  `total_cash_purchase` decimal(15,2) DEFAULT NULL COMMENT 'Snapshot: pembelian tunai yang keluar dari laci selama shift',
  `total_cash_capital_in` decimal(15,2) DEFAULT NULL COMMENT 'Snapshot: setoran modal tunai yang masuk ke laci selama shift',
  `total_cash_capital_out` decimal(15,2) DEFAULT NULL COMMENT 'Snapshot: penarikan modal (prive) tunai yang keluar dari laci selama shift',
  `total_cash_expense` decimal(15,2) DEFAULT NULL COMMENT 'Snapshot: biaya operasional tunai yang keluar dari laci selama shift',
  `closing_notes` varchar(255) DEFAULT '',
  `closed_by` varchar(100) DEFAULT NULL,
  `closed_by_user_id` int(10) UNSIGNED DEFAULT NULL COMMENT 'Kasir yang menutup sesi ini — SELALU dari req.user.id (JWT)',
  `closed_at` datetime DEFAULT NULL,
  `status` enum('open','closed') NOT NULL DEFAULT 'open',
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- --------------------------------------------------------

--
-- Table structure for table `categories`
--

CREATE TABLE `categories` (
  `id` int(10) UNSIGNED NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- --------------------------------------------------------

--
-- Table structure for table `chart_of_accounts`
--

CREATE TABLE `chart_of_accounts` (
  `id` int(10) UNSIGNED NOT NULL,
  `account_code` varchar(20) NOT NULL,
  `account_name` varchar(150) NOT NULL,
  `account_type` enum('aset','kewajiban','modal','pendapatan','beban') NOT NULL,
  `normal_balance` enum('debit','kredit') NOT NULL COMMENT 'Posisi saldo normal akun ini bertambah',
  `description` varchar(255) DEFAULT '',
  `is_active` tinyint(1) DEFAULT 1,
  `is_system` tinyint(1) DEFAULT 0 COMMENT '1 = dipakai posting otomatis sistem, tidak boleh dihapus',
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `chart_of_accounts`
--

INSERT INTO `chart_of_accounts` (`id`, `account_code`, `account_name`, `account_type`, `normal_balance`, `description`, `is_active`, `is_system`, `created_at`) VALUES
(1, '1100', 'Kas', 'aset', 'debit', 'Uang tunai di laci/kasir', 1, 1, '2026-07-15 12:08:29'),
(2, '1150', 'Kas di Bank / Non-Tunai', 'aset', 'debit', 'Penerimaan debit, QRIS, transfer', 1, 1, '2026-07-15 12:08:29'),
(3, '1200', 'Persediaan Barang Dagang', 'aset', 'debit', 'Nilai stok barang dagang (HPP)', 1, 1, '2026-07-15 12:08:29'),
(4, '2100', 'Utang Usaha', 'kewajiban', 'kredit', 'Utang ke supplier (belum dipakai otomatis)', 1, 0, '2026-07-15 12:08:29'),
(5, '3100', 'Modal Pemilik', 'modal', 'kredit', 'Setoran modal pemilik', 1, 1, '2026-07-15 12:08:29'),
(6, '3200', 'Prive / Laba Ditahan', 'modal', 'kredit', 'Penarikan pemilik / akumulasi laba', 1, 0, '2026-07-15 12:08:29'),
(7, '4100', 'Penjualan', 'pendapatan', 'kredit', 'Pendapatan penjualan barang dagang', 1, 1, '2026-07-15 12:08:29'),
(8, '4200', 'Diskon Penjualan', 'pendapatan', 'debit', 'Kontra akun pendapatan — potongan harga', 1, 1, '2026-07-15 12:08:29'),
(9, '4900', 'Pendapatan Lain-lain', 'pendapatan', 'kredit', 'Selisih kas/stok lebih, pengembalian, dll', 1, 1, '2026-07-15 12:08:29'),
(10, '5100', 'Harga Pokok Penjualan (HPP)', 'beban', 'debit', 'Harga modal barang yang terjual', 1, 1, '2026-07-15 12:08:29'),
(11, '5210', 'Beban Sewa Tempat', 'beban', 'debit', '', 1, 1, '2026-07-15 12:08:29'),
(12, '5220', 'Beban Gaji Karyawan', 'beban', 'debit', '', 1, 1, '2026-07-15 12:08:29'),
(13, '5230', 'Beban Listrik & Air', 'beban', 'debit', '', 1, 1, '2026-07-15 12:08:29'),
(14, '5240', 'Beban Pemasaran/Promosi', 'beban', 'debit', '', 1, 1, '2026-07-15 12:08:29'),
(15, '5250', 'Beban Transportasi/Logistik', 'beban', 'debit', '', 1, 1, '2026-07-15 12:08:29'),
(16, '5260', 'Beban Perawatan & Perbaikan', 'beban', 'debit', '', 1, 1, '2026-07-15 12:08:29'),
(17, '5270', 'Beban Administrasi & ATK', 'beban', 'debit', '', 1, 1, '2026-07-15 12:08:29'),
(18, '5280', 'Beban Operasional Lainnya', 'beban', 'debit', '', 1, 1, '2026-07-15 12:08:29'),
(19, '5310', 'Beban Kas Kecil Lainnya', 'beban', 'debit', 'Pengeluaran kas kecil insidental (sedekah, dll)', 1, 1, '2026-07-15 12:08:29'),
(20, '5900', 'Beban Selisih Kas', 'beban', 'debit', 'Selisih kurang saat tutup kas', 1, 1, '2026-07-15 12:08:29'),
(21, '5910', 'Beban Selisih Stok (Opname)', 'beban', 'debit', 'Selisih kurang stok fisik vs sistem', 1, 1, '2026-07-15 12:08:29'),
(22, '1300', 'Piutang Usaha', 'aset', 'debit', 'Tagihan ke pelanggan dari transaksi Open Bill (belum dibayar/dicicil)', 1, 1, '2026-07-24 08:27:05'),
(23, '2200', 'Utang Bank', 'kewajiban', 'kredit', 'Pokok pinjaman bank yang belum dilunasi', 1, 1, '2026-08-11 06:03:05'),
(24, '2300', 'Utang Lainnya', 'kewajiban', 'kredit', 'Kewajiban non-supplier & non-bank (mis. pinjaman pihak lain)', 1, 1, '2026-08-11 06:03:05'),
(25, '5320', 'Beban Bunga Pinjaman', 'beban', 'debit', 'Porsi bunga saat membayar cicilan pinjaman bank/lainnya', 1, 1, '2026-08-11 06:03:05'),
(26, '3300', 'Saldo Awal / Penyesuaian', 'modal', 'kredit', 'Lawan akun untuk entri hutang manual yang mengakui kondisi yang sudah ada (bukan transaksi baru), supaya jurnal tetap balance tanpa mengarang kenaikan stok/kas', 1, 1, '2026-08-11 06:03:05'),
(27, '2110', 'Utang Gaji', 'kewajiban', 'kredit', 'Beban gaji periode berjalan yang belum dibayar (akrual)', 1, 1, '2026-08-17 11:22:14'),
(28, '2120', 'Utang Listrik & Air', 'kewajiban', 'kredit', 'Tagihan listrik/air periode berjalan yang belum dibayar (akrual)', 1, 1, '2026-08-17 11:22:14'),
(29, '2130', 'Utang Beban Lainnya (Akrual)', 'kewajiban', 'kredit', 'Beban masih harus dibayar di luar gaji & listrik/air', 1, 1, '2026-08-17 11:22:14'),
(30, '2400', 'Pendapatan Diterima di Muka', 'kewajiban', 'kredit', 'DP/uang muka pelanggan atas barang yang belum dikirim (unearned revenue)', 1, 1, '2026-08-17 11:22:14');

-- --------------------------------------------------------

--
-- Table structure for table `customers`
--

CREATE TABLE `customers` (
  `id` int(10) UNSIGNED NOT NULL,
  `name` varchar(150) NOT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `email` varchar(150) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `expenses`
--

CREATE TABLE `expenses` (
  `id` int(10) UNSIGNED NOT NULL,
  `expense_date` date NOT NULL,
  `category` varchar(50) NOT NULL,
  `description` varchar(255) DEFAULT '',
  `amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `shift_id` int(10) UNSIGNED DEFAULT NULL COMMENT 'Sesi kas aktif saat biaya operasional ini dibayar (selalu dari Kas — NULL hanya kalau tidak ada sesi kas terbuka)',
  `recorded_by` varchar(100) DEFAULT '',
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `journal_entries`
--

CREATE TABLE `journal_entries` (
  `id` int(10) UNSIGNED NOT NULL,
  `entry_code` varchar(30) NOT NULL,
  `entry_date` date NOT NULL,
  `description` varchar(255) DEFAULT '',
  `reference_type` enum('adjustment','capital','cash_movement','cash_movement_void','cash_shift_close','expense','expense_void','manual','other_payable','other_payable_payment','payable_creation','payable_payment','purchase','receivable_creation','receivable_payment','sale','stock_opname','void') NOT NULL DEFAULT 'manual',
  `reference_id` int(10) UNSIGNED DEFAULT NULL COMMENT 'ID baris sumber di modul terkait (mis. id transaksi penjualan)',
  `reference_code` varchar(30) DEFAULT '' COMMENT 'Kode dokumen sumber (mis. TRX2026..., PRC2026...) utk ditampilkan',
  `reversal_of_id` int(10) UNSIGNED DEFAULT NULL COMMENT 'Jika jurnal ini adalah pembalik dari jurnal penyesuaian lain, isi id jurnal asalnya',
  `total_debit` decimal(15,2) NOT NULL DEFAULT 0.00,
  `total_credit` decimal(15,2) NOT NULL DEFAULT 0.00,
  `source` enum('auto','manual') NOT NULL DEFAULT 'auto',
  `created_by` varchar(100) DEFAULT 'Sistem',
  `created_by_user_id` int(10) UNSIGNED DEFAULT NULL,
  `status` enum('draft','posted','reversed') NOT NULL DEFAULT 'posted',
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- --------------------------------------------------------

--
-- Table structure for table `journal_entry_lines`
--

CREATE TABLE `journal_entry_lines` (
  `id` int(10) UNSIGNED NOT NULL,
  `journal_entry_id` int(10) UNSIGNED NOT NULL,
  `account_id` int(10) UNSIGNED NOT NULL,
  `debit` decimal(15,2) NOT NULL DEFAULT 0.00,
  `credit` decimal(15,2) NOT NULL DEFAULT 0.00,
  `description` varchar(255) DEFAULT '',
  `line_order` int(10) UNSIGNED DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- --------------------------------------------------------

--
-- Table structure for table `notifications`
--

CREATE TABLE `notifications` (
  `id` int(11) NOT NULL,
  `type` enum('stock_out','low_stock','reorder_point') NOT NULL,
  `level` enum('critical','warning') NOT NULL DEFAULT 'warning',
  `product_id` int(10) UNSIGNED DEFAULT NULL,
  `product_name` varchar(150) NOT NULL,
  `message` varchar(500) NOT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT 0,
  `is_resolved` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `resolved_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- --------------------------------------------------------

--
-- Table structure for table `other_payables`
--

CREATE TABLE `other_payables` (
  `id` int(10) UNSIGNED NOT NULL,
  `code` varchar(30) NOT NULL,
  `type` enum('pinjaman_bank','utang_lainnya') NOT NULL DEFAULT 'pinjaman_bank',
  `creditor_name` varchar(150) NOT NULL,
  `principal_amount` decimal(15,2) NOT NULL,
  `outstanding_amount` decimal(15,2) NOT NULL,
  `interest_rate` decimal(5,2) DEFAULT NULL,
  `disbursement_date` date NOT NULL,
  `due_date` date NOT NULL,
  `target_account` enum('kas','bank') NOT NULL DEFAULT 'bank',
  `status` enum('aktif','lunas') NOT NULL DEFAULT 'aktif',
  `notes` text DEFAULT NULL,
  `recorded_by` varchar(100) DEFAULT '',
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `other_payable_payments`
--

CREATE TABLE `other_payable_payments` (
  `id` int(10) UNSIGNED NOT NULL,
  `other_payable_id` int(10) UNSIGNED NOT NULL,
  `payment_date` date NOT NULL,
  `principal_amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `interest_amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `payment_method` enum('cash','debit','qris','transfer') DEFAULT 'transfer',
  `notes` text DEFAULT NULL,
  `recorded_by` varchar(100) DEFAULT '',
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `payables`
--

CREATE TABLE `payables` (
  `id` int(10) UNSIGNED NOT NULL,
  `invoice_code` varchar(30) NOT NULL,
  `supplier_id` int(11) DEFAULT NULL,
  `supplier_name` varchar(150) NOT NULL,
  `purchase_id` int(11) DEFAULT NULL,
  `amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `paid_amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `invoice_date` date NOT NULL,
  `due_date` date NOT NULL,
  `status` enum('belum_lunas','sebagian','lunas') NOT NULL DEFAULT 'belum_lunas',
  `notes` text DEFAULT NULL,
  `recorded_by` varchar(100) DEFAULT '',
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- --------------------------------------------------------

--
-- Table structure for table `payable_payments`
--

CREATE TABLE `payable_payments` (
  `id` int(10) UNSIGNED NOT NULL,
  `payable_id` int(10) UNSIGNED NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `payment_date` date NOT NULL,
  `payment_method` enum('cash','debit','qris','transfer') DEFAULT 'cash',
  `shift_id` int(10) UNSIGNED DEFAULT NULL COMMENT 'Sesi kas aktif saat pembayaran hutang CASH ini dicatat (NULL jika non-cash atau tidak ada sesi kas terbuka)',
  `notes` text DEFAULT NULL,
  `recorded_by` varchar(100) DEFAULT '',
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- --------------------------------------------------------

--
-- Table structure for table `products`
--

CREATE TABLE `products` (
  `id` int(10) UNSIGNED NOT NULL,
  `barcode` varchar(50) NOT NULL,
  `name` varchar(200) NOT NULL,
  `description` text DEFAULT NULL,
  `category_id` int(10) UNSIGNED DEFAULT NULL,
  `price` decimal(15,2) NOT NULL DEFAULT 0.00,
  `price_wholesale` decimal(15,2) DEFAULT NULL COMMENT 'Harga grosir (opsional). Jika NULL/0, transaksi grosir jatuh ke harga eceran (price).',
  `min_qty_wholesale` int(10) UNSIGNED DEFAULT NULL COMMENT 'Jumlah beli minimum (satuan dasar) agar harga grosir berlaku',
  `cost_price` decimal(15,2) NOT NULL DEFAULT 0.00,
  `stock` decimal(15,3) NOT NULL DEFAULT 0.000,
  `min_stock` decimal(15,3) NOT NULL DEFAULT 0.000,
  `lead_time_value` decimal(8,2) DEFAULT NULL COMMENT 'Rata-rata waktu tunggu pemesanan ke supplier sampai barang diterima, dalam satuan rop_time_unit. NULL = ROP tidak dihitung untuk produk ini.',
  `safety_stock_value` decimal(8,2) DEFAULT NULL COMMENT 'Cadangan (HC) dalam satuan rop_time_unit — dipakai menghitung Safety Stock.',
  `rop_time_unit` enum('hari','jam') NOT NULL DEFAULT 'hari' COMMENT 'Satuan waktu untuk lead_time_value & safety_stock_value.',
  `unit` varchar(20) DEFAULT 'pcs',
  `selection_type` enum('none','variant','unit') NOT NULL DEFAULT 'none' COMMENT 'none = langsung masuk keranjang; variant = popup pilih varian; unit = popup pilih satuan',
  `image_url` varchar(500) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- --------------------------------------------------------

--
-- Table structure for table `product_units`
--

CREATE TABLE `product_units` (
  `id` int(10) UNSIGNED NOT NULL,
  `product_id` int(10) UNSIGNED NOT NULL,
  `unit_id` int(10) UNSIGNED NOT NULL,
  `conversion_qty` decimal(15,4) NOT NULL COMMENT '1 satuan ini = berapa satuan dasar produk',
  `price` decimal(15,2) DEFAULT NULL COMMENT 'Harga jual eceran untuk satuan ini (mis. harga per BOX)',
  `price_wholesale` decimal(15,2) DEFAULT NULL COMMENT 'Harga jual grosir untuk satuan ini (opsional)',
  `purchase_only` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'TRUE = satuan ini hanya untuk konversi Pembelian, disembunyikan dari opsi satuan di kasir',
  `min_qty_wholesale` int(10) UNSIGNED DEFAULT NULL COMMENT 'Jumlah beli minimum satuan ini agar harga grosir satuan ini berlaku',
  `barcode` varchar(50) DEFAULT NULL COMMENT 'Barcode khusus satuan ini (opsional)',
  `sku` varchar(50) DEFAULT NULL COMMENT 'SKU khusus satuan ini (opsional)',
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `product_variants`
--

CREATE TABLE `product_variants` (
  `id` int(10) UNSIGNED NOT NULL,
  `product_id` int(10) UNSIGNED NOT NULL,
  `name` varchar(100) NOT NULL COMMENT 'Nama varian, bebas ditentukan admin (Es, Panas, Freeze, dst.)',
  `price` decimal(15,2) NOT NULL COMMENT 'Harga eceran varian ini',
  `price_wholesale` decimal(15,2) DEFAULT NULL COMMENT 'Harga grosir varian ini (opsional)',
  `min_qty_wholesale` int(10) UNSIGNED DEFAULT NULL COMMENT 'Jumlah beli minimum agar harga grosir varian ini berlaku',
  `barcode` varchar(50) DEFAULT NULL COMMENT 'Barcode khusus varian ini (opsional)',
  `sku` varchar(50) DEFAULT NULL COMMENT 'SKU khusus varian ini (opsional)',
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `purchases`
--

CREATE TABLE `purchases` (
  `id` int(11) NOT NULL,
  `purchase_code` varchar(30) NOT NULL,
  `supplier_id` int(11) DEFAULT NULL,
  `supplier_name` varchar(150) DEFAULT '',
  `purchase_date` date NOT NULL,
  `payment_method` enum('tunai','kredit') NOT NULL DEFAULT 'tunai',
  `shift_id` int(10) UNSIGNED DEFAULT NULL COMMENT 'Sesi kas aktif saat pembelian TUNAI ini dicatat (NULL jika kredit atau tidak ada sesi kas terbuka)',
  `due_date` date DEFAULT NULL,
  `total_items` int(11) DEFAULT 0,
  `total_qty` decimal(15,3) NOT NULL DEFAULT 0.000,
  `total_cost` decimal(15,2) DEFAULT 0.00,
  `notes` text DEFAULT '',
  `nota_url` varchar(500) DEFAULT NULL,
  `nota_original_name` varchar(255) DEFAULT NULL,
  `recorded_by` varchar(100) DEFAULT '',
  `recorded_by_user_id` int(10) UNSIGNED DEFAULT NULL,
  `status` enum('draft','confirmed') DEFAULT 'confirmed',
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- --------------------------------------------------------

--
-- Table structure for table `purchase_items`
--

CREATE TABLE `purchase_items` (
  `id` int(11) NOT NULL,
  `purchase_id` int(11) NOT NULL,
  `product_id` int(10) UNSIGNED NOT NULL,
  `product_name` varchar(150) NOT NULL,
  `product_barcode` varchar(100) DEFAULT '',
  `purchase_unit_id` int(10) UNSIGNED DEFAULT NULL COMMENT 'ID product_units yang dipilih saat pembelian ini (NULL = satuan dasar produk)',
  `unit_label` varchar(100) DEFAULT NULL COMMENT 'Snapshot nama satuan beli (mis. "Karung"), tetap akurat walau satuan produk berubah/dihapus nanti',
  `conversion_qty` decimal(15,4) NOT NULL DEFAULT 1.0000 COMMENT '1 satuan beli ini = berapa satuan dasar (mis. 1 Karung = 25 kg)',
  `purchase_qty` decimal(15,3) NOT NULL DEFAULT 0.000 COMMENT 'Jumlah asli yang diinput dalam satuan beli, sebelum dikonversi ke satuan dasar (kolom quantity)',
  `quantity` decimal(15,3) NOT NULL,
  `expiry_date` date DEFAULT NULL,
  `unit_cost` decimal(15,2) DEFAULT 0.00,
  `subtotal_cost` decimal(15,2) DEFAULT 0.00,
  `previous_stock` decimal(15,3) NOT NULL DEFAULT 0.000,
  `new_stock` decimal(15,3) NOT NULL DEFAULT 0.000,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- --------------------------------------------------------

--
-- Table structure for table `push_subscriptions`
--

CREATE TABLE `push_subscriptions` (
  `id` int(11) NOT NULL,
  `user_id` int(10) UNSIGNED DEFAULT NULL,
  `endpoint` varchar(500) NOT NULL,
  `p256dh` varchar(255) NOT NULL,
  `auth` varchar(255) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `receivables`
--

CREATE TABLE `receivables` (
  `id` int(10) UNSIGNED NOT NULL,
  `invoice_code` varchar(30) NOT NULL,
  `customer_id` int(10) UNSIGNED DEFAULT NULL,
  `customer_name` varchar(150) NOT NULL,
  `transaction_id` int(10) UNSIGNED DEFAULT NULL,
  `amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `paid_amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `invoice_date` date NOT NULL,
  `due_date` date NOT NULL,
  `status` enum('belum_lunas','sebagian','lunas','dibatalkan') NOT NULL DEFAULT 'belum_lunas',
  `notes` text DEFAULT NULL,
  `recorded_by` varchar(100) DEFAULT '',
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- --------------------------------------------------------

--
-- Table structure for table `receivable_payments`
--

CREATE TABLE `receivable_payments` (
  `id` int(10) UNSIGNED NOT NULL,
  `receivable_id` int(10) UNSIGNED NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `payment_date` date NOT NULL,
  `payment_method` enum('cash','debit','qris','transfer') DEFAULT 'cash',
  `shift_id` int(10) UNSIGNED DEFAULT NULL COMMENT 'Sesi kas aktif saat pembayaran piutang CASH ini diterima (NULL jika non-cash atau tidak ada sesi kas terbuka)',
  `notes` text DEFAULT NULL,
  `recorded_by` varchar(100) DEFAULT '',
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- --------------------------------------------------------

--
-- Table structure for table `settings`
--

CREATE TABLE `settings` (
  `key` varchar(100) NOT NULL,
  `value` text NOT NULL,
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- --------------------------------------------------------

--
-- Table structure for table `stock_history`
--

CREATE TABLE `stock_history` (
  `id` int(10) UNSIGNED NOT NULL,
  `product_id` int(10) UNSIGNED NOT NULL,
  `type` enum('in','out','adjustment') NOT NULL,
  `quantity` decimal(15,3) NOT NULL,
  `previous_stock` decimal(15,3) NOT NULL,
  `new_stock` decimal(15,3) NOT NULL,
  `reference` varchar(100) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_by` varchar(100) DEFAULT '' COMMENT 'User yang bertanggung jawab atas mutasi ini',
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- --------------------------------------------------------

--
-- Table structure for table `stock_opname_items`
--

CREATE TABLE `stock_opname_items` (
  `id` int(10) UNSIGNED NOT NULL,
  `session_id` int(10) UNSIGNED NOT NULL,
  `product_id` int(10) UNSIGNED NOT NULL,
  `product_name` varchar(200) NOT NULL,
  `product_barcode` varchar(50) DEFAULT '',
  `unit` varchar(20) DEFAULT 'pcs',
  `system_stock` decimal(15,3) NOT NULL,
  `physical_stock` decimal(15,3) NOT NULL,
  `difference` decimal(15,3) NOT NULL,
  `difference_value` decimal(15,2) NOT NULL DEFAULT 0.00,
  `notes` varchar(255) DEFAULT '',
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `stock_opname_sessions`
--

CREATE TABLE `stock_opname_sessions` (
  `id` int(10) UNSIGNED NOT NULL,
  `opname_code` varchar(30) NOT NULL,
  `opname_date` date NOT NULL,
  `total_items` int(11) NOT NULL DEFAULT 0,
  `total_items_selisih` int(11) NOT NULL DEFAULT 0,
  `total_difference_qty` decimal(15,3) NOT NULL DEFAULT 0.000,
  `total_difference_value` decimal(15,2) NOT NULL DEFAULT 0.00,
  `notes` text DEFAULT NULL,
  `recorded_by` varchar(100) DEFAULT '',
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `suppliers`
--

CREATE TABLE `suppliers` (
  `id` int(11) NOT NULL,
  `name` varchar(150) NOT NULL,
  `phone` varchar(30) DEFAULT '',
  `address` text DEFAULT '',
  `notes` text DEFAULT '',
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- --------------------------------------------------------

--
-- Table structure for table `transactions`
--

CREATE TABLE `transactions` (
  `id` int(10) UNSIGNED NOT NULL,
  `transaction_code` varchar(30) NOT NULL,
  `total_amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `discount_amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `tax_amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `final_amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `payment_method` enum('cash','debit','qris','transfer','open_bill') DEFAULT 'cash',
  `payment_amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `change_amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `customer_name` varchar(100) DEFAULT NULL,
  `customer_id` int(10) UNSIGNED DEFAULT NULL,
  `cashier_name` varchar(100) DEFAULT 'Kasir',
  `cashier_id` int(10) UNSIGNED DEFAULT NULL COMMENT 'Kasir pemilik transaksi — SELALU dari req.user.id (JWT) saat checkout, tidak pernah dari body. NULL = data lama sebelum migration ini.',
  `shift_id` int(10) UNSIGNED NOT NULL COMMENT 'Sesi kas (cash_shifts) yang aktif saat transaksi dibuat. WAJIB diisi — checkout() menolak transaksi tanpa sesi kas aktif (lihat review dosen poin shift_id).',
  `notes` text DEFAULT NULL,
  `status` enum('completed','cancelled','pending') DEFAULT 'completed',
  `voided_at` datetime DEFAULT NULL COMMENT 'Waktu transaksi dibatalkan (NULL jika belum pernah dibatalkan)',
  `voided_by` varchar(100) DEFAULT NULL COMMENT 'Nama admin yang membatalkan transaksi',
  `void_reason` varchar(255) DEFAULT NULL COMMENT 'Alasan pembatalan (wajib diisi dari form void)',
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- --------------------------------------------------------

--
-- Table structure for table `transaction_items`
--

CREATE TABLE `transaction_items` (
  `id` int(10) UNSIGNED NOT NULL,
  `transaction_id` int(10) UNSIGNED NOT NULL,
  `product_id` int(10) UNSIGNED NOT NULL,
  `product_name` varchar(200) NOT NULL,
  `product_barcode` varchar(50) NOT NULL,
  `quantity` decimal(15,3) NOT NULL DEFAULT 1.000,
  `unit_price` decimal(15,2) NOT NULL,
  `price_type` enum('retail','wholesale') NOT NULL DEFAULT 'retail' COMMENT 'Jenis harga yang dipakai saat penjualan: eceran atau grosir',
  `option_type` enum('none','variant','unit') NOT NULL DEFAULT 'none' COMMENT 'Jenis opsi yang dipilih kasir saat menjual item ini',
  `option_id` int(10) UNSIGNED DEFAULT NULL COMMENT 'ID product_variants atau product_units yang dipilih (NULL jika none/satuan dasar)',
  `option_label` varchar(100) DEFAULT NULL COMMENT 'Snapshot nama opsi (mis. "Es", "Karung") untuk struk & laporan',
  `conversion_qty` decimal(15,4) NOT NULL DEFAULT 1.0000 COMMENT 'Berapa satuan dasar per 1 qty baris ini; dipakai untuk hitung pengurangan stok',
  `unit_cost` decimal(15,2) NOT NULL DEFAULT 0.00 COMMENT 'Snapshot harga modal saat transaksi — dasar perhitungan HPP/COGS',
  `discount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `subtotal` decimal(15,2) NOT NULL,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- --------------------------------------------------------

--
-- Table structure for table `units`
--

CREATE TABLE `units` (
  `id` int(10) UNSIGNED NOT NULL,
  `name` varchar(50) NOT NULL,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(10) UNSIGNED NOT NULL,
  `name` varchar(100) NOT NULL,
  `username` varchar(50) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` enum('admin','cashier') DEFAULT 'cashier',
  `is_active` tinyint(1) DEFAULT 1,
  `last_login` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- --------------------------------------------------------

--
-- Table structure for table `void_requests`
--

CREATE TABLE `void_requests` (
  `id` int(10) UNSIGNED NOT NULL,
  `transaction_id` int(10) UNSIGNED NOT NULL,
  `requested_by_user_id` int(10) UNSIGNED NOT NULL COMMENT 'Kasir pengaju — dari req.user.id, tidak pernah dari body',
  `requested_by_name` varchar(100) NOT NULL COMMENT 'Snapshot nama pengaju saat itu (tetap terbaca walau akun diubah/dihapus)',
  `reason` varchar(255) NOT NULL,
  `requested_at` datetime NOT NULL DEFAULT current_timestamp(),
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `reviewed_by_user_id` int(10) UNSIGNED DEFAULT NULL COMMENT 'Admin/supervisor yang menyetujui atau menolak — dari req.user.id',
  `reviewed_by_name` varchar(100) DEFAULT NULL,
  `review_note` varchar(255) DEFAULT NULL COMMENT 'Catatan admin, wajib diisi jika ditolak',
  `reviewed_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `capital_transactions`
--
ALTER TABLE `capital_transactions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `transaction_code` (`transaction_code`),
  ADD KEY `idx_capital_date` (`transaction_date`),
  ADD KEY `idx_capital_type` (`type`),
  ADD KEY `idx_capital_transactions_shift` (`shift_id`);

--
-- Indexes for table `cash_movements`
--
ALTER TABLE `cash_movements`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_cash_movements_shift` (`shift_id`),
  ADD KEY `idx_cash_movements_type` (`type`);

--
-- Indexes for table `cash_registers`
--
ALTER TABLE `cash_registers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `code` (`code`);

--
-- Indexes for table `cash_shifts`
--
ALTER TABLE `cash_shifts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `shift_code` (`shift_code`),
  ADD UNIQUE KEY `uq_cash_shifts_single_open_per_register` (`open_guard_register`),
  ADD KEY `idx_cash_shifts_register` (`register_id`),
  ADD KEY `idx_cash_shifts_status` (`status`),
  ADD KEY `idx_cash_shifts_opened_at` (`opened_at`),
  ADD KEY `idx_cash_shifts_opened_by_user` (`opened_by_user_id`),
  ADD KEY `fk_cash_shifts_closed_by_user` (`closed_by_user_id`);

--
-- Indexes for table `categories`
--
ALTER TABLE `categories`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`);

--
-- Indexes for table `chart_of_accounts`
--
ALTER TABLE `chart_of_accounts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `account_code` (`account_code`),
  ADD KEY `idx_coa_type` (`account_type`);

--
-- Indexes for table `customers`
--
ALTER TABLE `customers`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_customers_name` (`name`),
  ADD KEY `idx_customers_phone` (`phone`);

--
-- Indexes for table `expenses`
--
ALTER TABLE `expenses`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_expenses_date` (`expense_date`),
  ADD KEY `idx_expenses_category` (`category`),
  ADD KEY `idx_expenses_shift` (`shift_id`);

--
-- Indexes for table `journal_entries`
--
ALTER TABLE `journal_entries`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `entry_code` (`entry_code`),
  ADD KEY `idx_journal_entries_date` (`entry_date`),
  ADD KEY `idx_journal_entries_ref` (`reference_type`,`reference_id`),
  ADD KEY `fk_journal_reversal` (`reversal_of_id`),
  ADD KEY `idx_journal_entries_created_by_user` (`created_by_user_id`),
  ADD KEY `idx_journal_entries_status` (`status`);

--
-- Indexes for table `journal_entry_lines`
--
ALTER TABLE `journal_entry_lines`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_jel_entry` (`journal_entry_id`),
  ADD KEY `idx_jel_account` (`account_id`);

--
-- Indexes for table `notifications`
--
ALTER TABLE `notifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_active_by_product` (`product_id`,`type`,`is_resolved`),
  ADD KEY `idx_unread` (`is_read`,`created_at`),
  ADD KEY `idx_created` (`created_at`);

--
-- Indexes for table `other_payables`
--
ALTER TABLE `other_payables`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `code` (`code`),
  ADD KEY `idx_other_payables_status` (`status`),
  ADD KEY `idx_other_payables_due` (`due_date`);

--
-- Indexes for table `other_payable_payments`
--
ALTER TABLE `other_payable_payments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_other_pay_payments_opb` (`other_payable_id`);

--
-- Indexes for table `payables`
--
ALTER TABLE `payables`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `invoice_code` (`invoice_code`),
  ADD KEY `purchase_id` (`purchase_id`),
  ADD KEY `idx_payables_supplier` (`supplier_id`),
  ADD KEY `idx_payables_status` (`status`),
  ADD KEY `idx_payables_due` (`due_date`);

--
-- Indexes for table `payable_payments`
--
ALTER TABLE `payable_payments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_pay_payments_pay` (`payable_id`),
  ADD KEY `idx_payable_payments_shift` (`shift_id`);

--
-- Indexes for table `products`
--
ALTER TABLE `products`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `barcode` (`barcode`),
  ADD KEY `idx_products_barcode` (`barcode`),
  ADD KEY `idx_products_category` (`category_id`),
  ADD KEY `idx_products_active` (`is_active`);

--
-- Indexes for table `product_units`
--
ALTER TABLE `product_units`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_product_unit` (`product_id`,`unit_id`),
  ADD UNIQUE KEY `uniq_product_units_barcode` (`barcode`),
  ADD KEY `unit_id` (`unit_id`);

--
-- Indexes for table `product_variants`
--
ALTER TABLE `product_variants`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_product_variant_name` (`product_id`,`name`),
  ADD UNIQUE KEY `uniq_product_variants_barcode` (`barcode`);

--
-- Indexes for table `purchases`
--
ALTER TABLE `purchases`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `purchase_code` (`purchase_code`),
  ADD KEY `idx_purchases_date` (`purchase_date`),
  ADD KEY `idx_purchases_supplier` (`supplier_id`),
  ADD KEY `idx_purchases_payment_method` (`payment_method`),
  ADD KEY `idx_purchases_shift` (`shift_id`),
  ADD KEY `idx_purchases_recorded_by_user` (`recorded_by_user_id`);

--
-- Indexes for table `purchase_items`
--
ALTER TABLE `purchase_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `purchase_id` (`purchase_id`),
  ADD KEY `idx_purchase_items_pid` (`product_id`);

--
-- Indexes for table `push_subscriptions`
--
ALTER TABLE `push_subscriptions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_endpoint` (`endpoint`(255)),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `receivables`
--
ALTER TABLE `receivables`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `invoice_code` (`invoice_code`),
  ADD KEY `transaction_id` (`transaction_id`),
  ADD KEY `idx_receivables_customer` (`customer_id`),
  ADD KEY `idx_receivables_status` (`status`),
  ADD KEY `idx_receivables_due` (`due_date`);

--
-- Indexes for table `receivable_payments`
--
ALTER TABLE `receivable_payments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_recv_payments_recv` (`receivable_id`),
  ADD KEY `idx_receivable_payments_shift` (`shift_id`);

--
-- Indexes for table `settings`
--
ALTER TABLE `settings`
  ADD PRIMARY KEY (`key`);

--
-- Indexes for table `stock_history`
--
ALTER TABLE `stock_history`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_stock_history_prod` (`product_id`),
  ADD KEY `idx_stock_history_created_by` (`created_by`);

--
-- Indexes for table `stock_opname_items`
--
ALTER TABLE `stock_opname_items`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_so_items_session_product` (`session_id`,`product_id`),
  ADD KEY `idx_so_items_session` (`session_id`),
  ADD KEY `idx_so_items_product` (`product_id`);

--
-- Indexes for table `stock_opname_sessions`
--
ALTER TABLE `stock_opname_sessions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `opname_code` (`opname_code`),
  ADD KEY `idx_so_sessions_date` (`opname_date`);

--
-- Indexes for table `suppliers`
--
ALTER TABLE `suppliers`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `transactions`
--
ALTER TABLE `transactions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `transaction_code` (`transaction_code`),
  ADD KEY `idx_transactions_date` (`created_at`),
  ADD KEY `idx_transactions_status` (`status`),
  ADD KEY `idx_transactions_customer` (`customer_id`),
  ADD KEY `idx_transactions_cashier` (`cashier_id`),
  ADD KEY `idx_transactions_shift` (`shift_id`);

--
-- Indexes for table `transaction_items`
--
ALTER TABLE `transaction_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_tx_items_tx` (`transaction_id`),
  ADD KEY `idx_tx_items_product` (`product_id`);

--
-- Indexes for table `units`
--
ALTER TABLE `units`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`);

--
-- Indexes for table `void_requests`
--
ALTER TABLE `void_requests`
  ADD PRIMARY KEY (`id`),
  ADD KEY `reviewed_by_user_id` (`reviewed_by_user_id`),
  ADD KEY `idx_void_requests_transaction` (`transaction_id`),
  ADD KEY `idx_void_requests_status` (`status`),
  ADD KEY `idx_void_requests_requester` (`requested_by_user_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `capital_transactions`
--
ALTER TABLE `capital_transactions`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `cash_movements`
--
ALTER TABLE `cash_movements`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `cash_registers`
--
ALTER TABLE `cash_registers`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `cash_shifts`
--
ALTER TABLE `cash_shifts`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `categories`
--
ALTER TABLE `categories`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `chart_of_accounts`
--
ALTER TABLE `chart_of_accounts`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=31;

--
-- AUTO_INCREMENT for table `customers`
--
ALTER TABLE `customers`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `expenses`
--
ALTER TABLE `expenses`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `journal_entries`
--
ALTER TABLE `journal_entries`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `journal_entry_lines`
--
ALTER TABLE `journal_entry_lines`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `notifications`
--
ALTER TABLE `notifications`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `other_payables`
--
ALTER TABLE `other_payables`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `other_payable_payments`
--
ALTER TABLE `other_payable_payments`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `payables`
--
ALTER TABLE `payables`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `payable_payments`
--
ALTER TABLE `payable_payments`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `products`
--
ALTER TABLE `products`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `product_units`
--
ALTER TABLE `product_units`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `product_variants`
--
ALTER TABLE `product_variants`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `purchases`
--
ALTER TABLE `purchases`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `purchase_items`
--
ALTER TABLE `purchase_items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `push_subscriptions`
--
ALTER TABLE `push_subscriptions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `receivables`
--
ALTER TABLE `receivables`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `receivable_payments`
--
ALTER TABLE `receivable_payments`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `stock_history`
--
ALTER TABLE `stock_history`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `stock_opname_items`
--
ALTER TABLE `stock_opname_items`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `stock_opname_sessions`
--
ALTER TABLE `stock_opname_sessions`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `suppliers`
--
ALTER TABLE `suppliers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `transactions`
--
ALTER TABLE `transactions`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `transaction_items`
--
ALTER TABLE `transaction_items`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `units`
--
ALTER TABLE `units`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `void_requests`
--
ALTER TABLE `void_requests`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `capital_transactions`
--
ALTER TABLE `capital_transactions`
  ADD CONSTRAINT `fk_capital_transactions_shift` FOREIGN KEY (`shift_id`) REFERENCES `cash_shifts` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `cash_movements`
--
ALTER TABLE `cash_movements`
  ADD CONSTRAINT `cash_movements_ibfk_1` FOREIGN KEY (`shift_id`) REFERENCES `cash_shifts` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `cash_shifts`
--
ALTER TABLE `cash_shifts`
  ADD CONSTRAINT `fk_cash_shifts_closed_by_user` FOREIGN KEY (`closed_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_cash_shifts_opened_by_user` FOREIGN KEY (`opened_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_cash_shifts_register` FOREIGN KEY (`register_id`) REFERENCES `cash_registers` (`id`);

--
-- Constraints for table `expenses`
--
ALTER TABLE `expenses`
  ADD CONSTRAINT `fk_expenses_shift` FOREIGN KEY (`shift_id`) REFERENCES `cash_shifts` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `journal_entries`
--
ALTER TABLE `journal_entries`
  ADD CONSTRAINT `fk_journal_entries_created_by_user` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_journal_reversal` FOREIGN KEY (`reversal_of_id`) REFERENCES `journal_entries` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `journal_entry_lines`
--
ALTER TABLE `journal_entry_lines`
  ADD CONSTRAINT `journal_entry_lines_ibfk_1` FOREIGN KEY (`journal_entry_id`) REFERENCES `journal_entries` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `journal_entry_lines_ibfk_2` FOREIGN KEY (`account_id`) REFERENCES `chart_of_accounts` (`id`);

--
-- Constraints for table `notifications`
--
ALTER TABLE `notifications`
  ADD CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `other_payable_payments`
--
ALTER TABLE `other_payable_payments`
  ADD CONSTRAINT `other_payable_payments_ibfk_1` FOREIGN KEY (`other_payable_id`) REFERENCES `other_payables` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `payables`
--
ALTER TABLE `payables`
  ADD CONSTRAINT `payables_ibfk_1` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `payables_ibfk_2` FOREIGN KEY (`purchase_id`) REFERENCES `purchases` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `payable_payments`
--
ALTER TABLE `payable_payments`
  ADD CONSTRAINT `fk_payable_payments_shift` FOREIGN KEY (`shift_id`) REFERENCES `cash_shifts` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `payable_payments_ibfk_1` FOREIGN KEY (`payable_id`) REFERENCES `payables` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `products`
--
ALTER TABLE `products`
  ADD CONSTRAINT `products_ibfk_1` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `product_units`
--
ALTER TABLE `product_units`
  ADD CONSTRAINT `product_units_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `product_units_ibfk_2` FOREIGN KEY (`unit_id`) REFERENCES `units` (`id`);

--
-- Constraints for table `product_variants`
--
ALTER TABLE `product_variants`
  ADD CONSTRAINT `product_variants_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `purchases`
--
ALTER TABLE `purchases`
  ADD CONSTRAINT `fk_purchases_recorded_by_user` FOREIGN KEY (`recorded_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_purchases_shift` FOREIGN KEY (`shift_id`) REFERENCES `cash_shifts` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `purchases_ibfk_1` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `purchase_items`
--
ALTER TABLE `purchase_items`
  ADD CONSTRAINT `purchase_items_ibfk_1` FOREIGN KEY (`purchase_id`) REFERENCES `purchases` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `purchase_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`);

--
-- Constraints for table `push_subscriptions`
--
ALTER TABLE `push_subscriptions`
  ADD CONSTRAINT `push_subscriptions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `receivables`
--
ALTER TABLE `receivables`
  ADD CONSTRAINT `receivables_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `receivables_ibfk_2` FOREIGN KEY (`transaction_id`) REFERENCES `transactions` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `receivable_payments`
--
ALTER TABLE `receivable_payments`
  ADD CONSTRAINT `fk_receivable_payments_shift` FOREIGN KEY (`shift_id`) REFERENCES `cash_shifts` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `receivable_payments_ibfk_1` FOREIGN KEY (`receivable_id`) REFERENCES `receivables` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `stock_history`
--
ALTER TABLE `stock_history`
  ADD CONSTRAINT `stock_history_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `stock_opname_items`
--
ALTER TABLE `stock_opname_items`
  ADD CONSTRAINT `stock_opname_items_ibfk_1` FOREIGN KEY (`session_id`) REFERENCES `stock_opname_sessions` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `stock_opname_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`);

--
-- Constraints for table `transactions`
--
ALTER TABLE `transactions`
  ADD CONSTRAINT `fk_transactions_cashier` FOREIGN KEY (`cashier_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_transactions_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_transactions_shift` FOREIGN KEY (`shift_id`) REFERENCES `cash_shifts` (`id`);

--
-- Constraints for table `transaction_items`
--
ALTER TABLE `transaction_items`
  ADD CONSTRAINT `transaction_items_ibfk_1` FOREIGN KEY (`transaction_id`) REFERENCES `transactions` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `transaction_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`);

--
-- Constraints for table `void_requests`
--
ALTER TABLE `void_requests`
  ADD CONSTRAINT `void_requests_ibfk_1` FOREIGN KEY (`transaction_id`) REFERENCES `transactions` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `void_requests_ibfk_2` FOREIGN KEY (`requested_by_user_id`) REFERENCES `users` (`id`),
  ADD CONSTRAINT `void_requests_ibfk_3` FOREIGN KEY (`reviewed_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
