// models/transactionModel.js
// ─────────────────────────────────────────────────────────────────────────────
// MODEL LAYER — akses data untuk transaksi penjualan & itemnya.
// Menyimpan snapshot cost_price di setiap item agar laporan Laba Rugi (HPP)
// tetap akurat walau harga modal produk berubah di kemudian hari.
// ─────────────────────────────────────────────────────────────────────────────
const { query, queryOne, transaction, safeInt } = require("../config/database");
const journalService = require("../services/journalService");

// Menentukan harga satuan yang benar-benar dipakai untuk suatu item: OTOMATIS
// berdasarkan jumlah beli dibanding min_qty_wholesale produk — bukan lagi
// pilihan manual kasir. Begitu quantity mencapai/melewati min_qty_wholesale
// DAN produk itu punya harga grosir, harga grosir otomatis dipakai. Kalau
// produk tidak punya harga grosir atau jumlah belum cukup, tetap pakai
// harga eceran. price_type yang DICATAT mengikuti harga yang benar-benar
// dipakai, supaya laporan tetap akurat.
/**
 * Harga satuan untuk 1 baris item keranjang.
 * - option null/base → harga produk (ecer/grosir berdasarkan qty dalam satuan dasar)
 * - option unit dengan price → harga per satuan itu
 * - option unit tanpa price → price dasar × conversion
 * - option variant → harga varian
 *
 * Grosir dinilai terhadap qty "efektif":
 *   - unit tambahan: quantity (jumlah karung / ¼ kg)
 *   - satuan dasar: quantity (= qty_in_base)
 * min_qty_wholesale pada product_units / variants / products.
 */
function resolveItemPrice(product, quantity, option = null) {
  //Menentukan harga satuan (unit price) yang harus dipakai untuk sebuah item, berdasarkan jumlah yang dibeli dan opsi yang dipilih (varian / satuan).
  const qty = Number(quantity) || 0;

  if (option && option.type === "variant") {
    const retail = parseFloat(option.price); // Harga eceran varian
    const wholesale = parseFloat(option.priceWholesale); // Harga grosir varian
    const minQty = parseInt(option.minQtyWholesale, 10); // Minimal qty untuk dapat harga grosir
    if (wholesale > 0 && minQty > 0 && qty >= minQty) {
      return { unitPrice: wholesale, priceType: "wholesale" };
    }
    return { unitPrice: retail, priceType: "retail" };
  }

  if (option && option.type === "unit" && !option.isBase) {
    const factor = Number(option.conversionQty) || 1;
    let retail = parseFloat(option.price);
    if (!retail || retail <= 0) {
      retail = parseFloat(product.price) * factor;
    }
    let wholesale = parseFloat(option.priceWholesale);
    const minQty = parseInt(option.minQtyWholesale, 10);
    if (wholesale > 0 && minQty > 0 && qty >= minQty) {
      return { unitPrice: wholesale, priceType: "wholesale" };
    }
    // Fallback grosir dari harga dasar × factor jika unit tidak punya harga grosir sendiri
    if ((!wholesale || wholesale <= 0) && product.price_wholesale) {
      const baseMin = parseInt(product.min_qty_wholesale, 10);
      const qtyInBase = qty * factor;
      if (baseMin > 0 && qtyInBase >= baseMin) {
        return {
          unitPrice: parseFloat(product.price_wholesale) * factor,
          priceType: "wholesale",
        };
      }
    }
    return { unitPrice: retail, priceType: "retail" };
  }

  // Satuan dasar / tanpa opsi
  const wholesale = parseFloat(product.price_wholesale);
  const minQty = parseInt(product.min_qty_wholesale, 10);
  if (wholesale > 0 && minQty > 0 && qty >= minQty) {
    return { unitPrice: wholesale, priceType: "wholesale" };
  }
  return { unitPrice: parseFloat(product.price), priceType: "retail" };
}

/**
 * Normalisasi opsi dari payload checkout (frontend).
 *
 * PENTING (fix keamanan): hanya `type` dan `id` yang boleh dipercaya dari
 * request klien — keduanya cuma dipakai sebagai KUNCI untuk mengambil ulang
 * data asli (conversion_qty, price, price_wholesale, min_qty_wholesale) dari
 * tabel product_units / product_variants di database (lihat
 * resolveVerifiedOption()). Field harga/konversi yang dikirim langsung oleh
 * klien (option.price, option.conversion_qty, dst.) TIDAK PERNAH dipakai
 * lagi untuk menghitung transaksi — sebelumnya field-field itu dipercaya apa
 * adanya sehingga klien bisa mengirim harga/konversi sembarang dan lolos
 * validasi (mis. conversion_qty 0.001 & price 1).
 */
function normalizeOption(raw) {
  if (!raw || raw.type === "none" || !raw.type) {
    return { type: "none", id: null, label: null, isBase: true };
  }
  const type = raw.type === "variant" ? "variant" : "unit";
  const id =
    raw.id != null && raw.id !== "" && Number.isFinite(Number(raw.id))
      ? Number(raw.id)
      : null;
  // Satuan dasar produk = type "unit" tanpa id (bukan baris product_units).
  // isBase TIDAK lagi bisa diklaim sendiri oleh klien (dulu `raw.isBase`
  // dipercaya mentah-mentah) — kalau id ada, opsi WAJIB diverifikasi ke DB.
  const isBase = type === "unit" && id == null;
  return { type, id, label: raw.label || null, isBase };
}

/**
 * Mengambil ulang data ASLI sebuah opsi (satuan tambahan / varian) dari
 * database, di dalam koneksi transaksi (conn) yang sama dengan penguncian
 * baris produk (FOR UPDATE) — supaya harga & faktor konversi yang dipakai
 * untuk menghitung total belanja SELALU berasal dari data tersimpan di
 * server, bukan dari input klien. Melempar error kalau opsi tidak ditemukan
 * atau tidak benar-benar milik produk tersebut (mencegah id opsi produk lain
 * dipakai untuk memalsukan harga/konversi produk target).
 */
