$modules = [ordered]@{
    "tests/services/journalService.test.js"     = "journalService (Jurnal Akuntansi)"
    "tests/services/transactionService.test.js" = "transactionService (Checkout & Void)"
    "tests/services/purchaseService.test.js"    = "purchaseService (Pembelian)"
    "tests/services/productService.test.js"     = "productService (Produk & Stok)"
    "tests/services/payableService.test.js"     = "payableService (Hutang & Pelunasan)"
    "tests/services/settingService.test.js"     = "settingService (Login & Sesi)"
    "tests/middleware/auth.test.js"             = "middleware/auth (Token & Role)"
}

$tab = [char]9

Write-Host ("Modul Testing" + $tab + "Jumlah Pengujian" + $tab + "Waktu" + $tab + "Heap Memory" + $tab + "Status")

foreach ($file in $modules.Keys) {
    if (-not (Test-Path $file)) {
        Write-Host ($modules[$file] + $tab + "-" + $tab + "-" + $tab + "-" + $tab + "FILE NOT FOUND: $file")
        continue
    }

    $lines = $null
    $elapsed = Measure-Command {
        $lines = & npx jest $file --logHeapUsage --runInBand --colors=false 2>&1
    }
    $time = "{0:N2}" -f $elapsed.TotalSeconds

    $count = ""
    $testsLine = $lines | Where-Object { $_ -match "Tests:" } | Select-Object -First 1
    if ($testsLine -match "([0-9]+) passed") { $count = $matches[1] }

    $heap = ""
    $passLine = $lines | Where-Object { $_ -match "PASS" } | Select-Object -First 1
    if ($passLine -match "([0-9.]+) MB heap size") { $heap = $matches[1] }

    $status = "OK"
    if ($lines -match "FAIL") { $status = "GAGAL" }

    Write-Host ($modules[$file] + $tab + $count + $tab + "$time detik" + $tab + "$heap MB" + $tab + $status)
}