import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Receipt,
  Calendar,
  X,
  Ban,
  RotateCcw,
  Printer,
  Download,
  Pencil,
  Check,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SalesService, CartItemInput } from '../../services/salesService';
import { CloudflareApi } from '../../services/cloudflareApi';
import { SyncService } from '../../services/syncService';
import { db } from '../../db/storage';
import { Sale, SaleEditRequest } from '../../types';
import { formatCurrency, formatDateTime } from '../../utils/formatters';

type DatePreset = 'TODAY' | 'WEEK' | 'MONTH' | 'CUSTOM';

export const AdminSales: React.FC = () => {
  const { currentUser, showReceipt, dbState, addToast } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [sellerFilter, setSellerFilter] = useState('ALL');
  const [paymentFilter, setPaymentFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [shopFilter, setShopFilter] = useState('ALL');
  const [datePreset, setDatePreset] = useState<DatePreset>('TODAY');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isPrinting, setIsPrinting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Void Dialog
  const [voidingSale, setVoidingSale] = useState<Sale | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [isVoiding, setIsVoiding] = useState(false);

  // Edit Dialog
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [editItems, setEditItems] = useState<CartItemInput[]>([]);
  const [editReason, setEditReason] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // Pending edit requests toggle
  const [showEditRequests, setShowEditRequests] = useState(false);

  // ---------- Date helpers ----------
  const toYMD = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const computePresetRange = (
    preset: DatePreset
  ): { start: string; end: string } | null => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (preset === 'TODAY') {
      return { start: toYMD(today), end: toYMD(today) };
    }

    if (preset === 'WEEK') {
      const start = new Date(today);
      start.setDate(start.getDate() - 6); // last 7 days rolling
      return { start: toYMD(start), end: toYMD(today) };
    }

    if (preset === 'MONTH') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: toYMD(start), end: toYMD(today) };
    }

    return null; // CUSTOM
  };

  // Apply preset → compute start/end (except CUSTOM)
  useEffect(() => {
    if (datePreset === 'CUSTOM') return;
    const range = computePresetRange(datePreset);
    if (range) {
      setStartDate(range.start);
      setEndDate(range.end);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datePreset]);

  // Permission check
  if (!currentUser) return null;
  if (
    currentUser.role !== 'ADMIN' &&
    !currentUser.permissions?.canEditSales &&
    !currentUser.permissions?.canDeleteSales
  )
    return null;

  const canEditSale = currentUser.role === 'ADMIN' || currentUser.permissions?.canEditSales;
  const canVoidSale = currentUser.role === 'ADMIN' || currentUser.permissions?.canDeleteSales;
  const isAdmin = currentUser.role === 'ADMIN';

  // Force pull on mount
  useEffect(() => {
    const forcePull = async () => {
      try {
        const online = await CloudflareApi.checkConnection();
        if (!online) return;

        console.log('[AdminSales] Pulling latest sale edit requests...');
        const pullResult = await CloudflareApi.pullSync();

        if (pullResult.success && pullResult.data) {
          SyncService.applyCloudData(pullResult.data);
          const state = db.getState();
          console.log(
            '[AdminSales] Pull completed, edit requests:',
            state.saleEditRequests?.length || 0
          );
        }
      } catch (error) {
        console.log('[AdminSales] Pull error:', error);
      }
    };

    forcePull();
  }, []);

  const refreshEditRequests = async () => {
    setIsRefreshing(true);
    try {
      const online = await CloudflareApi.checkConnection();
      if (!online) {
        addToast({
          type: 'error',
          title: 'Offline',
          description: 'Cannot refresh while offline.',
        });
        return;
      }

      const pullResult = await CloudflareApi.pullSync();
      if (pullResult.success && pullResult.data) {
        SyncService.applyCloudData(pullResult.data);
        addToast({
          type: 'success',
          title: 'Refreshed',
          description: 'Sale edit requests updated.',
        });
      }
    } catch (error) {
      console.log('Refresh error:', error);
      addToast({
        type: 'error',
        title: 'Refresh Failed',
        description: 'Could not refresh data.',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const settings = dbState.settings;
  const sellers = dbState.users.filter(u => u.role === 'SELLER');
  const shops = dbState.shops || [];
  const products = dbState.products || [];
  const editRequests = SalesService.getSaleEditRequests(currentUser);
  const pendingRequests = editRequests.filter(r => r.status === 'PENDING');

  const sales = SalesService.getSales(
    {
      search: searchQuery,
      sellerId: sellerFilter === 'ALL' ? undefined : sellerFilter,
      paymentMethod: paymentFilter === 'ALL' ? undefined : (paymentFilter as any),
      status: statusFilter === 'ALL' ? undefined : (statusFilter as any),
      shopId: shopFilter === 'ALL' ? undefined : shopFilter,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    },
    currentUser
  );

  const totalVolume = sales.reduce(
    (sum, s) => (s.status === 'COMPLETED' ? sum + s.total : sum),
    0
  );
  const totalProfit = sales.reduce(
    (sum, s) => (s.status === 'COMPLETED' ? sum + s.grossProfit : sum),
    0
  );

  const selectedShopName =
    shopFilter === 'ALL'
      ? 'All Shops'
      : shops.find(s => s.id === shopFilter)?.name || 'Unknown Shop';

  const handleExecuteVoid = () => {
    if (!voidingSale || !currentUser) return;
    if (!voidReason.trim()) {
      addToast({
        type: 'warning',
        title: 'Reason Required',
        description: 'Please provide a reason for cancelling this sale.',
      });
      return;
    }

    setIsVoiding(true);
    const res = SalesService.voidSale(voidingSale.id, voidReason, currentUser);
    setIsVoiding(false);

    if (res.success) {
      addToast({
        type: 'success',
        title: 'Sale Voided & Inventory Restored',
        description: `Receipt #${voidingSale.receiptNumber} marked voided. All product quantities were returned to stock.`,
      });
      setVoidingSale(null);
      setVoidReason('');
    } else {
      addToast({
        type: 'error',
        title: 'Void Failed',
        description: res.error || 'Could not void transaction.',
      });
    }
  };

  const openEditSale = (sale: Sale) => {
    setEditingSale(sale);
    setEditItems(
      sale.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount || 0,
      }))
    );
    setEditReason('');
  };

  const handleSaveEdit = () => {
    if (!editingSale || !currentUser) return;

    setIsEditing(true);
    const result = SalesService.requestSaleEdit(
      editingSale.id,
      editItems,
      editReason || 'Admin correction',
      currentUser
    );
    setIsEditing(false);

    if (result.success) {
      addToast({
        type: 'success',
        title: result.requiresApproval ? 'Edit Request Sent' : 'Sale Edited Successfully',
        description: result.requiresApproval
          ? 'Your edit request has been sent for admin approval.'
          : `Receipt #${editingSale.receiptNumber} updated. Stock recalculated.`,
      });
      setEditingSale(null);
      setEditItems([]);
      setEditReason('');
    } else {
      addToast({
        type: 'error',
        title: 'Edit Failed',
        description: result.error || 'Could not edit sale.',
      });
    }
  };

  const handleReviewRequest = (request: SaleEditRequest, action: 'APPROVE' | 'REJECT') => {
    if (!currentUser) return;

    const reviewNote = action === 'REJECT' ? 'Rejected by admin' : undefined;
    const result = SalesService.reviewSaleEdit(request.id, action, currentUser, reviewNote);

    if (result.success) {
      addToast({
        type: 'success',
        title: action === 'APPROVE' ? 'Edit Approved' : 'Edit Rejected',
        description:
          action === 'APPROVE'
            ? 'Sale edit approved. Stock recalculated.'
            : 'Sale edit request rejected.',
      });
    } else {
      addToast({
        type: 'error',
        title: 'Review Failed',
        description: result.error || 'Could not process review.',
      });
    }
  };

  const handlePrint = () => {
    setIsPrinting(true);

    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    if (!printWindow) {
      addToast({
        type: 'error',
        title: 'Popup Blocked',
        description: 'Please allow popups to print.',
      });
      setIsPrinting(false);
      return;
    }

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Sales Report - ${selectedShopName}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; background: #fff; color: #1e293b; }
          .header { text-align: center; margin-bottom: 20px; border-bottom: 3px double #3b82f6; padding-bottom: 15px; }
          .header h1 { font-size: 22px; color: #1e40af; font-weight: bold; }
          .header .company { font-size: 13px; color: #475569; margin-top: 5px; }
          .header .meta { font-size: 11px; color: #64748b; margin-top: 8px; line-height: 1.5; }
          .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 18px; }
          .summary-card { padding: 12px; border-radius: 8px; text-align: center; }
          .summary-card.total { background: #eff6ff; border: 2px solid #3b82f6; }
          .summary-card.profit { background: #f0fdf4; border: 2px solid #22c55e; }
          .summary-card.count { background: #fef3c7; border: 2px solid #f59e0b; }
          .summary-card .label { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 600; }
          .summary-card .value { font-size: 16px; font-weight: bold; margin-top: 5px; }
          .summary-card.total .value { color: #1e40af; }
          .summary-card.profit .value { color: #16a34a; }
          .summary-card.count .value { color: #d97706; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          thead { background: #1e293b; color: #fff; }
          th { padding: 8px 6px; text-align: left; font-weight: 600; }
          td { padding: 7px 6px; border-bottom: 1px solid #e2e8f0; }
          tr:nth-child(even) { background: #f8fafc; }
          .status-completed { color: #16a34a; font-weight: bold; }
          .status-voided { color: #dc2626; font-weight: bold; }
          .amount { text-align: right; font-family: 'Courier New', monospace; font-weight: bold; }
          .items-list { max-width: 250px; }
          .item-tag { display: inline-block; background: #e0e7ff; color: #4338ca; padding: 2px 6px; border-radius: 4px; margin: 2px; font-size: 10px; }
          .footer { text-align: center; margin-top: 20px; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; }
          .shop-badge { display: inline-block; background: #dbeafe; color: #1e40af; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; margin-top: 8px; }

          @media (min-width: 640px) {
            body { padding: 30px; }
            .header h1 { font-size: 26px; }
            .summary-card .value { font-size: 20px; }
            table { font-size: 12px; }
            th { padding: 10px 8px; }
            td { padding: 9px 8px; }
          }

          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${settings.businessName}</h1>
          <div class="company">${settings.tagline || ''}</div>
          <div class="meta">
            <strong>Sales History Report</strong><br>
            Shop: ${selectedShopName} | Period: ${startDate || 'Beginning'} to ${endDate || 'Present'}<br>
            Generated: ${new Date().toLocaleString()}
          </div>
          <div class="shop-badge">🏪 ${selectedShopName}</div>
        </div>

        <div class="summary">
          <div class="summary-card total">
            <div class="label">Total Revenue</div>
            <div class="value">${settings.currencySymbol} ${totalVolume.toLocaleString()}</div>
          </div>
          <div class="summary-card profit">
            <div class="label">Gross Profit</div>
            <div class="value">${settings.currencySymbol} ${totalProfit.toLocaleString()}</div>
          </div>
          <div class="summary-card count">
            <div class="label">Transactions</div>
            <div class="value">${sales.length}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Receipt #</th>
              <th>Date & Time</th>
              <th>Shop</th>
              <th>Seller</th>
              <th>Products Sold</th>
              <th>Payment</th>
              <th>Status</th>
              <th class="amount">Total</th>
              <th class="amount">Profit</th>
            </tr>
          </thead>
          <tbody>
            ${sales.map(sale => `
              <tr>
                <td><strong>${sale.receiptNumber}</strong></td>
                <td>${formatDateTime(sale.createdAt)}</td>
                <td>${sale.shopName || 'N/A'}</td>
                <td>${sale.sellerName}</td>
                <td class="items-list">
                  ${(sale.items || []).map(item =>
                    `<span class="item-tag">${item.quantity}x ${item.productName}</span>`
                  ).join('')}
                </td>
                <td>${sale.paymentMethod}</td>
                <td class="${sale.status === 'COMPLETED' ? 'status-completed' : 'status-voided'}">${sale.status}</td>
                <td class="amount">${settings.currencySymbol} ${sale.total.toLocaleString()}</td>
                <td class="amount">${sale.status === 'COMPLETED' ? `${settings.currencySymbol} ${sale.grossProfit.toLocaleString()}` : `${settings.currencySymbol} 0`}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          ${settings.businessName} - ${settings.address || ''} | Phone: ${settings.phone || 'N/A'}<br>
          ${settings.receiptFooterNote || 'Thank you for your business!'}
        </div>

        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();

    setTimeout(() => setIsPrinting(false), 2000);
  };

  const handleExportCSV = () => {
    let csv = `Sales Report - ${selectedShopName}\n`;
    csv += `Generated: ${new Date().toLocaleString()}\n\n`;
    csv += `Receipt #,Date,Shop,Seller,Products,Payment,Status,Total,Profit\n`;

    sales.forEach(sale => {
      const products = (sale.items || [])
        .map(i => `${i.quantity}x ${i.productName}`)
        .join('; ');
      csv += `"${sale.receiptNumber}","${formatDateTime(sale.createdAt)}","${sale.shopName || ''}","${sale.sellerName}","${products}","${sale.paymentMethod}","${sale.status}",${sale.total},${sale.status === 'COMPLETED' ? sale.grossProfit : 0}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sales_report_${selectedShopName
      .toLowerCase()
      .replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const hasActiveFilters =
    searchQuery ||
    sellerFilter !== 'ALL' ||
    paymentFilter !== 'ALL' ||
    statusFilter !== 'ALL' ||
    shopFilter !== 'ALL' ||
    datePreset !== 'TODAY' ||
    (datePreset === 'CUSTOM' && (startDate || endDate));

  // Colored presets config
  const presets: { id: DatePreset; label: string; activeClass: string; idleClass: string }[] = [
    {
      id: 'TODAY',
      label: 'Today',
      activeClass: 'bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-500/30',
      idleClass: 'bg-blue-500/10 border-blue-500/30 text-blue-300 hover:bg-blue-500/20',
    },
    {
      id: 'WEEK',
      label: 'Week',
      activeClass: 'bg-emerald-600 border-emerald-500 text-white shadow-md shadow-emerald-500/30',
      idleClass: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20',
    },
    {
      id: 'MONTH',
      label: 'Month',
      activeClass: 'bg-violet-600 border-violet-500 text-white shadow-md shadow-violet-500/30',
      idleClass: 'bg-violet-500/10 border-violet-500/30 text-violet-300 hover:bg-violet-500/20',
    },
    {
      id: 'CUSTOM',
      label: 'Custom',
      activeClass: 'bg-amber-500 border-amber-400 text-white shadow-md shadow-amber-500/30',
      idleClass: 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20',
    },
  ];

  return (
    <div
      id="admin-sales-view"
      className="flex-1 p-3.5 sm:p-6 bg-slate-950 text-slate-100 overflow-y-auto pb-24 sm:pb-6"
    >
      {/* Header */}
      <div className="flex flex-col gap-3 mb-5 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
            Sales & Transactions
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Audit store sales, filter by cashier or payment gateway, and manage voiding
          </p>
        </div>

        {/* KPI cards + Print/CSV */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
              Completed Rev
            </span>
            <span className="text-sm font-bold text-emerald-400 font-mono">
              {formatCurrency(totalVolume, settings.currencySymbol)}
            </span>
          </div>
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
              Gross Profit
            </span>
            <span className="text-sm font-bold text-blue-400 font-mono">
              {formatCurrency(totalProfit, settings.currencySymbol)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            disabled={isPrinting}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-semibold shadow transition disabled:opacity-50"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 border border-slate-700 text-xs font-semibold transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Pending Edit Requests */}
      {canEditSale && (
        <div className="mb-4 p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl">
          <div className="flex items-center justify-between mb-2.5 gap-2 flex-wrap">
            <h3 className="text-xs sm:text-sm font-bold text-amber-300 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Pending Edit Requests ({pendingRequests.length})
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={refreshEditRequests}
                disabled={isRefreshing}
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 active:text-blue-200 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Refreshing' : 'Refresh'}
              </button>
              <button
                onClick={() => setShowEditRequests(!showEditRequests)}
                className="text-xs text-slate-400 hover:text-white transition"
              >
                {showEditRequests ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {showEditRequests && pendingRequests.length > 0 &&
            pendingRequests.map(request => (
              <div
                key={request.id}
                className="p-3 bg-slate-950 rounded-lg border border-slate-800 mb-2"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-white text-xs">
                      From: {request.requestedByName}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {formatDateTime(request.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    <strong>Reason:</strong> {request.reason}
                  </p>
                  <div className="text-[11px] text-slate-500">
                    <strong>Original:</strong>{' '}
                    {formatCurrency(request.originalValues.total, settings.currencySymbol)} →{' '}
                    <strong>New:</strong>{' '}
                    {formatCurrency(request.newValues.total, settings.currencySymbol)}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    <strong>Items:</strong> {request.originalValues.items.length} →{' '}
                    {request.newValues.items.length}
                  </div>

                  {isAdmin && (
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => handleReviewRequest(request, 'APPROVE')}
                        className="flex-1 px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-semibold transition flex items-center justify-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Approve
                      </button>
                      <button
                        onClick={() => handleReviewRequest(request, 'REJECT')}
                        className="flex-1 px-3 py-2 rounded bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white text-xs font-semibold transition flex items-center justify-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" />
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

          {showEditRequests && pendingRequests.length === 0 && (
            <div className="p-3 text-center text-slate-500 text-xs">
              No pending edit requests.
            </div>
          )}
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 mb-4 space-y-2.5 text-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search receipt, seller, items..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Date Preset Pills */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
              Period
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {presets.map(p => {
              const isActive = datePreset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setDatePreset(p.id)}
                  className={`py-2 rounded-lg border text-[11px] font-semibold transition active:scale-95 ${
                    isActive ? p.activeClass : p.idleClass
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom date range inputs — only when CUSTOM */}
        {datePreset === 'CUSTOM' && (
          <div className="grid grid-cols-2 gap-2 pt-1 animate-in fade-in duration-150">
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">From</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white w-full focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">To</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white w-full focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <select
            value={shopFilter}
            onChange={e => setShopFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">🏪 All Shops</option>
            {shops.map(s => (
              <option key={s.id} value={s.id}>
                🏪 {s.name}
              </option>
            ))}
          </select>

          <select
            value={sellerFilter}
            onChange={e => setSellerFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">All Sellers</option>
            {sellers.map(s => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <select
            value={paymentFilter}
            onChange={e => setPaymentFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">All Payment Methods</option>
            <option value="CASH">Cash</option>
            <option value="CARD">Card</option>
            <option value="MOBILE_MONEY">Mobile Money</option>
            <option value="BANK">Bank</option>
            <option value="OTHER">Other</option>
          </select>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="COMPLETED">Completed</option>
            <option value="VOIDED">Voided</option>
          </select>
        </div>

        {hasActiveFilters && (
          <button
            onClick={() => {
              setSearchQuery('');
              setSellerFilter('ALL');
              setPaymentFilter('ALL');
              setStatusFilter('ALL');
              setShopFilter('ALL');
              setDatePreset('TODAY');
              // startDate / endDate auto-updated by useEffect
            }}
            className="w-full px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-300 font-semibold transition text-xs"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Sales List */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {sales.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <Receipt className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-xs">No transaction records found.</p>
          </div>
        ) : (
          <>
            {/* Mobile Cards (< md) */}
            <div className="md:hidden divide-y divide-slate-800/80">
              {sales.map(sale => {
                const isVoided = sale.status === 'VOIDED';

                return (
                  <div
                    key={sale.id}
                    className={`p-3.5 space-y-2.5 ${isVoided ? 'opacity-65' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-white text-xs">
                            #{sale.receiptNumber}
                          </span>
                          <span
                            className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                              !isVoided
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {sale.status}
                          </span>
                        </div>
                        <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                          {formatDateTime(sale.createdAt)}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-mono font-bold text-white text-sm">
                          {formatCurrency(sale.total, settings.currencySymbol)}
                        </div>
                        <div className="font-mono text-[10px] text-emerald-400">
                          {isVoided
                            ? formatCurrency(0, settings.currencySymbol)
                            : `+${formatCurrency(sale.grossProfit, settings.currencySymbol)}`}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                      <span className="px-1.5 py-0.2 rounded bg-blue-950 text-blue-300 border border-blue-800/50 font-semibold">
                        🏪 {sale.shopName || 'N/A'}
                      </span>
                      <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                        {sale.sellerName}
                      </span>
                      <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 uppercase">
                        {sale.paymentMethod}
                      </span>
                    </div>

                    <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                      <p className="text-[10px] text-slate-500 truncate">
                        {(sale.items || [])
                          .map(i => `${i.quantity}x ${i.productName}`)
                          .join(', ')}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 pt-1.5 border-t border-slate-800/60">
                      <button
                        onClick={() => showReceipt(sale)}
                        className="flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 text-[11px] font-semibold transition"
                      >
                        Receipt
                      </button>

                      {!isVoided && canEditSale && (
                        <button
                          onClick={() => openEditSale(sale)}
                          className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-blue-500/15 hover:bg-blue-600 active:bg-blue-700 text-blue-300 hover:text-white text-[11px] font-semibold border border-blue-500/30 transition"
                        >
                          <Pencil className="w-3 h-3" />
                          Edit
                        </button>
                      )}

                      {!isVoided && canVoidSale && (
                        <button
                          onClick={() => {
                            setVoidingSale(sale);
                            setVoidReason('');
                          }}
                          className="flex-1 py-2 rounded-lg bg-rose-500/15 hover:bg-rose-600 active:bg-rose-700 text-rose-300 hover:text-white text-[11px] font-semibold border border-rose-500/30 transition"
                        >
                          Void
                        </button>
                      )}
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
                    <th className="py-3 px-4 font-semibold">Receipt</th>
                    <th className="py-3 px-4 font-semibold">Date & Time</th>
                    <th className="py-3 px-4 font-semibold">Shop</th>
                    <th className="py-3 px-4 font-semibold">Seller</th>
                    <th className="py-3 px-4 font-semibold">Products</th>
                    <th className="py-3 px-4 font-semibold">Payment</th>
                    <th className="py-3 px-4 text-right font-semibold">Total</th>
                    <th className="py-3 px-4 text-right font-semibold">Profit</th>
                    <th className="py-3 px-4 text-center font-semibold">Status</th>
                    <th className="py-3 px-4 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {sales.map(sale => {
                    const isVoided = sale.status === 'VOIDED';

                    return (
                      <tr
                        key={sale.id}
                        className={`hover:bg-slate-850/60 transition ${
                          isVoided ? 'opacity-65' : ''
                        }`}
                      >
                        <td className="py-3 px-4 font-mono font-bold text-white">
                          {sale.receiptNumber}
                        </td>
                        <td className="py-3 px-4 text-slate-400">
                          {formatDateTime(sale.createdAt)}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded bg-blue-950/70 text-blue-300 border border-blue-800/50 text-[10px] font-semibold">
                            🏪 {sale.shopName || 'N/A'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-300 font-medium">
                          {sale.sellerName}
                        </td>
                        <td className="py-3 px-4 max-w-xs">
                          <div className="flex flex-wrap gap-1">
                            {(sale.items || []).map((item, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700/60 text-[11px] text-slate-200"
                              >
                                <span className="font-bold text-blue-400">
                                  {item.quantity}x
                                </span>
                                <span className="truncate max-w-[120px]">
                                  {item.productName}
                                </span>
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] uppercase font-medium">
                            {sale.paymentMethod}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-white">
                          {formatCurrency(sale.total, settings.currencySymbol)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                          {isVoided
                            ? formatCurrency(0, settings.currencySymbol)
                            : `+${formatCurrency(sale.grossProfit, settings.currencySymbol)}`}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              !isVoided
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {sale.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            onClick={() => showReceipt(sale)}
                            className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium transition"
                          >
                            Receipt
                          </button>
                          {!isVoided && (
                            <>
                              {canEditSale && (
                                <button
                                  onClick={() => openEditSale(sale)}
                                  className="px-2 py-1.5 rounded bg-blue-500/15 hover:bg-blue-600 hover:text-white text-blue-300 text-[11px] font-semibold border border-blue-500/30 transition"
                                >
                                  <Pencil className="w-3 h-3 inline mr-0.5" />
                                  Edit
                                </button>
                              )}
                              {canVoidSale && (
                                <button
                                  onClick={() => {
                                    setVoidingSale(sale);
                                    setVoidReason('');
                                  }}
                                  className="px-2 py-1.5 rounded bg-rose-500/15 hover:bg-rose-600 hover:text-white text-rose-300 text-[11px] font-semibold border border-rose-500/30 transition"
                                >
                                  Void
                                </button>
                              )}
                            </>
                          )}
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

      {/* Edit Sale Modal */}
      {editingSale && canEditSale && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/80 backdrop-blur-sm sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-t-2xl sm:rounded-2xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl max-h-[95vh] overflow-y-auto my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2 text-blue-400 min-w-0">
                <Pencil className="w-5 h-5 shrink-0" />
                <h3 className="text-sm sm:text-base font-bold text-white truncate">
                  Edit Sale #{editingSale.receiptNumber}
                </h3>
              </div>
              <button
                onClick={() => setEditingSale(null)}
                className="text-slate-400 hover:text-white p-1 shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-200 text-xs mb-4">
              <strong>Stock Recalculation:</strong> Editing this sale will reverse the original
              quantities and apply the new ones automatically.
            </div>

            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Edit Reason (Optional)
                </label>
                <input
                  type="text"
                  value={editReason}
                  onChange={e => setEditReason(e.target.value)}
                  placeholder="Optional - e.g. Wrong quantity entered"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-white text-xs"
                />
              </div>

              <div className="space-y-2.5 max-h-72 overflow-y-auto">
                {editItems.map((item, idx) => {
                  const product = products.find(p => p.id === item.productId);
                  return (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2"
                    >
                      <div>
                        <span className="text-white text-xs font-semibold">
                          {product?.name || 'Unknown'}
                        </span>
                        <span className="text-slate-500 text-[10px] block font-mono">
                          {product?.sku || ''}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-0.5">
                            Qty
                          </label>
                          <input
                            type="number"
                            inputMode="numeric"
                            min="0"
                            value={item.quantity}
                            onChange={e => {
                              const val = e.target.value;
                              const newItems = [...editItems];
                              newItems[idx] = {
                                ...newItems[idx],
                                quantity: val === '' ? ('' as any) : parseInt(val) || 0,
                              };
                              setEditItems(newItems);
                            }}
                            className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-2 text-white font-mono text-center text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-0.5">
                            Price
                          </label>
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={e => {
                              const val = e.target.value;
                              const newItems = [...editItems];
                              newItems[idx] = {
                                ...newItems[idx],
                                unitPrice: val === '' ? ('' as any) : parseFloat(val) || 0,
                              };
                              setEditItems(newItems);
                            }}
                            className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-2 text-white font-mono text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-0.5">
                            Discount
                          </label>
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.01"
                            value={item.discount || 0}
                            onChange={e => {
                              const val = e.target.value;
                              const newItems = [...editItems];
                              newItems[idx] = {
                                ...newItems[idx],
                                discount: val === '' ? ('' as any) : parseFloat(val) || 0,
                              };
                              setEditItems(newItems);
                            }}
                            className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-2 text-white font-mono text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setEditingSale(null)}
                className="px-4 py-2.5 rounded-lg bg-slate-800 text-slate-300 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isEditing}
                className="px-4 py-2.5 rounded-lg bg-blue-600 text-white text-xs font-bold disabled:opacity-50"
              >
                {isEditing ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Void Modal */}
      {voidingSale && canVoidSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2 text-rose-400">
                <Ban className="w-5 h-5" />
                <h3 className="text-sm sm:text-base font-bold text-white">
                  Void Sale {voidingSale.receiptNumber}
                </h3>
              </div>
              <button
                onClick={() => setVoidingSale(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-200 text-xs mb-4 flex items-start gap-2">
              <RotateCcw className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong>Automatic Stock Restoration:</strong> Voiding will restock all{' '}
                <strong>
                  {voidingSale.items.reduce((s, i) => s + i.quantity, 0)} units
                </strong>{' '}
                back into inventory.
              </div>
            </div>

            <div className="space-y-3 text-xs mb-5">
              <label className="block text-slate-300 font-semibold mb-1">
                Cancellation Reason *
              </label>
              <textarea
                required
                rows={3}
                value={voidReason}
                onChange={e => setVoidReason(e.target.value)}
                placeholder="e.g. Customer returned items..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setVoidingSale(null)}
                className="px-4 py-2.5 rounded-lg bg-slate-800 text-slate-300 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteVoid}
                disabled={isVoiding}
                className="px-4 py-2.5 rounded-lg bg-rose-600 text-white text-xs font-bold disabled:opacity-50"
              >
                {isVoiding ? 'Processing...' : 'Confirm Void'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