async function resolveVerifiedOption(option, product, conn) {
  if (option.type === "none" || option.isBase) {
    // Satuan dasar produk: harga & konversi selalu dari tabel products,
    // faktor konversi selalu 1 — tidak ada input klien yang dipakai di sini.
    return {
      type: "none",
      id: null,
      label: product.unit || null,
      conversionQty: 1,
      isBase: true,
      price: null,
      priceWholesale: null,
      minQtyWholesale: null,
    };
  }

  if (option.type === "unit") {
    if (!option.id) throw new Error("Opsi satuan tidak valid");
    const [rows] = await conn.execute(
      `SELECT pu.id, pu.conversion_qty, pu.price, pu.price_wholesale,
              pu.min_qty_wholesale, pu.purchase_only, u.name AS unit_name
       FROM product_units pu
       JOIN units u ON u.id = pu.unit_id
       WHERE pu.id = ? AND pu.product_id = ?`,
      [option.id, product.id],
    );
    const pu = rows[0];
    if (!pu)
      throw new Error(
        `Satuan tidak ditemukan/tidak sesuai untuk produk ${product.name}`,
      );
    if (pu.purchase_only)
      throw new Error(
        `Satuan "${pu.unit_name}" hanya untuk pembelian, tidak bisa dijual`,
      );
    const conversionQty = Number(pu.conversion_qty);
    if (!Number.isFinite(conversionQty) || conversionQty <= 0) {
      throw new Error(`Faktor konversi satuan "${pu.unit_name}" tidak valid`);
    }
    return {
      type: "unit",
      id: pu.id,
      label: pu.unit_name,
      conversionQty,
      isBase: false,
      price: pu.price != null ? Number(pu.price) : null,
      priceWholesale:
        pu.price_wholesale != null ? Number(pu.price_wholesale) : null,
      minQtyWholesale:
        pu.min_qty_wholesale != null ? Number(pu.min_qty_wholesale) : null,
    };
  }

  // option.type === "variant"
  if (!option.id) throw new Error("Opsi varian tidak valid");
  const [rows] = await conn.execute(
    `SELECT id, name, price, price_wholesale, min_qty_wholesale
     FROM product_variants WHERE id = ? AND product_id = ?`,
    [option.id, product.id],
  );
  const pv = rows[0];
  if (!pv)
    throw new Error(
      `Varian tidak ditemukan/tidak sesuai untuk produk ${product.name}`,
    );
  return {
    type: "variant",
    id: pv.id,
    label: pv.name,
    conversionQty: 1,
    isBase: false,
    price: Number(pv.price),
    priceWholesale:
      pv.price_wholesale != null ? Number(pv.price_wholesale) : null,
    minQtyWholesale:
      pv.min_qty_wholesale != null ? Number(pv.min_qty_wholesale) : null,
  };
}

