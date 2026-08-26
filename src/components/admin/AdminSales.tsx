import React, { useState } from 'react';
import {
  Search,
  Receipt,
  Filter,
  Calendar,
  Eye,
  Ban,
  X,
  AlertTriangle,
  RotateCcw,
  CheckCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SalesService } from '../../services/salesService';
import { Sale } from '../../types';
import { formatCurrency, formatDateTime } from '../../utils/formatters';

export const AdminSales: React.FC = () => {
  const { currentUser, showReceipt, dbState, addToast } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [sellerFilter, setSellerFilter] = useState('ALL');
  const [paymentFilter, setPaymentFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Void Sale Dialog
  const [voidingSale, setVoidingSale] = useState<Sale | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [isVoiding, setIsVoiding] = useState(false);

  if (!currentUser || currentUser.role !== 'ADMIN') return null;

  const settings = dbState.settings;
  const sellers = dbState.users.filter(u => u.role === 'SELLER');

  const sales = SalesService.getSales(
    {
      search: searchQuery,
      sellerId: sellerFilter === 'ALL' ? undefined : sellerFilter,
      paymentMethod: paymentFilter === 'ALL' ? undefined : (paymentFilter as any),
      status: statusFilter === 'ALL' ? undefined : (statusFilter as any),
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    },
    currentUser
  );

  const totalVolume = sales.reduce((sum, s) => (s.status === 'COMPLETED' ? sum + s.total : sum), 0);
  const totalProfit = sales.reduce((sum, s) => (s.status === 'COMPLETED' ? sum + s.grossProfit : sum), 0);

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

  return (
    <div id="admin-sales-view" className="flex-1 p-3.5 sm:p-6 bg-slate-950 text-slate-100 overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 mb-6 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">Sales & Transactions</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Audit store sales, filter by cashier or payment method, and manage voiding
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:flex sm:items-center sm:gap-3">
          <div className="p-2.5 sm:p-3 bg-slate-900 border border-slate-800 rounded-xl text-left sm:text-right">
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
              Completed Rev
            </span>
            <span className="text-sm sm:text-base font-bold text-emerald-400 font-mono">
              {formatCurrency(totalVolume, settings.currencySymbol)}
            </span>
          </div>

          <div className="p-2.5 sm:p-3 bg-slate-900 border border-slate-800 rounded-xl text-left sm:text-right">
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
              Gross Profit
            </span>
            <span className="text-sm sm:text-base font-bold text-blue-400 font-mono">
              {formatCurrency(totalProfit, settings.currencySymbol)}
            </span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 mb-5 space-y-2.5 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* Search */}
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search receipt, seller, items..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Seller Filter */}
          <select
            value={sellerFilter}
            onChange={e => setSellerFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">All Sellers</option>
            {sellers.map(s => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          {/* Payment Method */}
          <select
            value={paymentFilter}
            onChange={e => setPaymentFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">All Payment Methods</option>
            <option value="CASH">Cash</option>
            <option value="CARD">Card</option>
            <option value="MOBILE_MONEY">Mobile Money</option>
            <option value="BANK">Bank</option>
            <option value="OTHER">Other</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="COMPLETED">Completed</option>
            <option value="VOIDED">Voided / Cancelled</option>
          </select>
        </div>

        {/* Date Range */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-800/80">
          <div className="flex flex-wrap items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400 text-[11px]">Dates:</span>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white"
            />
            <span className="text-slate-500 text-xs">to</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white"
            />
          </div>

          {(searchQuery || sellerFilter !== 'ALL' || paymentFilter !== 'ALL' || statusFilter !== 'ALL' || startDate || endDate) && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSellerFilter('ALL');
                setPaymentFilter('ALL');
                setStatusFilter('ALL');
                setStartDate('');
                setEndDate('');
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition text-xs self-start sm:self-auto"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Sales: Mobile Cards & Desktop Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {sales.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <Receipt className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-xs">No transaction records found matching the filter criteria.</p>
          </div>
        ) : (
          <>
            {/* Mobile View (< lg) */}
            <div className="lg:hidden divide-y divide-slate-800/80">
              {sales.map(sale => {
                const isVoided = sale.status === 'VOIDED';

                return (
                  <div key={sale.id} className={`p-3.5 space-y-2.5 ${isVoided ? 'opacity-65' : ''}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-xs text-white">{sale.receiptNumber}</span>
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
                        <p className="text-[10px] text-slate-400 mt-0.5">{formatDateTime(sale.createdAt)}</p>
                      </div>

                      <div className="text-right">
                        <div className="font-mono font-bold text-sm text-white">
                          {formatCurrency(sale.total, settings.currencySymbol)}
                        </div>
                        <div className="text-[10px] font-mono text-emerald-400">
                          Profit: {isVoided ? '$0.00' : `+${formatCurrency(sale.grossProfit, settings.currencySymbol)}`}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-300 pt-1">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-medium">By {sale.sellerName}</span>
                        <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 text-[9px] uppercase font-medium">
                          {sale.paymentMethod}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">{(sale.items || []).length} item(s)</span>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800/60">
                      <button
                        onClick={() => showReceipt(sale)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition"
                      >
                        View Receipt
                      </button>
                      {!isVoided && (
                        <button
                          onClick={() => {
                            setVoidingSale(sale);
                            setVoidReason('');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-600 hover:text-white text-rose-300 text-xs font-semibold border border-rose-500/30 transition"
                        >
                          Void Sale
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop View: Table (lg+) */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400">
                    <th className="py-3 px-4 font-semibold">Receipt Number</th>
                    <th className="py-3 px-4 font-semibold">Date & Time</th>
                    <th className="py-3 px-4 font-semibold">Seller</th>
                    <th className="py-3 px-4 font-semibold">Items</th>
                    <th className="py-3 px-4 font-semibold">Payment</th>
                    <th className="py-3 px-4 text-right font-semibold">COGS</th>
                    <th className="py-3 px-4 text-right font-semibold">Total Revenue</th>
                    <th className="py-3 px-4 text-right font-semibold">Profit</th>
                    <th className="py-3 px-4 text-center font-semibold">Status</th>
                    <th className="py-3 px-4 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {sales.map(sale => {
                    const isVoided = sale.status === 'VOIDED';

                    return (
                      <tr key={sale.id} className={`hover:bg-slate-850/60 transition ${isVoided ? 'opacity-65' : ''}`}>
                        <td className="py-3 px-4 font-mono font-bold text-white">
                          {sale.receiptNumber}
                        </td>
                        <td className="py-3 px-4 text-slate-400">{formatDateTime(sale.createdAt)}</td>
                        <td className="py-3 px-4 text-slate-300 font-medium">{sale.sellerName}</td>
                        <td className="py-3 px-4 text-slate-400">
                          <span>{(sale.items || []).length} item(s)</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] uppercase font-medium">
                            {sale.paymentMethod}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-400">
                          {formatCurrency(sale.costOfGoods, settings.currencySymbol)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-white">
                          {formatCurrency(sale.total, settings.currencySymbol)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                          {isVoided ? '$0.00' : `+${formatCurrency(sale.grossProfit, settings.currencySymbol)}`}
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
                        <td className="py-3 px-4 text-right space-x-1.5">
                          <button
                            onClick={() => showReceipt(sale)}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium transition"
                          >
                            Receipt
                          </button>
                          {!isVoided && (
                            <button
                              onClick={() => {
                                setVoidingSale(sale);
                                setVoidReason('');
                              }}
                              className="px-2 py-1 rounded bg-rose-500/15 hover:bg-rose-600 hover:text-white text-rose-300 text-[11px] font-semibold border border-rose-500/30 transition"
                            >
                              Void Sale
                            </button>
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

      {/* Modal: Void / Cancel Transaction with Inventory Restoration */}
      {voidingSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-3.5 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl animate-in fade-in zoom-in-95 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2 text-rose-400">
                <Ban className="w-5 h-5" />
                <h3 className="text-base font-bold text-white">Void Sale {voidingSale.receiptNumber}</h3>
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
                <strong>Automatic Stock Restoration:</strong> Voiding this transaction will preserve the historical record (marked as VOIDED) and automatically restock all{' '}
                <strong>{voidingSale.items.reduce((s, i) => s + i.quantity, 0)} units</strong> back into local inventory.
              </div>
            </div>

            <div className="space-y-3 text-xs mb-5">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Cancellation Reason *
                </label>
                <textarea
                  required
                  rows={3}
                  value={voidReason}
                  onChange={e => setVoidReason(e.target.value)}
                  placeholder="e.g. Customer returned items / Incorrect payment method selected / Order entered by mistake"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setVoidingSale(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteVoid}
                disabled={isVoiding}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold shadow transition text-xs disabled:opacity-50"
              >
                {isVoiding ? 'Processing...' : 'Confirm Void & Restock Items'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
