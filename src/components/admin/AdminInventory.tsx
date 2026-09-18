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
  Store,
  ChevronDown,
  ChevronRight,
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

  // Collapse state per shop
  const [collapsedShops, setCollapsedShops] = useState<Set<string>>(new Set());

  // Low stock filter toggle
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);

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

  if (!currentUser) return null;
  if (currentUser.role !== 'ADMIN' && !currentUser.permissions?.canManageInventory) return null;

  const settings = dbState.settings;
  const shops = dbState.shops || [];
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
    const matchesLowFilter = !showLowStockOnly || p.currentStock <= p.minStock;
    return matchesShop && matchesSearch && matchesLowFilter;
  });

  // Group products by shop
  const groupedByShop = shops
    .map(shop => ({
      shop,
      products: products.filter(p => p.shopId === shop.id),
    }))
    .filter(group => group.products.length > 0);

  const productsWithNoShop = products.filter(
    p => !shops.some(s => s.id === p.shopId)
  );

  // Global low stock products (across all shops)
  const allLowStockProducts = dbState.products.filter(
    p => p.status === 'ACTIVE' && p.currentStock <= p.minStock
  );

  const toggleShopCollapse = (shopId: string) => {
    setCollapsedShops(prev => {
      const next = new Set(prev);
      if (next.has(shopId)) next.delete(shopId);
      else next.add(shopId);
      return next;
    });
  };

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
    if (adjustmentType === 'IN') delta = qty;
    else if (adjustmentType === 'OUT') delta = -qty;
    else if (adjustmentType === 'SET') delta = qty - targetProduct.currentStock;

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

  // ==============================
  // PRINT LOW STOCK PDF
  // ==============================
  const handlePrintLowStockReport = () => {
    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    if (!printWindow) {
      addToast({
        type: 'error',
        title: 'Popup Blocked',
        description: 'Please allow popups to print the report.',
      });
      return;
    }

    const lowStockByShop = shops
      .map(shop => ({
        shop,
        products: allLowStockProducts.filter(p => p.shopId === shop.id),
      }))
      .filter(g => g.products.length > 0);

    const totalUnitsNeeded = allLowStockProducts.reduce(
      (sum, p) => sum + Math.max(0, p.minStock - p.currentStock),
      0
    );

    const estimatedRestockCost = allLowStockProducts.reduce(
      (sum, p) => sum + Math.max(0, p.minStock - p.currentStock) * p.purchasePrice,
      0
    );

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Low Stock Report - ${settings.businessName}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 20px; color: #1e293b; background: #fff; }
          .header { text-align: center; margin-bottom: 20px; border-bottom: 3px double #f59e0b; padding-bottom: 15px; }
          .header h1 { font-size: 22px; color: #b45309; margin-bottom: 6px; }
          .header .company { font-size: 13px; color: #475569; }
          .header .meta { font-size: 11px; color: #64748b; margin-top: 8px; }
          .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px; }
          .summary-card { padding: 12px; border-radius: 10px; text-align: center; color: #fff; }
          .summary-card.count { background: linear-gradient(135deg, #f59e0b, #d97706); }
          .summary-card.units { background: linear-gradient(135deg, #8b5cf6, #7c3aed); }
          .summary-card.cost { background: linear-gradient(135deg, #dc2626, #991b1b); }
          .summary-card .label { font-size: 10px; text-transform: uppercase; opacity: 0.95; }
          .summary-card .value { font-size: 16px; font-weight: bold; margin-top: 5px; }
          .shop-section { margin-bottom: 20px; page-break-inside: avoid; }
          .shop-header { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: #1e293b; color: #fff; border-radius: 8px 8px 0 0; }
          .shop-header h2 { font-size: 14px; font-weight: bold; }
          .shop-header .shop-stats { font-size: 10px; opacity: 0.85; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          thead { background: #f1f5f9; color: #334155; }
          th { padding: 8px 6px; text-align: left; font-weight: 600; border-bottom: 2px solid #cbd5e1; }
          td { padding: 7px 6px; border-bottom: 1px solid #e2e8f0; }
          tr:nth-child(even) { background: #f8fafc; }
          .sku { font-family: 'Courier New', monospace; font-size: 10px; color: #475569; }
          .stock-current { font-weight: bold; color: #dc2626; font-family: 'Courier New', monospace; }
          .stock-min { color: #475569; font-family: 'Courier New', monospace; }
          .stock-needed { font-weight: bold; color: #b45309; font-family: 'Courier New', monospace; }
          .cost { text-align: right; font-family: 'Courier New', monospace; font-weight: bold; color: #dc2626; }
          .product-name { font-weight: 600; color: #1e293b; }
          .footer { text-align: center; margin-top: 25px; padding-top: 12px; border-top: 2px solid #e2e8f0; font-size: 10px; color: #94a3b8; }
          .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: bold; }
          .badge.critical { background: #fee2e2; color: #991b1b; }
          .badge.warning { background: #fef3c7; color: #92400e; }
          .empty-state { text-align: center; padding: 35px; color: #64748b; background: #f8fafc; border-radius: 8px; }
          @media (min-width: 640px) {
            body { padding: 30px; }
            .header h1 { font-size: 26px; }
            .summary-card .value { font-size: 20px; }
          }
          @media print {
            body { padding: 0; }
            .shop-section { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📦 Low Stock & Restock Report</h1>
          <div class="company">${settings.businessName}</div>
          <div class="meta">Generated: ${new Date().toLocaleString()} • All Shops Combined</div>
        </div>
        <div class="summary-grid">
          <div class="summary-card count">
            <div class="label">Low Stock Items</div>
            <div class="value">${allLowStockProducts.length}</div>
          </div>
          <div class="summary-card units">
            <div class="label">Units To Restock</div>
            <div class="value">${totalUnitsNeeded}</div>
          </div>
          <div class="summary-card cost">
            <div class="label">Est. Restock Cost</div>
            <div class="value">${settings.currencySymbol} ${estimatedRestockCost.toLocaleString()}</div>
          </div>
        </div>
        ${
          lowStockByShop.length === 0
            ? `<div class="empty-state">
                <h3 style="color:#16a34a; margin-bottom:8px;">✅ All Good!</h3>
                <p>No low stock items found across any shop.</p>
              </div>`
            : lowStockByShop.map(group => `
              <div class="shop-section">
                <div class="shop-header">
                  <h2>🏪 ${group.shop.name}</h2>
                  <span class="shop-stats">Code: ${group.shop.code || 'UNIT'} • ${group.products.length} ${group.products.length === 1 ? 'item' : 'items'}</span>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>Product Name</th>
                      <th>SKU</th>
                      <th style="text-align:center;">Stock</th>
                      <th style="text-align:center;">Min</th>
                      <th style="text-align:center;">Needed</th>
                      <th style="text-align:right;">Cost/Unit</th>
                      <th style="text-align:right;">Restock Cost</th>
                      <th style="text-align:center;">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${group.products.map(p => {
                      const unitsNeeded = Math.max(0, p.minStock - p.currentStock);
                      const restockCost = unitsNeeded * p.purchasePrice;
                      const isCritical = p.currentStock <= 0;
                      return `
                        <tr>
                          <td class="product-name">${p.name}</td>
                          <td class="sku">${p.sku}</td>
                          <td style="text-align:center;" class="stock-current">${p.currentStock} ${p.unit}</td>
                          <td style="text-align:center;" class="stock-min">${p.minStock} ${p.unit}</td>
                          <td style="text-align:center;" class="stock-needed">${unitsNeeded}</td>
                          <td class="cost" style="color:#475569;">${settings.currencySymbol} ${p.purchasePrice.toLocaleString()}</td>
                          <td class="cost">${settings.currencySymbol} ${restockCost.toLocaleString()}</td>
                          <td style="text-align:center;">
                            <span class="badge ${isCritical ? 'critical' : 'warning'}">
                              ${isCritical ? 'OUT' : 'LOW'}
                            </span>
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            `).join('')
        }
        <div class="footer">
          ${settings.businessName} • ${settings.address || ''}<br>
          Phone: ${settings.phone || 'N/A'}
        </div>
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();

    addToast({
      type: 'success',
      title: 'Low Stock Report',
      description: `Print dialog opened with ${allLowStockProducts.length} low stock items.`,
    });
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

  // ==============================
  // MOBILE STOCK CARD
  // ==============================
  const renderStockCard = (p: Product) => {
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
              <p className="text-[10px] font-mono text-slate-400 mt-0.5">SKU: {p.sku}</p>
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
                isOut ? 'text-rose-400' : isLow ? 'text-amber-300' : 'text-emerald-400'
              }`}
            >
              {p.currentStock} {p.unit}
            </div>
          </div>
          <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800">
            <div className="text-[9px] text-slate-400">Cost</div>
            <div className="font-mono text-[11px] text-purple-300 font-medium truncate">
              {formatCurrency(p.currentStock * p.purchasePrice, settings.currencySymbol)}
            </div>
          </div>
          <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800">
            <div className="text-[9px] text-slate-400">Retail</div>
            <div className="font-mono text-[11px] text-emerald-400 font-bold truncate">
              {formatCurrency(p.currentStock * p.sellingPrice, settings.currencySymbol)}
            </div>
          </div>
        </div>
      </div>
    );
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

        <div className="flex flex-col gap-2">
          {/* Low Stock Report Button */}
          <button
            onClick={handlePrintLowStockReport}
            className="flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white font-semibold text-xs shadow-lg transition"
          >
            <Printer className="w-4 h-4" />
            <span>Low Stock Report (PDF)</span>
            {allLowStockProducts.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-white/20 text-[10px] font-bold">
                {allLowStockProducts.length}
              </span>
            )}
          </button>

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

      {/* TAB 1: Live Stock (Grouped by Shop) */}
      {activeTab === 'stock' && (
        <div className="space-y-3.5">
          {/* Search + Low Stock filter */}
          <div className="space-y-2.5">
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

            <button
              onClick={() => setShowLowStockOnly(!showLowStockOnly)}
              className={`w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-semibold border transition ${
                showLowStockOnly
                  ? 'bg-amber-600 text-white border-amber-500'
                  : 'bg-slate-900 text-slate-300 border-slate-800 active:bg-slate-800'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Low Stock Only</span>
              {allLowStockProducts.length > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    showLowStockOnly ? 'bg-white/20' : 'bg-amber-500/20 text-amber-300'
                  }`}
                >
                  {allLowStockProducts.length}
                </span>
              )}
            </button>
          </div>

          {/* Grouped by Shop */}
          {products.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl py-12 text-center text-slate-500">
              <Boxes className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-xs">
                {showLowStockOnly
                  ? 'No low stock items match your search.'
                  : 'No products match your search.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {groupedByShop.map(({ shop, products: shopProducts }) => {
                const isCollapsed = collapsedShops.has(shop.id);
                const shopLowStock = shopProducts.filter(
                  p => p.status === 'ACTIVE' && p.currentStock <= p.minStock
                ).length;
                const shopValue = shopProducts.reduce(
                  (sum, p) => sum + p.currentStock * p.purchasePrice,
                  0
                );

                return (
                  <div
                    key={shop.id}
                    className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg"
                  >
                    {/* Shop Header */}
                    <button
                      onClick={() => toggleShopCollapse(shop.id)}
                      className="w-full flex items-center justify-between gap-3 p-3.5 bg-slate-900/80 hover:bg-slate-800/60 active:bg-slate-800 transition border-b border-slate-800"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                          <Store className="w-4.5 h-4.5" />
                        </div>
                        <div className="min-w-0 text-left">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className="text-sm font-bold text-white truncate">
                              {shop.name}
                            </h3>
                            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                              {shop.code || 'UNIT'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {shopProducts.length}{' '}
                            {shopProducts.length === 1 ? 'SKU' : 'SKUs'} • Stock:{' '}
                            {formatCurrency(shopValue, settings.currencySymbol)}
                            {shopLowStock > 0 && (
                              <span className="text-amber-400 ml-1">
                                • {shopLowStock} low
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {shopLowStock > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-[9px] font-bold border border-amber-500/30">
                            ⚠ {shopLowStock}
                          </span>
                        )}
                        {isCollapsed ? (
                          <ChevronRight className="w-5 h-5 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                    </button>

                    {!isCollapsed && (
                      <div className="divide-y divide-slate-800/80">
                        {shopProducts.map(renderStockCard)}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Unassigned Products */}
              {productsWithNoShop.length > 0 && (
                <div className="bg-slate-900 border border-amber-800/40 rounded-2xl overflow-hidden shadow-lg">
                  <div className="flex items-center gap-2.5 p-3.5 bg-amber-950/20 border-b border-amber-800/40">
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                    <div>
                      <h3 className="text-sm font-bold text-white">Unassigned Products</h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {productsWithNoShop.length} products have an invalid shop
                      </p>
                    </div>
                  </div>
                  <div className="divide-y divide-slate-800/80">
                    {productsWithNoShop.map(renderStockCard)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Movement Log (unchanged) */}
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
              <div className="divide-y divide-slate-800/80">
                {movements.map(m => {
                  const isPositive = m.changeQty > 0;
                  const isLossType = ['DAMAGED', 'BROKEN', 'EXPIRED', 'LOST'].includes(m.type);

                  return (
                    <div key={m.id} className="p-3.5 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-xs text-white truncate">{m.productName}</h4>
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
                      <div className="text-[10px] text-slate-500 text-right">By {m.userName}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: Loss Report (unchanged) */}
      {activeTab === 'losses' && (
        <div className="space-y-4">
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

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            {filteredLosses.length === 0 ? (
              <div className="py-12 text-center text-slate-500">
                <PackageX className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-xs">No loss records for this period.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80">
                {filteredLosses.map(m => (
                  <div key={m.id} className="p-3.5 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-xs text-white truncate">{m.productName}</h4>
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
                        <strong className="text-rose-400 font-mono">{Math.abs(m.changeQty)}</strong>
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
                    <div className="text-[10px] text-slate-500 text-right">By {m.userName}</div>
                  </div>
                ))}
              </div>
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

      <ProductImageViewerModal
        product={viewingProduct}
        isOpen={isViewerOpen}
        onClose={() => setIsViewerOpen(false)}
        currencySymbol={settings.currencySymbol}
      />
    </div>
  );
};
