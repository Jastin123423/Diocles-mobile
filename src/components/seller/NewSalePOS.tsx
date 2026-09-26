import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search,
  Barcode,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  DollarSign,
  CreditCard,
  Smartphone,
  Landmark,
  Layers,
  CheckCircle,
  X,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  Loader2,
  TrendingUp,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SalesService } from '../../services/salesService';
import { Product, PaymentMethod } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { ProductThumbnail } from '../common/ProductThumbnail';
import { ProductImageViewerModal } from '../common/ProductImageViewerModal';

const PAGE_SIZE = 15;

interface CartItem {
  product: Product;
  quantity: number | string;
  unitPrice: number | string;
  discount: number;
}

export const NewSalePOS: React.FC = () => {
  const { currentUser, dbState, addToast, showReceipt, sellerColor, selectedShopId, currentShop } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [showMobileBarcode, setShowMobileBarcode] = useState(false);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [overallDiscount, setOverallDiscount] = useState<number>(0);
  const [amountReceived, setAmountReceived] = useState<string>('');
  const [saleNotes, setSaleNotes] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  // Pagination
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const settings = dbState.settings;

  const targetShopId = currentShop?.id || (selectedShopId !== 'ALL' ? selectedShopId : '') || (dbState.shops[0]?.id || '');

  const products = useMemo(() => {
    return dbState.products.filter(
      p => p.status === 'ACTIVE' && (!targetShopId || p.shopId === targetShopId || !p.shopId)
    );
  }, [dbState.products, targetShopId]);

  // ─────────────────────────────────────────────────────────────
  // MOST-SELLING RANK MAP
  // ─────────────────────────────────────────────────────────────
  const salesCountMap = useMemo(() => {
    const map = new Map<string, number>();
    const sales = dbState.sales || [];
    for (const sale of sales) {
      if (sale.status !== 'COMPLETED') continue;
      if (targetShopId && sale.shopId !== targetShopId) continue;
      for (const item of sale.items || []) {
        map.set(item.productId, (map.get(item.productId) || 0) + (item.quantity || 0));
      }
    }
    return map;
  }, [dbState.sales, targetShopId]);

  const categories = useMemo(() => {
    const all = dbState.categories || [];
    if (targetShopId === 'ALL') return all;
    return all.filter(c => c.shopId === targetShopId);
  }, [dbState.categories, targetShopId]);

  // ─────────────────────────────────────────────────────────────
  // FILTER + SORT (most-selling first)
  // ─────────────────────────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    const filtered = products.filter(p => {
      const matchesCategory = selectedCategory === 'ALL' || p.categoryId === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });

    return [...filtered].sort((a, b) => {
      const aSales = salesCountMap.get(a.id) || 0;
      const bSales = salesCountMap.get(b.id) || 0;
      if (bSales !== aSales) return bSales - aSales;
      if (b.currentStock !== a.currentStock) return b.currentStock - a.currentStock;
      return a.name.localeCompare(b.name);
    });
  }, [products, selectedCategory, searchQuery, salesCountMap]);

  // Reset pagination on search/category change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchQuery, selectedCategory]);

  const visibleProducts = filteredProducts.slice(0, visibleCount);
  const hasMore = filteredProducts.length > visibleCount;
  const remaining = filteredProducts.length - visibleCount;

  const handleSeeMore = () => {
    setIsLoadingMore(true);
    setTimeout(() => {
      setVisibleCount(prev => prev + PAGE_SIZE);
      setIsLoadingMore(false);
    }, 300);
  };

  const handleSeeLess = () => {
    setVisibleCount(PAGE_SIZE);
  };

  // ─────────────────────────────────────────────────────────────
  // Numeric coercion helpers
  // ─────────────────────────────────────────────────────────────
  const qtyNum = (q: number | string): number => {
    if (typeof q === 'number') return Number.isFinite(q) ? q : 0;
    const parsed = parseInt(q, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const priceNum = (p: number | string): number => {
    if (typeof p === 'number') return Number.isFinite(p) ? p : 0;
    const parsed = parseFloat(p);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const subtotal = useMemo(() => {
    return cart.reduce(
      (sum, item) => sum + qtyNum(item.quantity) * priceNum(item.unitPrice) - item.discount,
      0
    );
  }, [cart]);

  const totalItemsCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + qtyNum(item.quantity), 0);
  }, [cart]);

  const totalAmount = useMemo(() => {
    const discounted = Math.max(0, subtotal - overallDiscount);
    return Number(discounted.toFixed(2));
  }, [subtotal, overallDiscount]);

  const tenderValue = parseFloat(amountReceived) || 0;
  const changeAmount = paymentMethod === 'CASH' ? Math.max(0, tenderValue - totalAmount) : 0;

  useEffect(() => {
    if (paymentMethod === 'CASH') {
      setAmountReceived(totalAmount.toFixed(2));
    }
  }, [totalAmount, paymentMethod]);

  const addToCart = (product: Product) => {
    if (product.currentStock <= 0) {
      addToast({
        type: 'warning',
        title: 'Out of Stock',
        description: `${product.name} is currently out of stock.`,
      });
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        const currentQty = qtyNum(existing.quantity);
        if (currentQty >= product.currentStock) {
          addToast({
            type: 'warning',
            title: 'Stock Limit Reached',
            description: `Only ${product.currentStock} ${product.unit} available in inventory.`,
          });
          return prev;
        }
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: currentQty + 1 }
            : item
        );
      }
      return [
        ...prev,
        {
          product,
          quantity: 1,
          unitPrice: product.sellingPrice,
          discount: 0,
        },
      ];
    });
  };

  const updateUnitPrice = (productId: string, rawValue: string) => {
    if (rawValue === '') {
      setCart(prev =>
        prev.map(i => (i.product.id === productId ? { ...i, unitPrice: '' } : i))
      );
      return;
    }

    let cleaned = rawValue.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      cleaned = parts[0] + '.' + parts.slice(1).join('');
    }
    if (cleaned.length > 1 && cleaned[0] === '0' && cleaned[1] !== '.') {
      cleaned = cleaned.replace(/^0+/, '');
      if (cleaned === '') cleaned = '0';
    }

    setCart(prev =>
      prev.map(i => (i.product.id === productId ? { ...i, unitPrice: cleaned } : i))
    );
  };

  const handlePriceBlur = (productId: string) => {
    setCart(prev =>
      prev.map(i => {
        if (i.product.id !== productId) return i;
        const n = priceNum(i.unitPrice);
        if (i.unitPrice === '' || n <= 0) {
          return { ...i, unitPrice: i.product.sellingPrice };
        }
        return { ...i, unitPrice: n };
      })
    );
  };

  const updateQuantity = (productId: string, rawValue: string) => {
    const item = cart.find(i => i.product.id === productId);
    if (!item) return;

    if (rawValue === '') {
      setCart(prev =>
        prev.map(i => (i.product.id === productId ? { ...i, quantity: '' } : i))
      );
      return;
    }

    let cleaned = rawValue.replace(/[^0-9]/g, '');
    cleaned = cleaned.replace(/^0+/, '');
    if (cleaned === '') cleaned = '0';

    const parsed = parseInt(cleaned, 10);
    if (!Number.isFinite(parsed)) return;

    let nextQty = parsed;
    if (nextQty < 1) nextQty = 1;

    if (nextQty > item.product.currentStock) {
      addToast({
        type: 'warning',
        title: 'Stock Exceeded',
        description: `Max stock for this item is ${item.product.currentStock}.`,
      });
      nextQty = item.product.currentStock;
    }

    setCart(prev =>
      prev.map(i => (i.product.id === productId ? { ...i, quantity: nextQty } : i))
    );
  };

  const handleQuantityBlur = (productId: string) => {
    setCart(prev =>
      prev.map(i => {
        if (i.product.id !== productId) return i;
        const n = qtyNum(i.quantity);
        return { ...i, quantity: n < 1 ? 1 : n };
      })
    );
  };

  const stepQuantity = (productId: string, delta: number) => {
    const item = cart.find(i => i.product.id === productId);
    if (!item) return;
    const current = qtyNum(item.quantity) || 1;
    updateQuantity(productId, String(current + delta));
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(i => i.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setOverallDiscount(0);
    setAmountReceived('');
    setSaleNotes('');
    setIsMobileCartOpen(false);
  };

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    const scanned = products.find(
      p =>
        p.barcode === barcodeInput.trim() ||
        p.sku.toLowerCase() === barcodeInput.trim().toLowerCase()
    );

    if (scanned) {
      addToCart(scanned);
      setBarcodeInput('');
      addToast({
        type: 'info',
        title: 'Item Added',
        description: `${scanned.name} added to cart.`,
      });
    } else {
      addToast({
        type: 'error',
        title: 'Barcode Not Found',
        description: `No active product found for barcode '${barcodeInput}'.`,
      });
    }
  };

  const handleCompleteSale = () => {
    if (!currentUser) return;

    if (cart.length === 0) {
      addToast({
        type: 'warning',
        title: 'Cart is Empty',
        description: 'Please add items to cart before completing sale.',
      });
      return;
    }

    const invalid = cart.find(i => qtyNum(i.quantity) < 1);
    if (invalid) {
      addToast({
        type: 'error',
        title: 'Invalid Quantity',
        description: `Please set a quantity of at least 1 for ${invalid.product.name}.`,
      });
      return;
    }

    const invalidPrice = cart.find(i => priceNum(i.unitPrice) <= 0);
    if (invalidPrice) {
      addToast({
        type: 'error',
        title: 'Invalid Price',
        description: `Please set a price greater than 0 for ${invalidPrice.product.name}.`,
      });
      return;
    }

    const tender = paymentMethod === 'CASH' ? (parseFloat(amountReceived) || 0) : totalAmount;

    if (paymentMethod === 'CASH' && tender < totalAmount) {
      addToast({
        type: 'error',
        title: 'Insufficient Payment',
        description: `Tendered cash (${formatCurrency(tender, settings.currencySymbol)}) is less than total due (${formatCurrency(totalAmount, settings.currencySymbol)}).`,
      });
      return;
    }

    setIsProcessing(true);

    const result = SalesService.createSale(
      {
        shopId: targetShopId === 'ALL' ? (dbState.shops[0]?.id || '') : (targetShopId || dbState.shops[0]?.id || ''),
        items: cart.map(i => ({
          productId: i.product.id,
          quantity: qtyNum(i.quantity),
          unitPrice: priceNum(i.unitPrice),
          discount: i.discount,
        })),
        paymentMethod,
        discount: overallDiscount,
        amountReceived: tender,
        notes: saleNotes,
      },
      currentUser
    );

    setIsProcessing(false);

    if (result.success && result.sale) {
      addToast({
        type: 'success',
        title: 'Sale Completed Successfully',
        description: `Receipt #${result.sale.receiptNumber} generated. Inventory updated.`,
      });
      showReceipt(result.sale);
      clearCart();
    } else {
      addToast({
        type: 'error',
        title: 'Sale Failed',
        description: result.error || 'Could not complete transaction.',
      });
    }
  };

  // Cart Items Component
  const renderCartItemsAndCheckout = () => (
    <div className="flex flex-col h-full justify-between overflow-hidden bg-slate-900">
      {/* Cart Header */}
      <div className="p-3.5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-blue-400" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            Cart ({totalItemsCount} Items)
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {cart.length > 0 && (
            <button
              id="clear-cart-btn"
              onClick={clearCart}
              className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1 font-medium transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )}
          <button
            onClick={() => setIsMobileCartOpen(false)}
            className="lg:hidden p-1 rounded-lg text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Cart Items List */}
      <div className="flex-1 p-3 overflow-y-auto space-y-2.5">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
            <ShoppingCart className="w-12 h-12 mb-3 text-slate-700" />
            <p className="text-sm font-semibold text-slate-400">Cart is Empty</p>
            <p className="text-xs text-slate-600 mt-1">
              Tap product cards or scan barcodes to begin sale.
            </p>
          </div>
        ) : (
          cart.map(item => {
            const referencePrice =
              item.product.proposedSellingPrice || item.product.sellingPrice || 0;
            const unitPriceNum = priceNum(item.unitPrice);
            const isBelowReference =
              referencePrice > 0 && unitPriceNum > 0 && unitPriceNum < referencePrice;

            return (
              <div
                key={item.product.id}
                className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 space-y-2 transition shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <ProductThumbnail
                      product={item.product}
                      size="sm"
                      onClick={() => {
                        setViewingProduct(item.product);
                        setIsViewerOpen(true);
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h5 className="text-xs font-semibold text-white truncate">{item.product.name}</h5>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                          {item.product.sku}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5 flex-wrap">
                        <span className="font-semibold text-emerald-400 font-mono">
                          Total: {formatCurrency(qtyNum(item.quantity) * priceNum(item.unitPrice) - item.discount, settings.currencySymbol)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => removeFromCart(item.product.id)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 shrink-0 transition"
                    title="Remove item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-900">
                  <div className="flex items-center gap-1.5">
                    <label className="text-[10px] text-slate-400">Bei:</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={item.unitPrice}
                      onChange={e => updateUnitPrice(item.product.id, e.target.value)}
                      onBlur={() => handlePriceBlur(item.product.id)}
                      onFocus={e => e.target.select()}
                      className={`w-20 bg-slate-900 border rounded px-2 py-1 text-xs text-white font-mono focus:outline-none focus:ring-1 ${
                        isBelowReference
                          ? 'border-rose-500/60 focus:ring-rose-500'
                          : 'border-slate-800 focus:ring-blue-500'
                      }`}
                    />
                  </div>

                  <div className="flex items-center gap-1">
                    <label className="text-[10px] text-slate-400">Idadi:</label>
                    <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5">
                      <button
                        type="button"
                        onClick={() => stepQuantity(item.product.id, -1)}
                        className="w-7 h-7 rounded-md flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 active:scale-95 transition"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={item.quantity}
                        onChange={e => updateQuantity(item.product.id, e.target.value)}
                        onBlur={() => handleQuantityBlur(item.product.id)}
                        onFocus={e => e.target.select()}
                        className="w-12 bg-slate-950 border border-slate-700 rounded text-center text-xs font-bold text-white font-mono py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => stepQuantity(item.product.id, 1)}
                        className="w-7 h-7 rounded-md flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 active:scale-95 transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {isBelowReference && (
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-rose-400 bg-rose-500/10 px-2 py-1 rounded border border-rose-500/25 mt-1">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    <span>Unauza chini ya Bei elekezi</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Checkout Panel */}
      <div className="p-3 sm:p-3.5 bg-slate-950 border-t border-slate-800 space-y-2.5 safe-bottom">
        <div>
          <span className="block text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Njia ya Malipo
          </span>
          <div className="grid grid-cols-4 gap-1">
            {[
              { id: 'CASH', label: 'Cash', icon: DollarSign },
              { id: 'MOBILE_MONEY', label: 'M-Pesa', icon: Smartphone },
              { id: 'CARD', label: 'Card', icon: CreditCard },
              { id: 'BANK', label: 'Bank', icon: Landmark },
            ].map(m => {
              const Icon = m.icon;
              const active = paymentMethod === m.id;
              return (
                <button
                  key={m.id}
                  id={`pay-method-${m.id}`}
                  type="button"
                  onClick={() => setPaymentMethod(m.id as PaymentMethod)}
                  className={`flex flex-col items-center justify-center py-2 rounded-lg text-[10px] font-semibold border transition active:scale-95 ${
                    active
                      ? 'bg-blue-600 border-blue-500 text-white shadow-sm'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 mb-0.5" />
                  <span className="truncate">{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {paymentMethod === 'CASH' && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 text-[11px]">Pesa Iliyopokelewa</span>
              <span className="text-slate-500 text-[9px]">Auto-filled with total</span>
            </div>

            <input
              id="tender-amount-input"
              type="number"
              step="any"
              min="0"
              value={amountReceived}
              onChange={e => setAmountReceived(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono font-bold text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />

            {changeAmount > 0 && (
              <div className="flex justify-between items-center px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-xs">
                <span className="text-emerald-400 font-medium">Chenji (Change):</span>
                <span className="text-emerald-300 font-bold font-mono">
                  {formatCurrency(changeAmount, settings.currencySymbol)}
                </span>
              </div>
            )}
          </div>
        )}

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 space-y-1 text-xs">
          <div className="flex justify-between text-slate-400 text-[11px]">
            <span>Jumla Ndogo (Subtotal)</span>
            <span className="font-mono">{formatCurrency(subtotal, settings.currencySymbol)}</span>
          </div>
          {overallDiscount > 0 && (
            <div className="flex justify-between text-amber-400 text-[11px]">
              <span>Punguzo (Discount)</span>
              <span className="font-mono">-{formatCurrency(overallDiscount, settings.currencySymbol)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm sm:text-base font-extrabold text-white pt-1.5 border-t border-slate-800">
            <span>JUMLA KUU</span>
            <span className="text-emerald-400 font-mono">
              {formatCurrency(totalAmount, settings.currencySymbol)}
            </span>
          </div>
        </div>

        <button
          id="complete-sale-btn"
          onClick={handleCompleteSale}
          disabled={cart.length === 0 || isProcessing}
          className="w-full py-3 rounded-xl font-bold text-sm text-white shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
          style={{ backgroundColor: sellerColor.primary }}
        >
          <CheckCircle className="w-5 h-5" />
          <span>Kamilisha Mauzo ({formatCurrency(totalAmount, settings.currencySymbol)})</span>
        </button>
      </div>
    </div>
  );

  return (
    <div id="pos-terminal" className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-slate-950 text-slate-100 select-none relative">
      {/* Left / Main: Product Catalog & Search */}
      <div className="flex-1 flex flex-col border-r border-slate-800 overflow-hidden">
        <div className="p-2.5 sm:p-3.5 bg-slate-900 border-b border-slate-800 space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                id="pos-search-input"
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Tafuta bidhaa kwa jina au SKU..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <button
              onClick={() => setShowMobileBarcode(!showMobileBarcode)}
              className="lg:hidden p-2 rounded-xl bg-slate-800 text-slate-300 border border-slate-700 hover:text-white"
              title="Barcode Scanner"
            >
              <Barcode className="w-4 h-4" />
            </button>

            <form onSubmit={handleBarcodeSubmit} className="hidden lg:flex relative w-48">
              <Barcode className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                ref={barcodeInputRef}
                id="pos-barcode-input"
                type="text"
                value={barcodeInput}
                onChange={e => setBarcodeInput(e.target.value)}
                placeholder="Scan barcode [Enter]"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </form>
          </div>

          {showMobileBarcode && (
            <form onSubmit={handleBarcodeSubmit} className="lg:hidden flex items-center gap-2 animate-in fade-in">
              <div className="relative flex-1">
                <Barcode className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={barcodeInput}
                  onChange={e => setBarcodeInput(e.target.value)}
                  placeholder="Andika au scan barcode..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white"
                  autoFocus
                />
              </div>
              <button type="submit" className="px-3 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-xl">
                Scan
              </button>
            </form>
          )}

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs">
            <button
              onClick={() => setSelectedCategory('ALL')}
              className={`px-3 py-1.5 rounded-xl whitespace-nowrap text-xs font-semibold transition active:scale-95 ${
                selectedCategory === 'ALL'
                  ? 'bg-blue-600 text-white shadow'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
              }`}
            >
              Makundi Yote ({products.length})
            </button>
            {categories.map(cat => {
              const count = products.filter(p => p.categoryId === cat.id).length;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-xl whitespace-nowrap text-xs font-semibold transition active:scale-95 ${
                    selectedCategory === cat.id
                      ? 'bg-blue-600 text-white shadow'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  {cat.name} ({count})
                </button>
              );
            })}
          </div>

          {/* Result count hint */}
          {filteredProducts.length > 0 && (
            <div className="flex items-center gap-1 text-[10px] text-slate-500">
              <TrendingUp className="w-3 h-3 text-emerald-400 shrink-0" />
              <span className="truncate">
                Showing{' '}
                <span className="text-slate-300 font-semibold">
                  {Math.min(visibleCount, filteredProducts.length)}
                </span>{' '}
                of{' '}
                <span className="text-slate-300 font-semibold">{filteredProducts.length}</span>
                {!searchQuery && ' (top sellers first)'}
              </span>
            </div>
          )}
        </div>

        {/* Product Grid */}
        <div className="flex-1 p-2.5 sm:p-4 overflow-y-auto pb-24 lg:pb-4">
          {filteredProducts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500">
              <Layers className="w-10 h-10 mb-2 opacity-40" />
              <p className="text-sm font-medium text-slate-400">Hakuna bidhaa inayolingana</p>
              <p className="text-xs text-slate-600 mt-1">Chagua kundi jingine au tumia neno tofauti.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
                {visibleProducts.map(product => {
                  const isOutOfStock = product.currentStock <= 0;
                  const isLowStock = product.currentStock > 0 && product.currentStock <= product.minStock;
                  const unitsSold = salesCountMap.get(product.id) || 0;

                  return (
                    <div
                      key={product.id}
                      id={`pos-product-${product.id}`}
                      className={`p-2 sm:p-2.5 rounded-xl border transition-all flex flex-col justify-between h-36 relative overflow-hidden group active:scale-[0.98] ${
                        isOutOfStock
                          ? 'bg-slate-900/40 border-slate-800/60 opacity-50'
                          : 'bg-slate-900 border-slate-800 hover:border-blue-500/50 hover:bg-slate-850 hover:shadow-lg'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-1 mb-1">
                          <div className="flex items-center gap-1 min-w-0 flex-1">
                            <span className="text-[9px] sm:text-[10px] font-mono text-slate-400 truncate">{product.sku}</span>
                            {unitsSold > 0 && (
                              <span
                                className="text-[8px] sm:text-[9px] px-1 py-0.2 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 font-bold shrink-0"
                                title={`${unitsSold} units sold`}
                              >
                                🔥 {unitsSold}
                              </span>
                            )}
                          </div>
                          {isOutOfStock ? (
                            <span className="text-[8px] sm:text-[9px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0">Imeisha</span>
                          ) : isLowStock ? (
                            <span className="text-[8px] sm:text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold shrink-0">{product.currentStock} {product.unit}</span>
                          ) : (
                            <span className="text-[8px] sm:text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 shrink-0">{product.currentStock} {product.unit}</span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <ProductThumbnail
                            product={product}
                            size="sm"
                            onClick={() => { setViewingProduct(product); setIsViewerOpen(true); }}
                          />
                          <h4
                            onClick={() => !isOutOfStock && addToCart(product)}
                            className="text-xs font-semibold text-white line-clamp-2 transition flex-1 min-w-0 cursor-pointer hover:text-blue-300"
                            title={product.name}
                          >
                            {product.name}
                          </h4>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-1 pt-1.5 border-t border-slate-800/60">
                        <span className="text-xs font-bold text-emerald-400 font-mono">
                          {formatCurrency(product.sellingPrice, settings.currencySymbol)}
                        </span>
                        <button
                          type="button"
                          disabled={isOutOfStock}
                          onClick={() => addToCart(product)}
                          className="w-7 h-7 sm:w-6 sm:h-6 rounded-lg bg-blue-600/20 hover:bg-blue-600 group-hover:bg-blue-600 text-blue-300 group-hover:text-white flex items-center justify-center transition disabled:opacity-30 disabled:cursor-not-allowed active:scale-90"
                          title="Add to cart"
                        >
                          <Plus className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* See More / See Less Footer */}
              {filteredProducts.length > PAGE_SIZE && (
                <div className="mt-4 pt-4 border-t border-slate-800/60 space-y-2">
                  <div className="text-[10px] text-slate-500 text-center">
                    Showing{' '}
                    <span className="text-slate-300 font-semibold">
                      {Math.min(visibleCount, filteredProducts.length)}
                    </span>{' '}
                    of{' '}
                    <span className="text-slate-300 font-semibold">{filteredProducts.length}</span>{' '}
                    products
                  </div>
                  <div className="flex items-center gap-2">
                    {visibleCount > PAGE_SIZE && (
                      <button
                        onClick={handleSeeLess}
                        className="flex-1 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-300 text-[11px] font-semibold transition"
                      >
                        Show Less
                      </button>
                    )}
                    {hasMore && (
                      <button
                        onClick={handleSeeMore}
                        disabled={isLoadingMore}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-[11px] font-semibold shadow transition disabled:opacity-60 disabled:cursor-wait"
                      >
                        {isLoadingMore ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Loading...</span>
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-3.5 h-3.5" />
                            <span>See More ({Math.min(PAGE_SIZE, remaining)})</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Floating Bottom Cart Bar for Mobile */}
      {cart.length > 0 && (
        <div className="lg:hidden fixed bottom-14 left-2 right-2 z-30 animate-in slide-in-from-bottom-3 duration-200">
          <button
            id="mobile-view-cart-sticky-bar"
            onClick={() => setIsMobileCartOpen(true)}
            className="w-full p-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-2xl flex items-center justify-between font-semibold text-xs border border-blue-400/30 active:scale-95"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center font-mono font-bold">
                {totalItemsCount}
              </div>
              <div className="text-left">
                <div className="text-[11px] text-blue-100">Kikapu cha Mauzo</div>
                <div className="text-sm font-extrabold font-mono text-white">
                  {formatCurrency(totalAmount, settings.currencySymbol)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 bg-white/20 px-3 py-1.5 rounded-xl text-xs font-bold">
              <span>Lipia Sasa</span>
              <ChevronUp className="w-4 h-4" />
            </div>
          </button>
        </div>
      )}

      {/* Mobile Cart & Checkout Bottom Sheet Modal */}
      {isMobileCartOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => setIsMobileCartOpen(false)} />
          <div className="relative bg-slate-900 border-t border-slate-800 rounded-t-3xl h-[88vh] flex flex-col shadow-2xl z-10 overflow-hidden">
            <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto my-2" />
            {renderCartItemsAndCheckout()}
          </div>
        </div>
      )}

      {/* Desktop Right Sidebar Cart & Checkout */}
      <div className="hidden lg:flex w-[400px] xl:w-[440px] bg-slate-900 flex-col justify-between shrink-0 overflow-hidden border-l border-slate-800">
        {renderCartItemsAndCheckout()}
      </div>

      {/* Product Image Gallery / Viewer Modal */}
      <ProductImageViewerModal
        product={viewingProduct}
        isOpen={isViewerOpen}
        onClose={() => setIsViewerOpen(false)}
        currencySymbol={settings.currencySymbol}
      />
    </div>
  );
};