const transactionModel = {
  //awal dari proses create penjualan (checkout)
  /**
   * Menjalankan seluruh proses checkout dalam satu transaksi DB:
   * validasi stok, kunci baris produk, insert header + item, update stok,
   * catat riwayat stok. `items` = [{ product_id, quantity }]
   */
  async createSale({
    items,
    paymentMethod,
    paymentAmount,
    customerName,
    customerId,
    cashierName,
    cashierId,
    shiftId,
    discountAmount,
    notes,
    transactionCode,
    occurredAt,
    openBill, // { invoiceCode, dueDate, invoiceDate } — hanya diisi jika paymentMethod === 'open_bill'
  }) {
    return transaction(async (conn) => {
      const productCache = {};
      // Tahap 1: hanya baca & validasi bentuk input mentah dari klien
      // (product_id, quantity, jenis & id opsi). BELUM ada angka harga atau
      // faktor konversi yang dipakai di sini — itu baru diambil dari DB pada
      // tahap berikutnya, setelah baris produk dikunci.
      const prepared = items.map((item) => {
        const quantity = Number(item.quantity);
        if (!Number.isFinite(quantity) || quantity <= 0) {
          throw new Error("Jumlah item tidak valid");
        }
        const option = normalizeOption(
          item.option || {
            type: item.option_type,
            id: item.option_id,
            label: item.option_label,
          },
        );
        return { item, quantity, option };
      });

      for (const row of prepared) {
        const pid = row.item.product_id;
        if (!productCache[pid]) {
          const [rows] = await conn.execute(
            "SELECT * FROM products WHERE id = ? AND is_active = 1 FOR UPDATE",
            [pid],
          );
          const product = rows[0];
          if (!product) throw new Error(`Produk ID ${pid} tidak ditemukan`);
          productCache[pid] = product;
        }
      }

      // Tahap 2 (FIX KEAMANAN): ambil ulang data opsi (satuan tambahan /
      // varian) dari database — conversion_qty, price, price_wholesale,
      // min_qty_wholesale SELALU dari sini, bukan dari payload klien. Baru
      // setelah ini qty_in_base dihitung, memakai faktor konversi yang sudah
      // terverifikasi milik produk yang benar.
      for (const row of prepared) {
        const product = productCache[row.item.product_id];
        row.option = await resolveVerifiedOption(row.option, product, conn);
        const factor = row.option.conversionQty;
        row.qtyInBase = Math.round(row.quantity * factor * 1000) / 1000; // 3 desimal
      }

      // Agregasi kebutuhan stok per produk (beberapa baris bisa produk sama, satuan beda)
      const needByProduct = {};
      for (const row of prepared) {
        const pid = row.item.product_id;
        needByProduct[pid] = (needByProduct[pid] || 0) + row.qtyInBase;
      }
      for (const [pid, need] of Object.entries(needByProduct)) {
        const product = productCache[pid];
        const stock = Number(product.stock);
        if (stock < need - 0.0005) {
          const needClean = Math.round(need * 1000) / 1000;
          const stockClean = Math.round(stock * 1000) / 1000;
          throw new Error(
            `Stok ${product.name} tidak mencukupi. Butuh ${needClean} ${product.unit || ""}, tersedia: ${stockClean}`,
          );
        }
      }

      let totalAmount = 0;
      for (const row of prepared) {
        const product = productCache[row.item.product_id];
        const { unitPrice } = resolveItemPrice(
          product,
          row.quantity,
          row.option,
        );
        totalAmount += unitPrice * row.quantity;
      }

      // FIX KEAMANAN/INTEGRITAS DATA (review dosen — diskon bisa membuat
      // transaksi bernilai negatif): sebelumnya discount_amount dipakai apa
      // adanya tanpa batas bawah/atas. Diskon > subtotal menghasilkan
      // final_amount negatif, yang lolos validasi pembayaran (paid ==
      // finalAmount saat paymentAmount tidak dikirim) dan ikut diposting ke
      // jurnal (journalService.postSaleJournal) sebagai baris DEBIT NEGATIF
      // pada akun Kas — secara matematis jurnal tetap "balance" (postEntry
      // hanya mengecek total debit = total kredit), tapi isinya korup: debit
      // negatif = kredit terselubung yang mengubah saldo Kas tanpa transaksi
      // kas yang benar-benar terjadi.
      const discount = parseFloat(discountAmount) || 0;
      if (discount < 0) {
        throw new Error("Diskon tidak boleh bernilai negatif");
      }
      if (discount > totalAmount) {
        throw new Error("Diskon tidak boleh melebihi subtotal transaksi");
      }
      const finalAmount = totalAmount - discount;
      const isOpenBill = paymentMethod === "open_bill";

      // Open Bill: pembayaran di kasir bersifat DP (boleh 0 s/d total, sisanya
      // jadi piutang). Metode lain: harus dibayar lunas di kasir seperti biasa.
      const paid = isOpenBill
        ? Math.min(parseFloat(paymentAmount) || 0, finalAmount)
        : parseFloat(paymentAmount) || finalAmount;
      const change = isOpenBill ? 0 : paid - finalAmount;
      if (!isOpenBill && paid < finalAmount)
        throw new Error("Jumlah pembayaran kurang dari total");
      if (isOpenBill && parseFloat(paymentAmount) > finalAmount)
        throw new Error("Jumlah DP tidak boleh melebihi total tagihan");
      if (isOpenBill && !customerName)
        throw new Error("Pelanggan wajib dipilih untuk transaksi Open Bill");

      const [txResult] = await conn.execute(
        `INSERT INTO transactions
           (transaction_code, total_amount, discount_amount, tax_amount, final_amount,
            payment_method, payment_amount, change_amount, customer_name, customer_id, cashier_name, cashier_id, shift_id, notes, status, created_at)
         VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?)`,
        [
          transactionCode,
          totalAmount,
          discount,
          finalAmount,
          paymentMethod || "cash",
          paid,
          change,
          customerName || "",
          customerId || null,
          cashierName || "Kasir",
          cashierId || null,
          shiftId || null,
          notes || "",
          occurredAt,
        ],
      );

      const transactionId = txResult.insertId;
      const insertedItems = [];

      for (const row of prepared) {
        const product = productCache[row.item.product_id];
        const { quantity, option, qtyInBase } = row;
        const { unitPrice, priceType } = resolveItemPrice(
          product,
          quantity,
          option,
        );
        const subtotal = unitPrice * quantity;
        const prevStock = Number(product.stock);
        const newStock = Math.round((prevStock - qtyInBase) * 1000) / 1000;

        // unit_cost = modal per 1 qty baris (cost dasar × conversion)
        // supaya laporan yang pakai unit_cost * quantity tetap = HPP benar
        const costPerBase = parseFloat(product.cost_price) || 0;
        const unitCost =
          Math.round(costPerBase * (Number(option.conversionQty) || 1) * 100) /
          100;

        const optionType =
          option.type === "unit" || option.type === "variant"
            ? option.type
            : "none";
        const optionLabel =
          option.label || (optionType === "none" ? product.unit || null : null);

        await conn.execute(
          `INSERT INTO transaction_items
             (transaction_id, product_id, product_name, product_barcode, quantity,
              unit_price, price_type, option_type, option_id, option_label, conversion_qty,
              unit_cost, discount, subtotal, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
          [
            transactionId,
            product.id,
            product.name,
            product.barcode,
            quantity,
            unitPrice,
            priceType,
            optionType,
            option.id,
            optionLabel,
            Number(option.conversionQty) || 1,
            unitCost,
            subtotal,
            occurredAt,
          ],
        );

        await conn.execute("UPDATE products SET stock = ? WHERE id = ?", [
          newStock,
          product.id,
        ]);
        product.stock = newStock; // update cache jika produk muncul lagi di baris berikutnya

        await conn.execute(
          `INSERT INTO stock_history (product_id, type, quantity, previous_stock, new_stock, reference, notes, created_by)
           VALUES (?, 'out', ?, ?, ?, ?, ?, ?)`,
          [
            product.id,
            qtyInBase,
            prevStock,
            newStock,
            transactionCode,
            optionLabel ? `Terjual (${quantity} ${optionLabel})` : "Terjual",
            cashierName || "Kasir",
          ],
        );

        insertedItems.push({
          product_id: product.id,
          product_name: product.name,
          product_barcode: product.barcode,
          quantity,
          unit_price: unitPrice,
          price_type: priceType,
          option_type: optionType,
          option_id: option.id,
          option_label: optionLabel,
          conversion_qty: Number(option.conversionQty) || 1,
          unit_cost: unitCost,
          subtotal,
          unit: optionLabel || product.unit || "pcs",
        });
      }

      let receivable = null;
      if (isOpenBill && openBill) {
        // Sisa piutang = total tagihan - DP yang sudah dibayar di kasir.
        // Faktur langsung masuk ke daftar Open Bill (Piutang), tertaut ke
        // transaction_id ini, dalam transaksi DB yang sama dengan penjualan
        // & pengurangan stok — supaya tidak ada faktur yang "hilang" kalau
        // salah satu langkah gagal.
        const status =
          paid >= finalAmount ? "lunas" : paid > 0 ? "sebagian" : "belum_lunas";
        const [recResult] = await conn.execute(
          `INSERT INTO receivables
             (invoice_code, customer_id, customer_name, transaction_id, amount, paid_amount,
              invoice_date, due_date, status, notes, recorded_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            openBill.invoiceCode,
            customerId || null,
            customerName,
            transactionId,
            finalAmount,
            paid,
            openBill.invoiceDate,
            openBill.dueDate,
            status,
            `Open Bill dari transaksi ${transactionCode}`,
            cashierName || "Kasir",
          ],
        );
        receivable = {
          id: recResult.insertId,
          invoice_code: openBill.invoiceCode,
          amount: finalAmount,
          paid_amount: paid,
          due_date: openBill.dueDate,
          status,
        };
      }

      const sale = {
        id: transactionId,
        transaction_code: transactionCode,
        total_amount: totalAmount,
        discount_amount: discount,
        tax_amount: 0,
        final_amount: finalAmount,
        payment_method: paymentMethod || "cash",
        payment_amount: paid,
        change_amount: change,
        customer_name: customerName || "",
        customer_id: customerId || null,
        cashier_name: cashierName || "Kasir",
        notes: notes || "",
        status: "completed",
        receivable,
        created_at: occurredAt,
        items: insertedItems,
      };

      // Posting jurnal otomatis (Dr Kas/Bank + Diskon, Cr Penjualan; Dr HPP,
      // Cr Persediaan) — dijalankan di koneksi transaksi (conn) yang sama
      // dengan insert penjualan/stok/piutang di atas. Kalau ini gagal
      // (mis. akun sistem hilang, jurnal tidak balance), seluruh transaksi
      // ikut di-rollback oleh transaction() — tidak ada lagi kasus checkout
      // sukses tapi jurnalnya hilang.
      await journalService.postSaleJournal(sale, conn);

      return sale;
    });
  },

  // Riwayat Transaksi TIDAK menampilkan transaksi Open Bill — transaksi ini
  // sudah punya tempatnya sendiri di halaman Piutang/Open Bill (tabel
  // receivables), jadi tidak perlu dobel muncul di daftar riwayat transaksi
  // biasa. Transaksi tetap tersimpan penuh di tabel `transactions` (stok,
  // jurnal, dsb tetap jalan seperti biasa) — hanya query LIST ini yang
  // menyaringnya keluar.
  // `status` default tetap 'completed' (perilaku lama, dipakai semua laporan
  // & dashboard) — kirim status = 'cancelled' atau 'all' dari Riwayat
  // Transaksi kalau admin ingin melihat/mengaudit transaksi yang dibatalkan.
  findAll({
    startDate,
    endDate,
    paymentMethod,
    status,
    cashierName,
    limit,
    offset,
  }) {
    let where = "WHERE t.payment_method != 'open_bill'";
    const params = [];
    if (!status || status === "completed") {
      where += " AND t.status = 'completed'";
    } else if (status !== "all") {
      where += " AND t.status = ?";
      params.push(status);
    }
    if (startDate) {
      where += " AND DATE(t.created_at) >= ?";
      params.push(startDate);
    }
    if (endDate) {
      where += " AND DATE(t.created_at) <= ?";
      params.push(endDate);
    }
    if (paymentMethod) {
      where += " AND t.payment_method = ?";
      params.push(paymentMethod);
    }
    if (cashierName) {
      where += " AND t.cashier_name = ?";
      params.push(cashierName);
    }

    return Promise.all([
      query(
        `SELECT COUNT(*) AS total, COALESCE(SUM(t.final_amount), 0) AS total_revenue
         FROM transactions t ${where}`,
        params,
      ).then((r) => ({
        total: r[0]?.total || 0,
        totalRevenue: Number(r[0]?.total_revenue || 0),
      })),
      query(
        `SELECT t.*,
                (SELECT vr.id FROM void_requests vr
                  WHERE vr.transaction_id = t.id AND vr.status = 'pending'
                  ORDER BY vr.id DESC LIMIT 1) AS pending_void_request_id
         FROM transactions t ${where} ORDER BY t.created_at DESC LIMIT ${safeInt(limit, 50)} OFFSET ${safeInt(offset, 0)}`,
        params,
      ),
    ]).then(([{ total, totalRevenue }, rows]) => ({
      total,
      totalRevenue,
      rows,
    }));
  },

  listCashiers() {
    return query(
      `SELECT DISTINCT cashier_name FROM transactions
       WHERE cashier_name IS NOT NULL AND cashier_name != ''
       ORDER BY cashier_name ASC`,
    ).then((rows) => rows.map((r) => r.cashier_name));
  },

  paymentMethodReport(startDate, endDate) {
    let where =
      "WHERE t.status = 'completed' AND t.payment_method != 'open_bill'";
    const params = [];
    if (startDate) {
      where += " AND DATE(t.created_at) >= ?";
      params.push(startDate);
    }
    if (endDate) {
      where += " AND DATE(t.created_at) <= ?";
      params.push(endDate);
    }
    return query(
      `SELECT t.payment_method,
              COUNT(*) AS transaction_count,
              COALESCE(SUM(t.final_amount), 0) AS total_amount,
              COALESCE(SUM(t.discount_amount), 0) AS total_discount,
              COALESCE(AVG(t.final_amount), 0) AS avg_amount
       FROM transactions t
       ${where}
       GROUP BY t.payment_method
       ORDER BY total_amount DESC`,
      params,
    );
  },

  voidReport(startDate, endDate, cashierName) {
    let where = "WHERE t.status = 'cancelled'";
    const params = [];
    if (startDate) {
      where += " AND DATE(COALESCE(t.voided_at, t.created_at)) >= ?";
      params.push(startDate);
    }
    if (endDate) {
      where += " AND DATE(COALESCE(t.voided_at, t.created_at)) <= ?";
      params.push(endDate);
    }
    if (cashierName) {
      where += " AND t.cashier_name = ?";
      params.push(cashierName);
    }
    return query(
      `SELECT t.id, t.transaction_code, t.created_at, t.voided_at, t.voided_by,
              t.void_reason, t.cashier_name, t.customer_name, t.payment_method,
              t.final_amount, t.total_amount, t.discount_amount
       FROM transactions t
       ${where}
       ORDER BY COALESCE(t.voided_at, t.created_at) DESC`,
      params,
    );
  },

  findById(id) {
    return queryOne(
      `SELECT t.*,
              (SELECT vr.id FROM void_requests vr
                WHERE vr.transaction_id = t.id AND vr.status = 'pending'
                ORDER BY vr.id DESC LIMIT 1) AS pending_void_request_id
       FROM transactions t WHERE t.id = ?`,
      [id],
    );
  },

  findItemsByTransactionId(id) {
    return query(
      `SELECT ti.*, p.unit FROM transaction_items ti LEFT JOIN products p ON ti.product_id = p.id WHERE ti.transaction_id = ?`,
      [id],
    );
  },

  // ─── Batal (Void) Transaksi ─────────────────────────────────────────────
  // Kebalikan dari createSale(): dalam SATU DB transaction yang sama —
  //   1) kunci baris transaksi (FOR UPDATE) & pastikan masih 'completed'
  //      (mencegah dua permintaan void nyaris bersamaan diproses dobel),
  //   2) kembalikan stok setiap item + catat stock_history type 'in',
  //   3) kalau Open Bill: batalkan piutang terkait (status → 'dibatalkan'),
  //   4) posting jurnal KOREKSI pembalik (lihat journalService.postVoidSaleJournal
  //      — jurnal penjualan asli TIDAK dihapus, tetap jadi jejak audit),
  //   5) tandai transaksi 'cancelled' + isi voided_at/voided_by/void_reason.
  // Kalau salah satu langkah gagal, semuanya rollback bersama — tidak ada
  // lagi kondisi stok sudah balik tapi jurnal/piutang belum, atau sebaliknya.
  //
  // Catatan scope (sengaja dibatasi untuk versi pertama fitur ini):
  //   • Piutang Open Bill yang SUDAH dicicil melebihi DP awal saat checkout
  //     tidak bisa di-void otomatis — harus ditangani manual dulu (mis.
  //     refund cicilan lewat modul Piutang), karena sistem tidak tahu cara
  //     mengembalikan uang tunai yang sudah diterima dari pelanggan.
  async voidTransaction(id, { reason, voidedBy }) {
    return transaction(async (conn) => {
      const [rows] = await conn.execute(
        "SELECT * FROM transactions WHERE id = ? FOR UPDATE",
        [id],
      );
      const tx = rows[0];
      if (!tx) throw new Error("Transaksi tidak ditemukan");
      if (tx.status === "cancelled")
        throw new Error("Transaksi ini sudah dibatalkan sebelumnya");
      if (tx.status !== "completed")
        throw new Error(
          `Transaksi berstatus '${tx.status}' tidak dapat dibatalkan`,
        );

      const [items] = await conn.execute(
        "SELECT * FROM transaction_items WHERE transaction_id = ?",
        [id],
      );

      // 2) Kembalikan stok tiap item — qty_in_base = quantity × conversion_qty,
      // simetris dengan pengurangan stok saat checkout (lihat createSale()).
      for (const item of items) {
        const [productRows] = await conn.execute(
          "SELECT id, stock FROM products WHERE id = ? FOR UPDATE",
          [item.product_id],
        );
        const product = productRows[0];
        if (!product) continue; // produk mungkin sudah dihapus — lewati, jangan gagalkan seluruh void

        const qtyInBase =
          Number(item.quantity) * (Number(item.conversion_qty) || 1);
        const prevStock = Number(product.stock);
        const newStock = Math.round((prevStock + qtyInBase) * 1000) / 1000;

        await conn.execute("UPDATE products SET stock = ? WHERE id = ?", [
          newStock,
          product.id,
        ]);

        await conn.execute(
          `INSERT INTO stock_history (product_id, type, quantity, previous_stock, new_stock, reference, notes, created_by)
           VALUES (?, 'in', ?, ?, ?, ?, ?, ?)`,
          [
            product.id,
            qtyInBase,
            prevStock,
            newStock,
            tx.transaction_code,
            `Retur — pembatalan transaksi ${tx.transaction_code}${reason ? `: ${reason}` : ""}`,
            voidedBy || "Admin",
          ],
        );
      }

      // 3) Open Bill → batalkan piutang terkait (kalau ada dan belum dicicil
      // lebih dari DP awal).
      const [receivableRows] = await conn.execute(
        "SELECT * FROM receivables WHERE transaction_id = ? FOR UPDATE",
        [id],
      );
      const receivable = receivableRows[0];
      if (receivable) {
        if (
          receivable.status === "lunas" ||
          receivable.status === "dibatalkan"
        ) {
          // Piutang sudah lunas (dibayar penuh via cicilan) atau sudah
          // dibatalkan sebelumnya — di luar cakupan void otomatis.
          throw new Error(
            "Piutang Open Bill dari transaksi ini sudah lunas/dibatalkan — tidak dapat divoid otomatis, tangani manual lewat modul Piutang",
          );
        }
        if (Number(receivable.paid_amount) > Number(tx.payment_amount)) {
          throw new Error(
            "Piutang Open Bill sudah menerima pembayaran cicilan tambahan setelah transaksi ini — batalkan/refund cicilan tersebut dulu lewat modul Piutang sebelum void",
          );
        }
        await conn.execute(
          "UPDATE receivables SET status = 'dibatalkan' WHERE id = ?",
          [receivable.id],
        );
      }

      // 4) Jurnal koreksi pembalik — dijalankan di koneksi transaksi yang
      // sama, sehingga kalau gagal (mis. jurnal tidak balance), seluruh
      // pembatalan (stok, piutang) ikut rollback.
      const txWithItems = { ...tx, items, voided_by: voidedBy || "Admin" };
      await journalService.postVoidSaleJournal(txWithItems, reason, conn);

      // 5) Tandai transaksi dibatalkan.
      await conn.execute(
        `UPDATE transactions
           SET status = 'cancelled', voided_at = NOW(), voided_by = ?, void_reason = ?
         WHERE id = ?`,
        [voidedBy || "Admin", reason || "", id],
      );

      return {
        id: tx.id,
        transaction_code: tx.transaction_code,
        status: "cancelled",
        voided_by: voidedBy || "Admin",
        void_reason: reason || "",
      };
    });
  },

  // ─── Laporan penjualan ──────────────────────────────────────────────────
  salesGroupedByPeriod(period, startDate, endDate) {
    const groupExpr =
      period === "weekly"
        ? "DATE_FORMAT(t.created_at, '%Y-W%u')"
        : period === "monthly"
          ? "DATE_FORMAT(t.created_at, '%Y-%m')"
          : "DATE(t.created_at)";
    return query(
      `SELECT ${groupExpr} AS period,
              COUNT(DISTINCT t.id)   AS transaction_count,
              SUM(t.final_amount)    AS revenue,
              AVG(t.final_amount)    AS avg_transaction,
              SUM(t.discount_amount) AS total_discount,
              SUM(t.payment_method = 'cash')  AS cash_count,
              SUM(t.payment_method = 'debit') AS debit_count,
              SUM(t.payment_method = 'qris')  AS qris_count
       FROM transactions t
       WHERE DATE(t.created_at) BETWEEN ? AND ? AND t.status = 'completed'
       GROUP BY ${groupExpr} ORDER BY period ASC`,
      [startDate, endDate],
    );
  },

  // total_qty_sold  = SUM(ti.quantity)                    → "berapa kali/baris terjual"
  //                    (mis. 1× opsi ½kg + 1× opsi ¼kg = 2 baris)
  // total_qty_base  = SUM(ti.quantity * ti.conversion_qty) → qty dalam satuan dasar produk
  //                    (mis. 1× ½kg + 1× ¼kg = 0.75 kg) — inilah "Qty" yang benar
  //                    untuk barang curah/pecahan. conversion_qty default 1 untuk
  //                    produk selection_type='none', jadi kedua angka sama untuk
  //                    produk yang tidak pakai opsi satuan.
  // base_unit       = satuan dasar produk (p.unit), untuk label di laporan.
  topProducts(startDate, endDate, limit = 20) {
    return query(
      `SELECT p.name, p.barcode, p.unit AS base_unit, COALESCE(c.name,'Lainnya') AS category,
              SUM(ti.quantity) AS total_qty_sold,
              SUM(ti.quantity * ti.conversion_qty) AS total_qty_base,
              SUM(ti.subtotal) AS total_revenue
       FROM transaction_items ti
       JOIN products p ON ti.product_id = p.id
       LEFT JOIN categories c ON p.category_id = c.id
       JOIN transactions t ON ti.transaction_id = t.id
       WHERE DATE(t.created_at) BETWEEN ? AND ? AND t.status = 'completed'
       GROUP BY p.id ORDER BY total_revenue DESC LIMIT ${safeInt(limit, 20)}`,
      [startDate, endDate],
    );
  },

  // Rata-rata penjualan harian per produk dalam N hari terakhir, dalam
  // satuan dasar (qty x conversion_qty — sama seperti total_qty_base di
  // topProducts). Dipakai sebagai variabel "d" pada rumus Reorder Point:
  //   d = rata-rata penjualan harian
  //   SS = HC x d
  //   ROP = (d x LT) + SS
  // Dibagi dengan jumlah hari TETAP (bukan "hari yang ada transaksi") supaya
  // produk yang jarang terjual tidak diproyeksikan seolah selalu laku setiap
  // hari — konsisten dengan asumsi rumus di Bab 2 (penjualan harian rata-rata
  // dihitung atas periode kalender, bukan hanya hari-hari yang ada penjualan.
  avgDailySalesByProduct(days = 30) {
    return query(
      `SELECT ti.product_id,
              SUM(ti.quantity * ti.conversion_qty) / ? AS avg_daily_qty
       FROM transaction_items ti
       JOIN transactions t ON ti.transaction_id = t.id
       WHERE t.status = 'completed'
         AND t.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY ti.product_id`,
      [days, days],
    );
  },

  // Dipakai untuk pemilihan periode ROP otomatis ("Opsi A" — lihat
  // productService.pickReorderWindow): berapa hari sejak transaksi
  // (completed) PALING AWAL sampai hari ini. Kalau toko belum pernah
  // transaksi sama sekali, hasilnya 0 (belum ada data untuk dihitung).
  async getSalesHistorySpanDays() {
    const row = await queryOne(
      `SELECT DATEDIFF(CURDATE(), MIN(DATE(t.created_at))) + 1 AS days
       FROM transactions t
       WHERE t.status = 'completed'`,
    );
    const days = row ? Number(row.days) : 0;
    return Number.isFinite(days) && days > 0 ? days : 0;
  },

  // Catatan: agregasi di sini per KATEGORI, bukan per produk — satu kategori
  // bisa berisi produk dengan satuan dasar berbeda (mis. "Sembako" = kg & pcs
  // campur). Menjumlah qty_base lintas satuan berbeda tidak bermakna, jadi
  // qty di sini sengaja tetap "jumlah baris terjual" (qty_sold), BUKAN qty
  // dasar seperti topProducts/profitByProduct yang per-produk (satu satuan).
  revenueByCategory(startDate, endDate) {
    return query(
      `SELECT COALESCE(c.name,'Lainnya') AS category, SUM(ti.subtotal) AS revenue,
              SUM(ti.quantity) AS qty_sold
       FROM transaction_items ti
       JOIN products p ON ti.product_id = p.id
       LEFT JOIN categories c ON p.category_id = c.id
       JOIN transactions t ON ti.transaction_id = t.id
       WHERE DATE(t.created_at) BETWEEN ? AND ? AND t.status = 'completed'
       GROUP BY c.id ORDER BY revenue DESC`,
      [startDate, endDate],
    );
  },

  // ─── Laporan Penjualan Harian ───────────────────────────────────────────
  // Daftar SEMUA transaksi pada satu tanggal (termasuk yang dibatalkan, agar
  // kolom "Status Transaksi" berarti), lengkap dengan jumlah item & status
  // pembayaran (Open Bill ditautkan ke tabel receivables).
  dailySalesDetail(date) {
    return query(
      `SELECT
          t.id, t.transaction_code, t.created_at, t.cashier_name, t.customer_name,
          t.total_amount, t.discount_amount, t.tax_amount, t.final_amount,
          t.payment_method, t.payment_amount, t.status,
          COALESCE(ti.item_count, 0) AS item_count,
          COALESCE(ti.item_qty, 0) AS item_qty,
          r.status AS receivable_status
       FROM transactions t
       LEFT JOIN (
          SELECT transaction_id, COUNT(*) AS item_count, SUM(quantity) AS item_qty
          FROM transaction_items GROUP BY transaction_id
       ) ti ON ti.transaction_id = t.id
       LEFT JOIN receivables r ON r.transaction_id = t.id
       WHERE DATE(t.created_at) = ?
       ORDER BY t.created_at ASC`,
      [date],
    );
  },

  // Ringkasan atas HANYA menghitung transaksi berstatus 'completed' (uang
  // yang benar-benar masuk) — konsisten dengan salesSummary() di atas.
  dailySalesSummary(date) {
    return queryOne(
      `SELECT
          COUNT(*) AS total_transactions,
          COALESCE(SUM(iq.qty), 0) AS total_items_qty,
          COALESCE(SUM(t.total_amount), 0) AS gross_sales,
          COALESCE(SUM(t.discount_amount), 0) AS total_discount,
          COALESCE(SUM(t.tax_amount), 0) AS total_tax,
          COALESCE(SUM(t.final_amount), 0) AS net_sales
       FROM transactions t
       LEFT JOIN (
          SELECT transaction_id, SUM(quantity) AS qty
          FROM transaction_items GROUP BY transaction_id
       ) iq ON iq.transaction_id = t.id
       WHERE DATE(t.created_at) = ? AND t.status = 'completed'`,
      [date],
    );
  },

  salesSummary(startDate, endDate) {
    return queryOne(
      `SELECT COUNT(*) AS total_transactions, SUM(final_amount) AS total_revenue,
              AVG(final_amount) AS avg_transaction, MAX(final_amount) AS max_transaction,
              MIN(final_amount) AS min_transaction, SUM(discount_amount) AS total_discount
       FROM transactions WHERE DATE(created_at) BETWEEN ? AND ? AND status = 'completed'`,
      [startDate, endDate],
    );
  },

  // Total qty item terjual pada rentang tanggal — dipakai untuk menghitung
  // rata-rata jumlah item per transaksi (bukan rata-rata nominal Rupiah).
  itemsQtySummary(startDate, endDate) {
    return queryOne(
      `SELECT COALESCE(SUM(ti.quantity), 0) AS total_items_qty
       FROM transaction_items ti
       JOIN transactions t ON ti.transaction_id = t.id
       WHERE DATE(t.created_at) BETWEEN ? AND ? AND t.status = 'completed'`,
      [startDate, endDate],
    );
  },

  // ─── Laporan Penjualan berdasarkan Pelanggan ───────────────────────────
  // Semua transaksi tanpa pelanggan terdaftar (customer_id NULL — dijual ke
  // pelanggan umum/walk-in) digabung jadi satu baris "Pelanggan Umum",
  // supaya tidak pecah jadi banyak baris hanya karena nama yang diketik
  // kasir berbeda-beda. Pelanggan yang tercatat (customer_id terisi)
  // dikelompokkan per ID, bukan per nama, supaya tetap akurat walau nama
  // pelanggan diubah di kemudian hari.
  salesByCustomer(startDate, endDate) {
    return query(
      `SELECT
          CASE WHEN t.customer_id IS NULL THEN 0 ELSE t.customer_id END AS customer_id,
          CASE WHEN t.customer_id IS NULL THEN 'Pelanggan Umum' ELSE MAX(t.customer_name) END AS customer_name,
          COUNT(*) AS transaction_count,
          SUM(t.final_amount) AS total_revenue,
          SUM(t.discount_amount) AS total_discount,
          AVG(t.final_amount) AS avg_transaction,
          MAX(t.created_at) AS last_transaction_at
       FROM transactions t
       WHERE DATE(t.created_at) BETWEEN ? AND ? AND t.status = 'completed'
       GROUP BY CASE WHEN t.customer_id IS NULL THEN 0 ELSE t.customer_id END
       ORDER BY total_revenue DESC`,
      [startDate, endDate],
    );
  },

  // Qty & HPP per pelanggan — query terpisah dari salesByCustomer supaya
  // JOIN ke transaction_items (satu transaksi bisa banyak item) tidak
  // menggandakan SUM(final_amount) dkk. pada query header di atas.
  cogsByCustomer(startDate, endDate) {
    return query(
      `SELECT
          CASE WHEN t.customer_id IS NULL THEN 0 ELSE t.customer_id END AS customer_id,
          COALESCE(SUM(ti.quantity), 0) AS total_qty,
          COALESCE(SUM(ti.unit_cost * ti.quantity), 0) AS total_cogs
       FROM transaction_items ti
       JOIN transactions t ON ti.transaction_id = t.id
       WHERE DATE(t.created_at) BETWEEN ? AND ? AND t.status = 'completed'
       GROUP BY CASE WHEN t.customer_id IS NULL THEN 0 ELSE t.customer_id END`,
      [startDate, endDate],
    );
  },

  // ─── Laba per Produk — rincian keuntungan (pendapatan - HPP) per produk ───
  // HPP di sini memakai unit_cost yang tersimpan sebagai snapshot di setiap
  // transaction_items, yaitu harga modal (harga beli dari supplier) produk
  // pada saat transaksi terjadi — sehingga laporan tetap akurat walaupun
  // harga modal produk berubah di kemudian hari.
  profitByProduct(startDate, endDate) {
    return query(
      `SELECT p.id AS product_id, p.name, p.barcode, p.unit AS base_unit,
              COALESCE(c.name,'Lainnya') AS category,
              SUM(ti.quantity) AS total_qty_sold,
              SUM(ti.quantity * ti.conversion_qty) AS total_qty_base,
              SUM(ti.subtotal) AS total_revenue,
              SUM(ti.unit_cost * ti.quantity) AS total_cogs,
              SUM(ti.subtotal) - SUM(ti.unit_cost * ti.quantity) AS total_profit
       FROM transaction_items ti
       JOIN products p ON ti.product_id = p.id
       LEFT JOIN categories c ON p.category_id = c.id
       JOIN transactions t ON ti.transaction_id = t.id
       WHERE DATE(t.created_at) BETWEEN ? AND ? AND t.status = 'completed'
       GROUP BY p.id ORDER BY total_profit DESC`,
      [startDate, endDate],
    );
  },

  // ─── HPP (Harga Pokok Penjualan / COGS) untuk periode tertentu ─────────────
  costOfGoodsSold(startDate, endDate) {
    return queryOne(
      `SELECT COALESCE(SUM(ti.unit_cost * ti.quantity), 0) AS total_cogs,
              COALESCE(SUM(ti.quantity), 0) AS total_units_sold
       FROM transaction_items ti
       JOIN transactions t ON ti.transaction_id = t.id
       WHERE DATE(t.created_at) BETWEEN ? AND ? AND t.status = 'completed'`,
      [startDate, endDate],
    );
  },

  // ─── Dashboard ──────────────────────────────────────────────────────────
  dashboardToday() {
    return queryOne(`SELECT COALESCE(COUNT(*),0) AS tx_count, COALESCE(SUM(final_amount),0) AS revenue
                      FROM transactions WHERE DATE(created_at) = CURDATE() AND status = 'completed'`);
  },
  dashboardYesterday() {
    return queryOne(`SELECT COALESCE(COUNT(*),0) AS tx_count, COALESCE(SUM(final_amount),0) AS revenue
                      FROM transactions WHERE DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY) AND status = 'completed'`);
  },
  dashboardThisMonth() {
    return queryOne(`SELECT COALESCE(COUNT(*),0) AS tx_count, COALESCE(SUM(final_amount),0) AS revenue
                      FROM transactions WHERE YEAR(created_at) = YEAR(NOW()) AND MONTH(created_at) = MONTH(NOW()) AND status = 'completed'`);
  },
  // Minggu berjalan (Senin–Minggu, mengikuti standar ISO/lokal Indonesia).
  dashboardThisWeek() {
    return queryOne(`SELECT COALESCE(COUNT(*),0) AS tx_count, COALESCE(SUM(final_amount),0) AS revenue
                      FROM transactions
                      WHERE YEARWEEK(created_at, 1) = YEARWEEK(CURDATE(), 1) AND status = 'completed'`);
  },
  dashboardLast7Days() {
    return query(`SELECT DATE(created_at) AS date, COALESCE(COUNT(*),0) AS tx_count, COALESCE(SUM(final_amount),0) AS revenue
                   FROM transactions WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) AND status = 'completed'
                   GROUP BY DATE(created_at) ORDER BY date ASC`);
  },
  // Riwayat pendapatan/transaksi harian untuk rentang N hari terakhir — dipakai
  // oleh selector rentang waktu pada grafik dashboard (mis. 7/14/30 hari).
  dashboardRevenueHistory(days) {
    const safeDays = Number.isFinite(days) && days > 0 ? Math.floor(days) : 7;
    return query(
      `SELECT DATE(created_at) AS date, COALESCE(COUNT(*),0) AS tx_count, COALESCE(SUM(final_amount),0) AS revenue
       FROM transactions WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) AND status = 'completed'
       GROUP BY DATE(created_at) ORDER BY date ASC`,
      [safeDays],
    );
  },
  // Riwayat pendapatan/transaksi harian untuk rentang tanggal BEBAS (custom
  // range, tahun tertentu, dsb) — dipakai oleh filter tanggal fleksibel pada
  // dashboard (beda dengan dashboardRevenueHistory yang selalu N hari terakhir
  // dari hari ini).
  revenueHistoryRange(startDate, endDate) {
    return query(
      `SELECT DATE(created_at) AS date, COALESCE(COUNT(*),0) AS tx_count, COALESCE(SUM(final_amount),0) AS revenue
       FROM transactions WHERE DATE(created_at) BETWEEN ? AND ? AND status = 'completed'
       GROUP BY DATE(created_at) ORDER BY date ASC`,
      [startDate, endDate],
    );
  },
};

module.exports = transactionModel;
