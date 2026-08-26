import React, { useState } from 'react';
import { Search, Receipt, Calendar, Filter, Eye } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SalesService } from '../../services/salesService';
import { formatCurrency, formatDateTime } from '../../utils/formatters';

export const SellerSales: React.FC = () => {
  const { currentUser, showReceipt, dbState } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('ALL');

  if (!currentUser) return null;

  const settings = dbState.settings;

  // Query sales restricted to current seller
  const sales = SalesService.getSales(
    {
      search: searchQuery,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      paymentMethod: paymentFilter === 'ALL' ? undefined : (paymentFilter as any),
    },
    currentUser
  );

  const totalVolume = sales.reduce((sum, s) => sum + s.total, 0);

  return (
    <div id="seller-sales-view" className="flex-1 p-3 sm:p-6 bg-slate-950 text-slate-100 overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6 pb-3 sm:pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">My Sales History</h2>
          <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
            Log of sales transactions executed under @{currentUser.username}
          </p>
        </div>

        <div className="p-2.5 sm:p-3 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between sm:justify-end gap-3">
          <div>
            <span className="text-[9px] sm:text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
              Filtered Volume
            </span>
            <span className="text-sm sm:text-base font-bold text-emerald-400 font-mono">
              {formatCurrency(totalVolume, settings.currencySymbol)}
            </span>
          </div>
          <div className="h-7 w-px bg-slate-800"></div>
          <div>
            <span className="text-[9px] sm:text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
              Transactions
            </span>
            <span className="text-sm sm:text-base font-bold text-white font-mono">{sales.length}</span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 mb-4 space-y-2.5 text-xs">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search receipt #, items..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <select
            value={paymentFilter}
            onChange={e => setPaymentFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">All Payment Methods</option>
            <option value="CASH">Cash</option>
            <option value="CARD">Card</option>
            <option value="MOBILE_MONEY">Mobile Money</option>
            <option value="BANK">Bank</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/60">
          <div className="flex items-center gap-1.5 text-slate-400 text-xs">
            <Calendar className="w-3.5 h-3.5" />
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white"
            />
            <span>to</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white"
            />
          </div>
          {(startDate || endDate || searchQuery || paymentFilter !== 'ALL') && (
            <button
              onClick={() => {
                setStartDate('');
                setEndDate('');
                setSearchQuery('');
                setPaymentFilter('ALL');
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 font-medium transition"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Sales Display: Mobile Cards & Desktop Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {sales.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <Receipt className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-xs sm:text-sm">No sales match your search criteria.</p>
          </div>
        ) : (
          <>
            {/* Mobile Cards List (< md) */}
            <div className="md:hidden divide-y divide-slate-800/80">
              {sales.map(sale => (
                <div key={sale.id} className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-white">#{sale.receiptNumber}</span>
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-medium uppercase border border-slate-700">
                      {sale.paymentMethod}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-400">
                    <div>{formatDateTime(sale.createdAt)}</div>
                    <div className="text-slate-300 truncate mt-0.5 font-medium">
                      {(sale.items || []).map(i => `${i.quantity}x ${i.productName}`).join(', ')}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1.5 border-t border-slate-800/50">
                    <span className="font-mono font-bold text-emerald-400 text-sm">
                      {formatCurrency(sale.total, settings.currencySymbol)}
                    </span>
                    <button
                      onClick={() => showReceipt(sale)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white text-xs font-semibold active:scale-95 transition"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Receipt</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View (md+) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400">
                    <th className="py-3 px-4 font-semibold">Receipt Number</th>
                    <th className="py-3 px-4 font-semibold">Date & Time</th>
                    <th className="py-3 px-4 font-semibold">Items Sold</th>
                    <th className="py-3 px-4 font-semibold">Payment Method</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 text-right font-semibold">Amount Paid</th>
                    <th className="py-3 px-4 text-right font-semibold">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {sales.map(sale => (
                    <tr key={sale.id} className="hover:bg-slate-850/60 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-white">
                        {sale.receiptNumber}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">{formatDateTime(sale.createdAt)}</td>
                      <td className="py-3.5 px-4 text-slate-300">
                        <div className="font-medium">{(sale.items || []).length} items</div>
                        <div className="text-[10px] text-slate-500 truncate max-w-[220px]">
                          {(sale.items || []).map(i => `${i.quantity}x ${i.productName}`).join(', ')}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-medium uppercase border border-slate-700/60">
                          {sale.paymentMethod}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            sale.status === 'COMPLETED'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {sale.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-400 text-sm">
                        {formatCurrency(sale.total, settings.currencySymbol)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => showReceipt(sale)}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white text-xs font-semibold transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View / Print</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
