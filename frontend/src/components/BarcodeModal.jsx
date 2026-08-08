// src/components/BarcodeModal.jsx
// Cetak label barcode produk — satu produk atau banyak sekaligus
// Menggunakan JsBarcode (diload dinamis via CDN, tidak perlu install npm)

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Printer, Minus, Plus, ChevronDown, Package, CheckSquare, Square } from 'lucide-react';
import { formatRupiah } from '../utils/format';

// ─── Load JsBarcode sekali dari CDN ──────────────────────────────────────────
let jsBarcodeLoaded = false;
function loadJsBarcode() {
  return new Promise((resolve) => {
    if (jsBarcodeLoaded || window.JsBarcode) { jsBarcodeLoaded = true; resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js';
    script.onload = () => { jsBarcodeLoaded = true; resolve(); };
    script.onerror = () => resolve(); // graceful — tetap lanjut walau gagal load
    document.head.appendChild(script);
  });
}

// ─── Ukuran label yang tersedia ───────────────────────────────────────────────
const LABEL_SIZES = [
  { id: 'small',  label: 'Kecil',   desc: '3.8 × 2.1 cm', w: 144, h: 80  },
  { id: 'medium', label: 'Sedang',  desc: '5.0 × 2.5 cm', w: 189, h: 94  },
  { id: 'large',  label: 'Besar',   desc: '6.5 × 3.0 cm', w: 246, h: 114 },
];

// ─── Opsi tampilan label ──────────────────────────────────────────────────────
const DISPLAY_OPTIONS = [
  { id: 'showName',  label: 'Nama produk' },
  { id: 'showPrice', label: 'Harga jual' },
  { id: 'showCode',  label: 'Kode barcode' },
];

// ─── Generate SVG barcode via JsBarcode ke canvas ─────────────────────────────
function generateBarcodeSVG(barcodeValue) {
  if (!barcodeValue || !window.JsBarcode) return null;
  try {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    window.JsBarcode(svg, String(barcodeValue), {
      format: 'CODE128',
      width: 1.8,
      height: 40,
      displayValue: false,
      margin: 0,
      background: '#ffffff',
      lineColor: '#000000',
    });
    return new XMLSerializer().serializeToString(svg);
  } catch {
    // Jika CODE128 gagal (barcode terlalu panjang/pendek), coba EAN13/EAN8
    try {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      window.JsBarcode(svg, String(barcodeValue), {
        format: 'EAN13',
        width: 1.8,
        height: 40,
        displayValue: false,
        margin: 0,
        background: '#ffffff',
        lineColor: '#000000',
      });
      return new XMLSerializer().serializeToString(svg);
    } catch {
      return null;
    }
  }
}

// ─── Satu label barcode ───────────────────────────────────────────────────────
function BarcodeLabel({ product, size, showName, showPrice, showCode }) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!svgRef.current || !window.JsBarcode || !product.barcode) return;
    try {
      window.JsBarcode(svgRef.current, String(product.barcode), {
        format: 'CODE128',
        width: size.id === 'small' ? 1.4 : size.id === 'medium' ? 1.7 : 2.0,
        height: size.id === 'small' ? 28 : size.id === 'medium' ? 36 : 44,
        displayValue: false,
        margin: 0,
        background: '#ffffff',
        lineColor: '#000000',
      });
    } catch {
      try {
        window.JsBarcode(svgRef.current, String(product.barcode), {
          format: 'EAN13',
          width: 1.4,
          height: 32,
          displayValue: false,
          margin: 0,
          background: '#ffffff',
          lineColor: '#000000',
        });
      } catch {}
    }
  }, [product.barcode, size]);

  const fontSize = size.id === 'small' ? 7 : size.id === 'medium' ? 8 : 9;
  const nameSize = size.id === 'small' ? 7.5 : size.id === 'medium' ? 8.5 : 10;

  return (
    <div style={{
      width: size.w,
      height: size.h,
      border: '1px solid #ccc',
      borderRadius: 4,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '4px 6px',
      gap: 2,
      background: '#fff',
      boxSizing: 'border-box',
      overflow: 'hidden',
      pageBreakInside: 'avoid',
    }}>
      {showName && (
        <div style={{
          fontSize: nameSize,
          fontWeight: 700,
          textAlign: 'center',
          lineHeight: 1.2,
          maxWidth: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          color: '#000',
        }}>
          {product.name}
        </div>
      )}

      {product.barcode ? (
        <svg ref={svgRef} style={{ maxWidth: '100%' }} />
      ) : (
        <div style={{ fontSize: 8, color: '#999', padding: '8px 0' }}>Tidak ada barcode</div>
      )}

      {showCode && (
        <div style={{
          fontSize: fontSize,
          fontFamily: 'monospace',
          color: '#333',
          letterSpacing: 1,
        }}>
          {product.barcode}
        </div>
      )}

      {showPrice && (
        <div style={{
          fontSize: size.id === 'small' ? 8 : size.id === 'medium' ? 9 : 11,
          fontWeight: 800,
          color: '#000',
        }}>
          {formatRupiah(product.price)}
        </div>
      )}
    </div>
  );
}

