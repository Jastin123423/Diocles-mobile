import React, { useState } from 'react';
import {
  Boxes,
  AlertTriangle,
  PackageX,
  DollarSign,
  ArrowUpDown,
  History,
  X,
  Search,
  Printer,
  Calendar,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { InventoryService } from '../../services/inventoryService';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { Product } from '../../types';
import { ProductThumbnail } from '../common/ProductThumbnail';
import { ProductImageViewerModal } from '../common/ProductImageViewerModal';

export const AdminInventory: React.FC = () => {
  const { currentUser, dbState, addToast, selectedShopId } = useApp();
  const [activeTab, setActiveTabState] = useState<'stock' | 'movements' | 'losses'>('stock');
  const [searchQuery, setSearchQuery] = useState('');
  const [movementTypeFilter, setMovementTypeFilter] = useState('ALL');
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  // Loss report filters
  const [lossPeriod, setLossPeriod] = useState<'today' | 'week' | 'month' | 'all'>('month');
  const [lossTypeFilter, setLossTypeFilter] = useState('ALL');

  // Stock Adjustment Modal
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [adjustmentCategory, setAdjustmentCategory] = useState<
    'DAMAGED' | 'BROKEN' | 'EXPIRED' | 'LOST' | 'CORRECTION' | 'RESTOCK'
  >('DAMAGED');
  const [adjustmentType, setAdjustmentType] = useState<'IN' | 'OUT' | 'SET'>('OUT');
  const [quantityInput, setQuantityInput] = useState('0');
  const [reasonInput, setReasonInput] = useState('');
  const [modalError, setModalError] = useState('');

  // Permission check: Admin OR Seller with canManageInventory
  if (!currentUser) return null;
  if (currentUser.role !== 'ADMIN' && !currentUser.permissions?.canManageInventory) return null;

  const settings = dbState.settings;
  const valuation = InventoryService.getInventoryValuation(selectedShopId, currentUser);
  const allMovements = InventoryService.getMovementHistory(
    {
      shopId: selectedShopId === 'ALL' ? undefined : selectedShopId,
      search: searchQuery,
    },
    currentUser
  );

  const movements = allMovements.filter(m => {
    if (movementTypeFilter === 'ALL') return true;
    return m.type === movementTypeFilter;
  });

  const products = dbState.products.filter(p => {
    const matchesShop = selectedShopId === 'ALL' || p.shopId === selectedShopId;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
    return matchesShop && matchesSearch;
  });

  const selectedProduct = dbState.products.find(p => p.id === selectedProductId);
  const inputQty = parseInt(quantityInput, 10) || 0;
  const calculatedLossValue = selectedProduct ? inputQty * (selectedProduct.purchasePrice || 0) : 0;

  // Loss movements
  const lossMovements = (dbState.movements || []).filter(m =>
    ['DAMAGED', 'BROKEN', 'EXPIRED', 'LOST'].includes(m.type)
  );

  const filteredLosses = lossMovements.filter(m => {
    const date = new Date(m.createdAt);
    const now = new Date();

    if (lossPeriod === 'today') {
      if (date.toDateString() !== now.toDateString()) return false;
    } else if (lossPeriod === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 86400000);
      if (date < weekAgo) return false;
    } else if (lossPeriod === 'month') {
      if (date.getMonth() !== now.getMonth() || date.getFullYear() !== now.getFullYear()) return false;
    }

    if (lossTypeFilter !== 'ALL' && m.type !== lossTypeFilter) return false;
    return true;
  });

  const totalLossValue = filteredLosses.reduce((sum, m) => sum + (m.costValue || 0), 0);
  const totalLossUnits = filteredLosses.reduce((sum, m) => sum + Math.abs(m.changeQty), 0);

  const handleAdjustStock = (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');

    const targetProduct = dbState.products.find(p => p.id === selectedProductId);
    if (!targetProduct) {
      setModalError('Please select a valid product.');
      return;
    }

    const qty = parseInt(quantityInput, 10) || 0;
    if (qty <= 0) {
      setModalError('Quantity must be greater than 0.');
      return;
    }

    let delta = 0;
    if (adjustmentType === 'IN') {
      delta = qty;
    } else if (adjustmentType === 'OUT') {
      delta = -qty;
    } else if (adjustmentType === 'SET') {
      delta = qty - targetProduct.currentStock;
    }

    const finalReason = reasonInput.trim()
      ? `[${adjustmentCategory}] ${reasonInput.trim()}`
      : `[${adjustmentCategory}] Stock adjustment`;

    const res = InventoryService.adjustStock(
      selectedProductId,
      targetProduct.currentStock + delta,
      finalReason,
      currentUser,
      adjustmentCategory
    );

    if (res.success) {
      addToast({
        type: 'success',
        title: 'Stock Adjustment Logged',
        description: `Inventory for '${targetProduct.name}' updated (${delta > 0 ? '+' : ''}${delta} ${targetProduct.unit}).`,
      });
      setIsAdjustModalOpen(false);
      setSelectedProductId('');
      setReasonInput('');
      setQuantityInput('0');
    } else {
      setModalError(res.error || 'Failed to adjust stock.');
    }
  };

  // Print Loss Report
  const handlePrintLossReport = () => {
    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    if (!printWindow) return;

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Stock Loss Report</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', sans-serif; padding: 20px; color: #1e293b; }
          .header { text-align: center; margin-bottom: 20px; border-bottom: 3px double #dc2626; padding-bottom: 15px; }
          .header h1 { font-size: 22px; color: #dc2626; }
          .header .meta { font-size: 11px; color: #64748b; margin-top: 6px; }
          .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 18px; }
          .summary-card { padding: 12px; border-radius: 8px; text-align: center; color: #fff; }
          .summary-card.total-value { background: linear-gradient(135deg, #dc2626, #991b1b); }
          .summary-card.total-units { background: linear-gradient(135deg, #f59e0b, #d97706); }
          .summary-card.count { background: linear-gradient(135deg, #8b5cf6, #7c3aed); }
          .summary-card .label { font-size: 10px; text-transform: uppercase; }
          .summary-card .value { font-size: 16px; font-weight: bold; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          thead { background: #1e293b; color: #fff; }
          th { padding: 8px; text-align: left; }
          td { padding: 6px; border-bottom: 1px solid #e2e8f0; }
          tr:nth-child(even) { background: #fef2f2; }
          .loss-type { color: #dc2626; font-weight: bold; }
          .footer { text-align: center; margin-top: 20px; font-size: 10px; color: #94a3b8; }
          @media (max-width: 600px) {
            .summary { grid-template-columns: 1fr; }
            table { font-size: 10px; }
            th, td { padding: 5px; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📦 Stock Loss Report</h1>
          <div class="meta">Period: ${lossPeriod.toUpperCase()} | Generated: ${new Date().toLocaleString()}</div>
        </div>
        <div class="summary">
          <div class="summary-card total-value">
            <div class="label">Total Loss Value</div>
            <div class="value">${settings.currencySymbol} ${totalLossValue.toLocaleString()}</div>
          </div>
          <div class="summary-card total-units">
            <div class="label">Total Units Lost</div>
            <div class="value">${totalLossUnits}</div>
          </div>
          <div class="summary-card count">
            <div class="label">Loss Records</div>
            <div class="value">${filteredLosses.length}</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Product</th>
              <th>Type</th>
              <th>Qty Lost</th>
              <th>Loss Value</th>
              <th>Reason</th>
              <th>Recorded By</th>
            </tr>
          </thead>
          <tbody>
            ${filteredLosses.map(m => `
              <tr>
                <td>${formatDateTime(m.createdAt)}</td>
                <td><strong>${m.productName}</strong></td>
                <td class="loss-type">${m.type}</td>
                <td>${Math.abs(m.changeQty)}</td>
                <td>${settings.currencySymbol} ${(m.costValue || 0).toLocaleString()}</td>
                <td>${m.reason}</td>
                <td>${m.userName}</td>
              </tr>
            `).join('') || '<tr><td colspan="7" style="text-align:center;">No loss records found</td></tr>'}
          </tbody>
        </table>
        <div class="footer">${settings.businessName} - Stock Loss Report</div>
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
  };

  return (
    <div
      id="admin-inventory-view"
      className="flex-1 p-3.5 sm:p-6 bg-slate-950 text-slate-100 overflow-y-auto pb-24 sm:pb-6"
    >
      {/* Header */}
      <div className="flex flex-col gap-3 mb-5 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
            Inventory & Stock Control
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Monitor real-time warehouse stock, track losses, and perform stock adjustments
          </p>
        </div>

        <button
          id="stock-adjust-btn"
          onClick={() => {
            setSelectedProductId(dbState.products[0]?.id || '');
            setQuantityInput('0');
            setAdjustmentType('OUT');
            setAdjustmentCategory('DAMAGED');
            setIsAdjustModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold text-xs shadow-lg transition"
        >
          <ArrowUpDown className="w-4 h-4" />
          <span>Manual Stock Adjustment</span>
        </button>
      </div>

      {/* Valuation & Stock Metrics */}
      <div className="grid grid-cols-2 gap-2.5 mb-5">
        <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider">Total SKUs</span>
            <Boxes className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="text-lg font-bold text-white font-mono">{valuation.totalProducts}</div>
          <p className="text-[10px] text-slate-400 mt-0.5 truncate">
            {valuation.totalUnitsInStock} total units
          </p>
        </div>

        <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider">Low / Out</span>
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-lg font-bold text-amber-300 font-mono">
            {valuation.lowStockCount}{' '}
            <span className="text-[10px] font-normal text-rose-400">
              ({valuation.outOfStockCount} zero)
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5 truncate">Needs restock</p>
        </div>

        <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider">Cost Value</span>
            <DollarSign className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-sm font-bold text-purple-300 font-mono truncate">
            {formatCurrency(valuation.totalCostValue, settings.currencySymbol)}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5 truncate">Invested capital</p>
        </div>

        <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider">Retail Value</span>
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-sm font-bold text-emerald-400 font-mono truncate">
            {formatCurrency(valuation.totalRetailValue, settings.currencySymbol)}
          </div>
          <p className="text-[10px] text-emerald-400/80 mt-0.5 truncate">
            +{formatCurrency(valuation.potentialProfit, settings.currencySymbol)}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 mb-4 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTabState('stock')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
            activeTab === 'stock'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 active:bg-slate-800'
          }`}
        >
          <Boxes className="w-3.5 h-3.5" />
          <span>Stock</span>
        </button>

        <button
          onClick={() => setActiveTabState('movements')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
            activeTab === 'movements'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 active:bg-slate-800'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Movements ({movements.length})</span>
        </button>

        <button
          onClick={() => setActiveTabState('losses')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
            activeTab === 'losses'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 active:bg-slate-800'
          }`}
        >
          <PackageX className="w-3.5 h-3.5" />
          <span>Losses ({lossMovements.length})</span>
        </button>
      </div>

      {/* TAB 1: Live Stock */}
      {activeTab === 'stock' && (
        <div className="space-y-3.5">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search product stock..."
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            {products.length === 0 ? (
              <div className="py-12 text-center text-slate-500">
                <Boxes className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-xs">No products match your search.</p>
              </div>
            ) : (
              <>
                {/* Mobile Cards (< md) */}
                <div className="md:hidden divide-y divide-slate-800/80">
                  {products.map(p => {
                    const isLow = p.currentStock <= p.minStock;
                    const isOut = p.currentStock <= 0;

                    return (
                      <div key={p.id} className="p-3.5 space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <ProductThumbnail
                              product={p}
                              size="sm"
                              onClick={() => {
                                setViewingProduct(p);
                                setIsViewerOpen(true);
                              }}
                            />
                            <div className="min-w-0">
                              <h4 className="font-bold text-xs text-white truncate">{p.name}</h4>
                              <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                                SKU: {p.sku}
                              </p>
                            </div>
                          </div>

                          <button
                            onClick={() => {
                              setSelectedProductId(p.id);
                              setQuantityInput('0');
                              setAdjustmentType('OUT');
                              setIsAdjustModalOpen(true);
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600 active:bg-blue-700 text-blue-300 hover:text-white border border-blue-500/30 text-xs font-semibold shrink-0 transition"
                          >
                            Adjust
                          </button>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                          <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                            <div className="text-[9px] text-slate-400">Stock</div>
                            <div
                              className={`font-mono text-[11px] font-bold ${
                                isOut
                                  ? 'text-rose-400'
                                  : isLow
                                  ? 'text-amber-300'
                                  : 'text-emerald-400'
                              }`}
                            >
                              {p.currentStock} {p.unit}
                            </div>
                          </div>
                          <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                            <div className="text-[9px] text-slate-400">Cost</div>
                            <div className="font-mono text-[11px] text-purple-300 font-medium truncate">
                              {formatCurrency(
                                p.currentStock * p.purchasePrice,
                                settings.currencySymbol
                              )}
                            </div>
                          </div>
                          <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                            <div className="text-[9px] text-slate-400">Retail</div>
                            <div className="font-mono text-[11px] text-emerald-400 font-bold truncate">
                              {formatCurrency(
                                p.currentStock * p.sellingPrice,
                                settings.currencySymbol
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Tablet / Desktop Table (md+) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400">
                        <th className="py-3 px-4 font-semibold">SKU</th>
                        <th className="py-3 px-4 font-semibold">Product Name</th>
                        <th className="py-3 px-4 text-center font-semibold">Stock</th>
                        <th className="py-3 px-4 text-center font-semibold">Min</th>
                        <th className="py-3 px-4 text-right font-semibold">Cost/Unit</th>
                        <th className="py-3 px-4 text-right font-semibold">Cost Value</th>
                        <th className="py-3 px-4 text-right font-semibold">Retail Value</th>
                        <th className="py-3 px-4 text-right font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {products.map(p => {
                        const isLow = p.currentStock <= p.minStock;
                        const isOut = p.currentStock <= 0;

                        return (
                          <tr key={p.id} className="hover:bg-slate-850/60 transition">
                            <td className="py-3 px-4 font-mono text-slate-400">{p.sku}</td>
                            <td className="py-3 px-4 font-semibold text-white">
                              <div className="flex items-center gap-2.5">
                                <ProductThumbnail
                                  product={p}
                                  size="sm"
                                  onClick={() => {
                                    setViewingProduct(p);
                                    setIsViewerOpen(true);
                                  }}
                                />
                                <span className="truncate">{p.name}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span
                                className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                                  isOut
                                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                    : isLow
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    : 'bg-emerald-500/15 text-emerald-300'
                                }`}
                              >
                                {p.currentStock} {p.unit}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center font-mono text-slate-400">
                              {p.minStock}
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-slate-400">
                              {formatCurrency(p.purchasePrice, settings.currencySymbol)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-purple-300 font-medium">
                              {formatCurrency(
                                p.currentStock * p.purchasePrice,
                                settings.currencySymbol
                              )}
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-emerald-400 font-bold">
                              {formatCurrency(
                                p.currentStock * p.sellingPrice,
                                settings.currencySymbol
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => {
                                  setSelectedProductId(p.id);
                                  setQuantityInput('0');
                                  setAdjustmentType('OUT');
                                  setIsAdjustModalOpen(true);
                                }}
                                className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 text-[11px] font-medium transition"
                              >
                                Adjust
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Movement Log */}
      {activeTab === 'movements' && (
        <div className="space-y-3.5">
          <select
            value={movementTypeFilter}
            onChange={e => setMovementTypeFilter(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">All Movement Types</option>
            <option value="DAMAGED">💥 Damaged Stock</option>
            <option value="BROKEN">🔨 Broken Stock</option>
            <option value="EXPIRED">⏳ Expired Items</option>
            <option value="LOST">🔍 Lost / Missing</option>
            <option value="CORRECTION">⚖️ Count Corrections</option>
            <option value="RESTOCK">📦 Restock Adjustments</option>
            <option value="SALE">🛒 Sales (Decrements)</option>
            <option value="PURCHASE">🚚 Purchases / Stock In</option>
            <option value="RETURN">↩️ Returns / Restocks</option>
          </select>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            {movements.length === 0 ? (
              <div className="py-12 text-center text-slate-500">
                <History className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-xs">No movements found matching filter.</p>
              </div>
            ) : (
              <>
                {/* Mobile Cards (< md) */}
                <div className="md:hidden divide-y divide-slate-800/80">
                  {movements.map(m => {
                    const isPositive = m.changeQty > 0;
                    const isLossType = ['DAMAGED', 'BROKEN', 'EXPIRED', 'LOST'].includes(m.type);

                    return (
                      <div key={m.id} className="p-3.5 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <h4 className="font-bold text-xs text-white truncate">
                              {m.productName}
                            </h4>
                            <p className="text-[10px] font-mono text-slate-400">
                              {formatDateTime(m.createdAt)}
                            </p>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                              isLossType
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {m.type}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs py-1">
                          <div className="text-slate-400 text-[11px]">
                            Qty:{' '}
                            <strong className={isPositive ? 'text-emerald-400' : 'text-rose-400'}>
                              {isPositive ? `+${m.changeQty}` : m.changeQty}
                            </strong>{' '}
                            ({m.previousQty} → {m.newQty})
                          </div>
                          {m.costValue !== undefined && (
                            <div
                              className={`font-mono text-[11px] font-semibold ${
                                isLossType ? 'text-rose-400' : 'text-slate-300'
                              }`}
                            >
                              {formatCurrency(m.costValue, settings.currencySymbol)}
                            </div>
                          )}
                        </div>

                        {m.reason && (
                          <p className="text-[11px] text-slate-400 bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                            {m.reason}
                          </p>
                        )}
                        <div className="text-[10px] text-slate-500 text-right">
                          By {m.userName}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Tablet / Desktop Table (md+) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400">
                        <th className="py-3 px-4 font-semibold">Timestamp</th>
                        <th className="py-3 px-4 font-semibold">Product</th>
                        <th className="py-3 px-4 font-semibold">Type</th>
                        <th className="py-3 px-4 text-center font-semibold">Delta</th>
                        <th className="py-3 px-4 text-center font-semibold">Before</th>
                        <th className="py-3 px-4 text-center font-semibold">After</th>
                        <th className="py-3 px-4 text-right font-semibold">Loss Value</th>
                        <th className="py-3 px-4 font-semibold">Reason</th>
                        <th className="py-3 px-4 font-semibold">User</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {movements.map(m => {
                        const isPositive = m.changeQty > 0;
                        const isLossType = ['DAMAGED', 'BROKEN', 'EXPIRED', 'LOST'].includes(
                          m.type
                        );

                        return (
                          <tr key={m.id} className="hover:bg-slate-850/60 transition">
                            <td className="py-3 px-4 text-slate-400 font-mono">
                              {formatDateTime(m.createdAt)}
                            </td>
                            <td className="py-3 px-4 font-medium text-white">{m.productName}</td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  isLossType
                                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                    : 'bg-slate-800 text-slate-300'
                                }`}
                              >
                                {m.type}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center font-mono font-bold">
                              <span className={isPositive ? 'text-emerald-400' : 'text-rose-400'}>
                                {isPositive ? `+${m.changeQty}` : m.changeQty}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center font-mono text-slate-400">
                              {m.previousQty}
                            </td>
                            <td className="py-3 px-4 text-center font-mono text-white font-semibold">
                              {m.newQty}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-medium">
                              {m.costValue !== undefined ? (
                                <span
                                  className={
                                    isLossType ? 'text-rose-400 font-bold' : 'text-slate-300'
                                  }
                                >
                                  {formatCurrency(m.costValue, settings.currencySymbol)}
                                </span>
                              ) : (
                                <span className="text-slate-600">-</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-slate-300 max-w-[200px] truncate">
                              {m.reason}
                            </td>
                            <td className="py-3 px-4 text-slate-400">{m.userName}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: Loss Report */}
      {activeTab === 'losses' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2.5">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="text-xs text-slate-400 shrink-0">Period:</span>
              <div className="flex gap-1 overflow-x-auto flex-1">
                {[
                  { id: 'today', label: 'Today' },
                  { id: 'week', label: 'Week' },
                  { id: 'month', label: 'Month' },
                  { id: 'all', label: 'All' },
                ].map(p => (
                  <button
                    key={p.id}
                    onClick={() => setLossPeriod(p.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                      lossPeriod === p.id
                        ? 'bg-rose-600 text-white'
                        : 'bg-slate-800 text-slate-400 active:bg-slate-700'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={lossTypeFilter}
                onChange={e => setLossTypeFilter(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
              >
                <option value="ALL">All Loss Types</option>
                <option value="DAMAGED">💥 Damaged</option>
                <option value="BROKEN">🔨 Broken</option>
                <option value="EXPIRED">⏳ Expired</option>
                <option value="LOST">🔍 Lost</option>
              </select>

              <button
                onClick={handlePrintLossReport}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white text-xs font-semibold transition shrink-0"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-center">
              <span className="text-[10px] text-slate-400 uppercase block mb-1">Loss Value</span>
              <span className="text-sm font-bold text-rose-400 font-mono truncate block">
                {formatCurrency(totalLossValue, settings.currencySymbol)}
              </span>
            </div>
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-center">
              <span className="text-[10px] text-slate-400 uppercase block mb-1">Units</span>
              <span className="text-sm font-bold text-amber-400 font-mono">{totalLossUnits}</span>
            </div>
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-center">
              <span className="text-[10px] text-slate-400 uppercase block mb-1">Records</span>
              <span className="text-sm font-bold text-purple-400 font-mono">
                {filteredLosses.length}
              </span>
            </div>
          </div>

          {/* Loss Records — mobile cards + desktop table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            {filteredLosses.length === 0 ? (
              <div className="py-12 text-center text-slate-500">
                <PackageX className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-xs">No loss records for this period.</p>
              </div>
            ) : (
              <>
                {/* Mobile Cards */}
                <div className="md:hidden divide-y divide-slate-800/80">
                  {filteredLosses.map(m => (
                    <div key={m.id} className="p-3.5 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-xs text-white truncate">
                            {m.productName}
                          </h4>
                          <p className="text-[10px] font-mono text-slate-400">
                            {formatDateTime(m.createdAt)}
                          </p>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/30 text-[10px] font-bold shrink-0">
                          {m.type}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs pt-1">
                        <span className="text-slate-400 text-[11px]">
                          Qty Lost:{' '}
                          <strong className="text-rose-400 font-mono">
                            {Math.abs(m.changeQty)}
                          </strong>
                        </span>
                        <span className="font-mono font-bold text-rose-400 text-xs">
                          {formatCurrency(m.costValue || 0, settings.currencySymbol)}
                        </span>
                      </div>
                      {m.reason && (
                        <p className="text-[11px] text-slate-400 bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                          {m.reason}
                        </p>
                      )}
                      <div className="text-[10px] text-slate-500 text-right">
                        By {m.userName}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table (md+) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400">
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Product</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4 text-center">Qty Lost</th>
                        <th className="py-3 px-4 text-right">Loss Value</th>
                        <th className="py-3 px-4">Reason</th>
                        <th className="py-3 px-4">Recorded By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredLosses.map(m => (
                        <tr key={m.id} className="hover:bg-slate-850/60">
                          <td className="py-3 px-4 text-slate-400 font-mono">
                            {formatDateTime(m.createdAt)}
                          </td>
                          <td className="py-3 px-4 font-semibold text-white">{m.productName}</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/30 text-[10px] font-bold">
                              {m.type}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-rose-400">
                            {Math.abs(m.changeQty)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-rose-400">
                            {formatCurrency(m.costValue || 0, settings.currencySymbol)}
                          </td>
                          <td className="py-3 px-4 text-slate-300 max-w-[200px] truncate">
                            {m.reason}
                          </td>
                          <td className="py-3 px-4 text-slate-400">{m.userName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Manual Stock Adjustment Modal */}
      {isAdjustModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/80 backdrop-blur-sm sm:p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-t-2xl sm:rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <ArrowUpDown className="w-5 h-5 text-blue-400" />
                <h3 className="text-base font-bold text-white">Stock Adjustment</h3>
              </div>
              <button
                onClick={() => setIsAdjustModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="mb-4 p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                {modalError}
              </div>
            )}

            <form onSubmit={handleAdjustStock} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Select Product *</label>
                <select
                  value={selectedProductId}
                  onChange={e => setSelectedProductId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">-- Choose Product --</option>
                  {dbState.products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Current: {p.currentStock} {p.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Adjustment Reason Category *
                </label>
                <select
                  value={adjustmentCategory}
                  onChange={e => {
                    const cat = e.target.value as any;
                    setAdjustmentCategory(cat);
                    if (['DAMAGED', 'BROKEN', 'EXPIRED', 'LOST'].includes(cat)) {
                      setAdjustmentType('OUT');
                    } else if (cat === 'RESTOCK') {
                      setAdjustmentType('IN');
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="DAMAGED">💥 Damaged Goods</option>
                  <option value="BROKEN">🔨 Broken Items</option>
                  <option value="EXPIRED">⏳ Expired Products</option>
                  <option value="LOST">🔍 Lost / Missing Stock</option>
                  <option value="CORRECTION">⚖️ Count Correction</option>
                  <option value="RESTOCK">📦 Restock</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Adjustment Action</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustmentType('IN')}
                    className={`py-2.5 rounded-lg font-semibold transition text-[11px] ${
                      adjustmentType === 'IN'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-950 text-slate-400 border border-slate-800 active:bg-slate-800'
                    }`}
                  >
                    + Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustmentType('OUT')}
                    className={`py-2.5 rounded-lg font-semibold transition text-[11px] ${
                      adjustmentType === 'OUT'
                        ? 'bg-rose-600 text-white'
                        : 'bg-slate-950 text-slate-400 border border-slate-800 active:bg-slate-800'
                    }`}
                  >
                    − Deduct
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustmentType('SET')}
                    className={`py-2.5 rounded-lg font-semibold transition text-[11px] ${
                      adjustmentType === 'SET'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-950 text-slate-400 border border-slate-800 active:bg-slate-800'
                    }`}
                  >
                    = Set Exact
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  {adjustmentType === 'SET' ? 'New Exact Stock Level' : 'Quantity Units'}
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  required
                  value={quantityInput}
                  onChange={e => setQuantityInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-white font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {selectedProduct && adjustmentType === 'OUT' && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs space-y-1">
                  <div className="flex justify-between text-rose-300 font-medium">
                    <span>Estimated Loss:</span>
                    <span className="font-bold font-mono">
                      {formatCurrency(calculatedLossValue, settings.currencySymbol)}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    At cost {formatCurrency(selectedProduct.purchasePrice, settings.currencySymbol)}
                    /unit
                  </p>
                </div>
              )}

              <div>
                <label className="block text-slate-300 font-medium mb-1">Notes (Optional)</label>
                <textarea
                  rows={2}
                  value={reasonInput}
                  onChange={e => setReasonInput(e.target.value)}
                  placeholder="e.g. Broken in shipment..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow transition"
                >
                  Apply Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Product Image Viewer */}
      <ProductImageViewerModal
        product={viewingProduct}
        isOpen={isViewerOpen}
        onClose={() => setIsViewerOpen(false)}
        currencySymbol={settings.currencySymbol}
      />
    </div>
  );
};
