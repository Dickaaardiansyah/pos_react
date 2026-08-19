#!/bin/bash
# Jalanin dari root project (folder yang ada package.json & folder tests/)
# Usage: bash run_test_summary.sh

declare -A modules=(
  ["tests/services/journalService.test.js"]="journalService (Jurnal Akuntansi)"
  ["tests/services/transactionService.test.js"]="transactionService (Checkout & Void)"
  ["tests/services/purchaseService.test.js"]="purchaseService (Pembelian)"
  ["tests/services/productService.test.js"]="productService (Produk & Stok)"
  ["tests/services/payableService.test.js"]="payableService (Hutang & Pelunasan)"
  ["tests/services/settingService.test.js"]="settingService (Login & Sesi)"
  ["tests/middleware/auth.test.js"]="middleware/auth (Token & Role)"
)

echo -e "Modul Testing\tJumlah Pengujian\tWaktu\tHeap Memory\tStatus"

for file in "${!modules[@]}"; do
  if [ ! -f "$file" ]; then
    echo -e "${modules[$file]}\t-\t-\t-\tFILE NOT FOUND ($file)"
    continue
  fi

  # jalankan jest untuk 1 file, simpan output mentah
  output=$(npx jest "$file" --verbose --logHeapUsage --runInBand --colors=false 2>&1)

  # jumlah test = hitung baris centang "✓"
  count=$(echo "$output" | grep -c "✓")

  # ambil baris "PASS ... (X s, Y MB heap size)"
  passline=$(echo "$output" | grep "PASS")
  time=$(echo "$passline" | grep -oP '\(\K[0-9.]+(?= s)')
  heap=$(echo "$passline" | grep -oP '[0-9.]+(?= MB heap size)')

  status="OK"
  echo "$output" | grep -q "FAIL" && status="GAGAL"

  echo -e "${modules[$file]}\t${count}\t${time} detik\t${heap} MB\t${status}"
done