// ─── Preview grid label ───────────────────────────────────────────────────────
function LabelPreviewGrid({ items, size, showName, showPrice, showCode }) {
  // items = array of { product, copies }
  const expanded = [];
  items.forEach(({ product, copies }) => {
    for (let i = 0; i < copies; i++) expanded.push(product);
  });

  if (expanded.length === 0) return (
    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
      <Package size={36} style={{ opacity: .3, marginBottom: 10 }} />
      <div style={{ fontSize: 13 }}>Tidak ada produk dipilih</div>
    </div>
  );

  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: 6,
      padding: 16,
      background: '#f5f5f5',
      borderRadius: 8,
      minHeight: 100,
      justifyContent: 'flex-start',
    }}>
      {expanded.map((product, i) => (
        <BarcodeLabel
          key={`${product.id}-${i}`}
          product={product}
          size={size}
          showName={showName}
          showPrice={showPrice}
          showCode={showCode}
        />
      ))}
    </div>
  );
}

// ─── MODAL UTAMA ──────────────────────────────────────────────────────────────
// Props:
//   products     — semua produk (array) — untuk mode "pilih banyak"
//   initialProduct — jika dibuka dari tombol per-produk (satu produk)
//   onClose      — fungsi tutup modal
export default function BarcodeModal({ products = [], initialProduct = null, onClose }) {
  const [ready, setReady]           = useState(false);
  const [sizeId, setSizeId]         = useState('medium');
  const [showName, setShowName]     = useState(true);
  const [showPrice, setShowPrice]   = useState(true);
  const [showCode, setShowCode]     = useState(true);
  const [tab, setTab]               = useState(initialProduct ? 'single' : 'multi');
  // mode single
  const [singleCopies, setSingleCopies] = useState(1);
  // mode multi: { [productId]: copies }
  const [selected, setSelected]     = useState({});
  const [multiSearch, setMultiSearch] = useState('');
  const printRef = useRef();

  const size = LABEL_SIZES.find(s => s.id === sizeId);

  // Load JsBarcode saat modal buka
  useEffect(() => {
    loadJsBarcode().then(() => setReady(true));
  }, []);

  // Default pilihan jika initialProduct diberikan
  useEffect(() => {
    if (initialProduct) {
      setSelected({ [initialProduct.id]: 1 });
    }
  }, [initialProduct]);

  // Items untuk preview & cetak
  const printItems = tab === 'single' && initialProduct
    ? [{ product: initialProduct, copies: singleCopies }]
    : Object.entries(selected)
        .filter(([, copies]) => copies > 0)
        .map(([id, copies]) => ({
          product: products.find(p => String(p.id) === String(id)),
          copies,
        }))
        .filter(i => i.product);

  const totalLabels = printItems.reduce((sum, i) => sum + i.copies, 0);

  // Pilih/hapus semua di mode multi
  const filteredForMulti = products.filter(p =>
    !multiSearch || p.name.toLowerCase().includes(multiSearch.toLowerCase()) || p.barcode?.includes(multiSearch)
  );

  function toggleProduct(product) {
    setSelected(prev => {
      if (prev[product.id]) {
        const next = { ...prev };
        delete next[product.id];
        return next;
      }
      return { ...prev, [product.id]: 1 };
    });
  }

  function setCopies(productId, val) {
    const n = Math.max(1, Math.min(99, parseInt(val) || 1));
    setSelected(prev => ({ ...prev, [productId]: n }));
  }

  function selectAll() {
    const next = {};
    filteredForMulti.forEach(p => { next[p.id] = selected[p.id] || 1; });
    setSelected(next);
  }

  function clearAll() { setSelected({}); }

  // ── Cetak ──────────────────────────────────────────────────────────────────
  function handlePrint() {
    if (totalLabels === 0) return;

    // Build HTML konten label untuk window print
    const labelsHTML = printItems.flatMap(({ product, copies }) =>
      Array.from({ length: copies }, (_, i) => buildLabelHTML(product, size, showName, showPrice, showCode))
    ).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Cetak Barcode — ${totalLabels} Label</title>
  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: white; font-family: Arial, sans-serif; }
    .page { padding: 8mm; }
    .grid {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .label {
      width: ${size.w}px;
      height: ${size.h}px;
      border: 1px solid #bbb;
      border-radius: 3px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 4px 6px;
      gap: 2px;
      overflow: hidden;
      page-break-inside: avoid;
      background: white;
    }
    .label-name {
      font-size: ${size.id === 'small' ? 7.5 : size.id === 'medium' ? 8.5 : 10}px;
      font-weight: 700;
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
      color: #000;
    }
    .label-code {
      font-size: ${size.id === 'small' ? 7 : size.id === 'medium' ? 8 : 9}px;
      font-family: monospace;
      letter-spacing: 1px;
      color: #333;
    }
    .label-price {
      font-size: ${size.id === 'small' ? 8 : size.id === 'medium' ? 9 : 11}px;
      font-weight: 800;
      color: #000;
    }
    .no-barcode { font-size: 8px; color: #999; padding: 6px 0; }
    @media print {
      body { margin: 0; }
      .page { padding: 5mm; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="grid" id="labels">${labelsHTML}</div>
  </div>
  <script>
    window.onload = function() {
      var svgs = document.querySelectorAll('svg[data-barcode]');
      svgs.forEach(function(svg) {
        var val = svg.getAttribute('data-barcode');
        var h   = parseInt(svg.getAttribute('data-h') || 36);
        var w   = parseFloat(svg.getAttribute('data-w') || 1.7);
        if (!val) return;
        try {
          JsBarcode(svg, val, {
            format: 'CODE128', width: w, height: h,
            displayValue: false, margin: 0,
            background: '#ffffff', lineColor: '#000000'
          });
        } catch(e) {
          try {
            JsBarcode(svg, val, {
              format: 'EAN13', width: 1.4, height: h,
              displayValue: false, margin: 0,
              background: '#ffffff', lineColor: '#000000'
            });
          } catch(e2) {}
        }
      });
      setTimeout(function() { window.print(); }, 800);
    };
  <\/script>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) { alert('Popup diblokir browser. Izinkan popup untuk halaman ini.'); return; }
    win.document.write(html);
    win.document.close();
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: 'var(--bg-card)', borderRadius: 20, width: '100%', maxWidth: 960, maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,.4)' }}>

        {/* Header */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17 }}>🏷️ Cetak Label Barcode</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {totalLabels > 0 ? `${totalLabels} label siap dicetak` : 'Pilih produk dan atur tampilan label'}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        <div className="barcode-modal-body" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* ── Panel Kiri: Pengaturan ── */}
          <div className="barcode-modal-sidebar" style={{ width: 300, flexShrink: 0, borderRight: '1px solid var(--border)', overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Tab: single vs multi */}
            <div style={{ display: 'flex', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
              {[
                { id: 'single', label: '1 Produk' },
                { id: 'multi',  label: 'Banyak Produk' },
              ].map(t => (
                <button key={t.id} onClick={() => setTab(t.id)} style={{
                  flex: 1, padding: '8px 0', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                  background: tab === t.id ? 'var(--accent-blue)' : 'var(--bg-secondary)',
                  color: tab === t.id ? '#fff' : 'var(--text-muted)',
                }}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Single mode */}
            {tab === 'single' && initialProduct && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: .5 }}>Produk</div>
                <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '10px 12px', border: '1px solid var(--border)', marginBottom: 14 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{initialProduct.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 2 }}>{initialProduct.barcode}</div>
                  <div style={{ fontSize: 12, color: 'var(--accent-green)', fontWeight: 700, marginTop: 4 }}>{formatRupiah(initialProduct.price)}</div>
                </div>

                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: .5 }}>Jumlah Salinan</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button onClick={() => setSingleCopies(v => Math.max(1, v - 1))} style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Minus size={14} />
                  </button>
                  <input
                    type="number" min={1} max={99} value={singleCopies}
                    onChange={e => setSingleCopies(Math.max(1, Math.min(99, parseInt(e.target.value) || 1)))}
                    style={{ width: 60, textAlign: 'center', fontWeight: 800, fontSize: 16, border: '1px solid var(--border)', borderRadius: 8, padding: '6px 0', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                  />
                  <button onClick={() => setSingleCopies(v => Math.min(99, v + 1))} style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Plus size={14} />
                  </button>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>label</span>
                </div>
              </div>
            )}

            {/* Multi mode */}
            {tab === 'multi' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: .5 }}>
                    Pilih Produk ({Object.keys(selected).length} dipilih)
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={selectAll} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--bg-secondary)', cursor: 'pointer', color: 'var(--text-muted)' }}>Semua</button>
                    <button onClick={clearAll} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--bg-secondary)', cursor: 'pointer', color: 'var(--text-muted)' }}>Reset</button>
                  </div>
                </div>
                <input
                  className="form-input"
                  placeholder="Cari produk..."
                  value={multiSearch}
                  onChange={e => setMultiSearch(e.target.value)}
                  style={{ marginBottom: 10, fontSize: 12 }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 240, overflowY: 'auto' }}>
                  {filteredForMulti.map(p => {
                    const isSelected = !!selected[p.id];
                    return (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, border: `1px solid ${isSelected ? 'var(--accent-blue)' : 'var(--border)'}`, background: isSelected ? 'rgba(59,130,246,.06)' : 'var(--bg-secondary)', cursor: 'pointer' }}
                        onClick={() => toggleProduct(p)}>
                        <div style={{ flexShrink: 0, color: isSelected ? 'var(--accent-blue)' : 'var(--text-muted)' }}>
                          {isSelected ? <CheckSquare size={15} /> : <Square size={15} />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{p.barcode}</div>
                        </div>
                        {isSelected && (
                          <input
                            type="number" min={1} max={99}
                            value={selected[p.id]}
                            onClick={e => e.stopPropagation()}
                            onChange={e => { e.stopPropagation(); setCopies(p.id, e.target.value); }}
                            style={{ width: 44, textAlign: 'center', fontSize: 12, fontWeight: 700, border: '1px solid var(--border)', borderRadius: 6, padding: '3px 4px', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                          />
                        )}
                      </div>
                    );
                  })}
                  {filteredForMulti.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 12 }}>Tidak ada produk ditemukan</div>
                  )}
                </div>
              </div>
            )}

            {/* Ukuran Label */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: .5 }}>Ukuran Label</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {LABEL_SIZES.map(s => (
                  <button key={s.id} onClick={() => setSizeId(s.id)} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '9px 12px', borderRadius: 8, border: `1px solid ${sizeId === s.id ? 'var(--accent-blue)' : 'var(--border)'}`,
                    background: sizeId === s.id ? 'rgba(59,130,246,.08)' : 'var(--bg-secondary)',
                    cursor: 'pointer', textAlign: 'left',
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: sizeId === s.id ? 'var(--accent-blue)' : 'var(--text-primary)' }}>{s.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.desc}</div>
                    </div>
                    {sizeId === s.id && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-blue)' }} />}
                  </button>
                ))}
              </div>
            </div>

            {/* Tampilan */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: .5 }}>Tampilan Label</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { key: 'showName',  label: 'Nama produk',  val: showName,  set: setShowName  },
                  { key: 'showPrice', label: 'Harga jual',   val: showPrice, set: setShowPrice },
                  { key: 'showCode',  label: 'Kode barcode', val: showCode,  set: setShowCode  },
                ].map(opt => (
                  <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
                    <div
                      onClick={() => opt.set(v => !v)}
                      style={{
                        width: 20, height: 20, borderRadius: 5, flexShrink: 0,
                        border: `2px solid ${opt.val ? 'var(--accent-blue)' : 'var(--border)'}`,
                        background: opt.val ? 'var(--accent-blue)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer',
                      }}>
                      {opt.val && <div style={{ width: 8, height: 5, borderLeft: '2px solid white', borderBottom: '2px solid white', transform: 'rotate(-45deg) translate(1px, -1px)' }} />}
                    </div>
                    <span style={{ fontSize: 13 }}>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* ── Panel Kanan: Preview ── */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>
                Preview Label
                {totalLabels > 0 && (
                  <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 500, color: 'var(--text-muted)' }}>
                    ({totalLabels} label)
                  </span>
                )}
              </div>
              {!ready && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Memuat library barcode...</div>
              )}
            </div>

            <div style={{ flex: 1, padding: 20, overflowY: 'auto' }}>
              {ready ? (
                <LabelPreviewGrid
                  items={printItems}
                  size={size}
                  showName={showName}
                  showPrice={showPrice}
                  showCode={showCode}
                />
              ) : (
                <div style={{ textAlign: 'center', padding: 60 }}>
                  <div className="spinner" style={{ margin: 'auto', marginBottom: 12 }} />
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Memuat library barcode...</div>
                </div>
              )}
            </div>

            {/* Footer tombol cetak */}
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {totalLabels > 0
                  ? `Siap cetak ${totalLabels} label · ukuran ${size.label} (${size.desc})`
                  : 'Pilih produk terlebih dahulu'}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-ghost" onClick={onClose}>Batal</button>
                <button
                  className="btn btn-primary"
                  onClick={handlePrint}
                  disabled={totalLabels === 0 || !ready}
                  style={{ gap: 8 }}
                >
                  <Printer size={16} />
                  Cetak {totalLabels > 0 ? `${totalLabels} Label` : ''}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Helper: build HTML satu label untuk window print ────────────────────────
function buildLabelHTML(product, size, showName, showPrice, showCode) {
  const barW = size.id === 'small' ? 1.4 : size.id === 'medium' ? 1.7 : 2.0;
  const barH = size.id === 'small' ? 28  : size.id === 'medium' ? 36  : 44;
  const nameSize  = size.id === 'small' ? 7.5 : size.id === 'medium' ? 8.5 : 10;
  const codeSize  = size.id === 'small' ? 7   : size.id === 'medium' ? 8   : 9;
  const priceSize = size.id === 'small' ? 8   : size.id === 'medium' ? 9   : 11;

  const namePart  = showName  ? `<div class="label-name">${escHtml(product.name)}</div>` : '';
  const barPart   = product.barcode
    ? `<svg data-barcode="${escHtml(product.barcode)}" data-h="${barH}" data-w="${barW}" style="max-width:100%"></svg>`
    : `<div class="no-barcode">—</div>`;
  const codePart  = showCode  ? `<div class="label-code">${escHtml(product.barcode || '')}</div>` : '';
  const pricePart = showPrice ? `<div class="label-price">${escHtml(formatRupiah(product.price))}</div>` : '';

  return `<div class="label">${namePart}${barPart}${codePart}${pricePart}</div>`;
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}