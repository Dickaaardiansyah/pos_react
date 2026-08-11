// src/components/ProductOptionsModal.jsx
// Popup pilih satuan / varian — layout kartu agar mudah dibaca di kasir.
import { useState, useEffect } from "react";
import { X, Package, Scale, IceCream2, Flame, Snowflake, Check } from "lucide-react";
import { productsApi as productModel } from "../features/products/api";
import { formatRupiah } from "../utils/format";

// Beberapa nama varian umum dikasih ikon yang lebih "ngomong" daripada ikon
// generik — cuma kosmetik, tetap fallback ke Package kalau tidak match.
function variantIcon(label = "") {
  const l = label.toLowerCase();
  if (l.includes("es") || l.includes("dingin") || l.includes("cold")) return Snowflake;
  if (l.includes("panas") || l.includes("hot")) return Flame;
  if (l.includes("manis") || l.includes("sweet")) return IceCream2;
  return Package;
}

function displayPrice(opt, product) {
  const p = parseFloat(opt.price);
  if (p > 0) return p;
  const base = parseFloat(product.price) || 0;
  const factor = Number(opt.conversionQty) || 1;
  return base * factor;
}

function formatFactor(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "";
  return Number.isInteger(x) ? String(x) : String(Math.round(x * 1000) / 1000);
}

export default function ProductOptionsModal({ product, onSelect, onClose }) {
  // Selalu ambil detail dari API supaya variants / additional_units lengkap.
  // Jangan andalkan product dari list: array kosong [] bersifat truthy di JS
  // dan bisa membuat modal skip fetch → "Belum ada varian".
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    productModel
      .getById(product.id)
      .then((res) => {
        if (!cancelled) setDetail(res.data);
      })
      .catch(() => {
        if (!cancelled) setDetail(product);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [product.id]);

  const src = detail || product;
  const isVariant = (src.selection_type || product.selection_type) === "variant";
  const title = isVariant ? "Pilih Varian" : "Pilih Satuan";
  const baseUnit = src.unit || product.unit || "pcs";

  const options = isVariant
    ? (src.variants || []).map((v) => ({
        type: "variant",
        id: v.id,
        label: v.name,
        price: v.price,
        priceWholesale: v.price_wholesale,
        minQtyWholesale: v.min_qty_wholesale,
        conversionQty: 1,
      }))
    : [
        {
          type: "unit",
          id: null,
          label: baseUnit,
          price: src.price ?? product.price,
          priceWholesale: src.price_wholesale ?? product.price_wholesale,
          minQtyWholesale: src.min_qty_wholesale ?? product.min_qty_wholesale,
          conversionQty: 1,
          isBase: true,
        },
        ...(src.additional_units || [])
          .filter((u) => !u.purchase_only)
          .map((u) => ({
            type: "unit",
            id: u.id,
            label: u.unit_name,
            price: u.price,
            priceWholesale: u.price_wholesale,
            minQtyWholesale: u.min_qty_wholesale,
            conversionQty: Number(u.conversion_qty),
          })),
      ];

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal modal--options">
        <div className="product-options-header">
          <div className="product-options-header__icon">
            {isVariant ? <Package size={20} /> : <Scale size={20} />}
          </div>
          <div className="product-options-header__text">
            <div className="product-options-header__eyebrow">{title}</div>
            <h2 className="product-options-header__name">{product.name}</h2>
          </div>
          <button
            className="product-options-header__close"
            onClick={onClose}
            type="button"
            aria-label="Tutup"
          >
            <X size={16} />
          </button>
        </div>

        <div className="modal-body product-options-body">
          {loading ? (
            <div className="product-options-skeleton">
              {[0, 1, 2].map((i) => (
                <div key={i} className="product-options-skeleton__row" style={{ animationDelay: `${i * 80}ms` }} />
              ))}
            </div>
          ) : options.length === 0 ? (
            <div className="product-options-empty">
              <div className="product-options-empty__icon">
                {isVariant ? <Package size={22} /> : <Scale size={22} />}
              </div>
              Belum ada {isVariant ? "varian" : "satuan"} untuk produk ini.
              <span className="product-options-empty__hint">Lengkapi di form Produk.</span>
            </div>
          ) : (
            <div className="product-options-grid">
              {options.map((opt, i) => {
                const price = displayPrice(opt, src);
                const factor = Number(opt.conversionQty) || 1;
                const showConv = !isVariant && !opt.isBase && factor !== 1;
                const hasWholesale = Number(opt.priceWholesale) > 0;
                const Icon = isVariant ? variantIcon(opt.label) : Scale;

                return (
                  <button
                    type="button"
                    key={`${opt.type}-${opt.id ?? "base"}`}
                    className="product-options-card"
                    style={{ animationDelay: `${i * 40}ms` }}
                    onClick={() => onSelect(opt)}
                  >
                    <div className="product-options-card__top">
                      <div className="product-options-card__icon">
                        <Icon size={16} />
                      </div>
                      {opt.isBase && (
                        <span className="product-options-card__badge">Dasar</span>
                      )}
                    </div>

                    <div className="product-options-card__label">{opt.label}</div>

                    {showConv && (
                      <div className="product-options-card__conv">
                        {opt.label} = {formatFactor(factor)} {baseUnit}
                      </div>
                    )}

                    <div className="product-options-card__price">
                      {formatRupiah(price)}
                    </div>

                    {hasWholesale && (
                      <div className="product-options-card__wholesale">
                        Grosir {formatRupiah(opt.priceWholesale)}
                        {opt.minQtyWholesale ? ` · min. ${opt.minQtyWholesale}` : ""}
                      </div>
                    )}

                    <div className="product-options-card__select">
                      <Check size={14} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}