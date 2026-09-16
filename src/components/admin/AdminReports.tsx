import React, { useState, useMemo } from 'react';
import {
  FileText,
  Printer,
  Calendar,
  Download,
  Users,
  Package,
  Store,
  Search,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ReportService } from '../../services/reportService';
import { formatCurrency } from '../../utils/formatters';

export const AdminReports: React.FC = () => {
  const { currentUser, dbState, addToast } = useApp();
  const [reportPeriod, setReportPeriod] = useState<'today' | 'week' | 'month' | 'custom'>('month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Filters
  const [shopFilter, setShopFilter] = useState('ALL');
  const [productSearch, setProductSearch] = useState('');
  const [sellerSearch, setSellerSearch] = useState('');
  const [isPrinting, setIsPrinting] = useState(false);

  // Permission check: Admin OR Seller with canViewReports
  if (!currentUser) return null;
  if (currentUser.role !== 'ADMIN' && !currentUser.permissions?.canViewReports) return null;

  const settings = dbState.settings;
  const shops = dbState.shops || [];

  const dateRange = useMemo(() => {
    const now = new Date();
    if (reportPeriod === 'today') {
      const d = now.toISOString().slice(0, 10);
      return { from: d, to: d };
    }
    if (reportPeriod === 'week') {
      const past = new Date(now.getTime() - 7 * 86400000);
      return { from: past.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
    }
    if (reportPeriod === 'month') {
      const past = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: past.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
    }
    return { from: customStartDate || undefined, to: customEndDate || undefined };
  }, [reportPeriod, customStartDate, customEndDate]);

  // Fallback so blank page never happens
  const summary = useMemo(() => {
    const result = ReportService.getFinancialSummary(dateRange, currentUser);
    return (
      result || {
        totalGrossSales: 0,
        totalCostOfGoods: 0,
        totalGrossProfit: 0,
        totalExpenses: 0,
        netProfit: 0,
        profitMarginPercent: 0,
        netMarginPercent: 0,
        shopSalesBreakdown: [],
        topProducts: [],
        sellerSales: [],
      }
    );
  }, [dateRange, currentUser, dbState]);

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return summary.topProducts || [];
    const q = productSearch.trim().toLowerCase();
    return (summary.topProducts || []).filter(
      p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    );
  }, [summary.topProducts, productSearch]);

  const filteredSellers = useMemo(() => {
    if (!sellerSearch.trim()) return summary.sellerSales || [];
    const q = sellerSearch.trim().toLowerCase();
    return (summary.sellerSales || []).filter(s => s.name.toLowerCase().includes(q));
  }, [summary.sellerSales, sellerSearch]);

  const selectedShopName =
    shopFilter === 'ALL' ? 'All Shops' : shops.find(s => s.id === shopFilter)?.name || 'Unknown';

  const handlePrintReport = () => {
    setIsPrinting(true);

    const printWindow = window.open('', '_blank', 'width=1400,height=900');
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
        <title>Financial Report - ${selectedShopName}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; background: #fff; color: #1e293b; }

          .header { text-align: center; margin-bottom: 20px; border-bottom: 3px double #3b82f6; padding-bottom: 15px; }
          .header h1 { font-size: 22px; color: #1e40af; font-weight: bold; }
          .header .company { font-size: 13px; color: #475569; margin-top: 5px; }
          .header .meta { font-size: 11px; color: #64748b; margin-top: 8px; line-height: 1.5; }
          .header .badge { display: inline-block; background: #dbeafe; color: #1e40af; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; margin-top: 8px; }

          .section { margin-bottom: 22px; page-break-inside: avoid; }
          .section-title { font-size: 15px; color: #1e293b; font-weight: bold; margin-bottom: 12px; padding: 8px 12px; background: linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%); border-left: 4px solid #3b82f6; border-radius: 0 8px 8px 0; }

          .summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 20px; }
          .summary-card { padding: 14px; border-radius: 10px; text-align: center; color: #fff; }
          .summary-card.gross { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); }
          .summary-card.profit { background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); }
          .summary-card.expenses { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); }
          .summary-card.net { background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); }
          .summary-card .label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.9; }
          .summary-card .value { font-size: 16px; font-weight: bold; margin-top: 6px; }

          table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 16px; }
          thead { background: #1e293b; color: #fff; }
          th { padding: 8px 6px; text-align: left; font-weight: 600; }
          td { padding: 7px 6px; border-bottom: 1px solid #e2e8f0; }
          tr:nth-child(even) { background: #f8fafc; }
          .amount { text-align: right; font-family: 'Courier New', monospace; font-weight: bold; }
          .positive { color: #16a34a; }
          .negative { color: #dc2626; }

          .footer { text-align: center; margin-top: 25px; font-size: 10px; color: #94a3b8; border-top: 2px solid #e2e8f0; padding-top: 12px; }
          .divider { border: none; border-top: 2px dashed #cbd5e1; margin: 20px 0; }

          @media (min-width: 640px) {
            body { padding: 30px; }
            .header h1 { font-size: 26px; }
            .summary-grid { grid-template-columns: repeat(4, 1fr); gap: 14px; }
            .summary-card .value { font-size: 20px; }
            table { font-size: 12px; }
            th { padding: 10px 8px; }
            td { padding: 9px 8px; }
          }

          @media print {
            body { padding: 0; }
            .section { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${settings.businessName}</h1>
          <div class="company">${settings.tagline || ''}</div>
          <div class="meta">
            <strong>Financial & Performance Report</strong><br>
            Period: ${dateRange.from || 'Beginning'} to ${dateRange.to || 'Present'}<br>
            Generated: ${new Date().toLocaleString()}
          </div>
          <div class="badge">🏪 ${selectedShopName}</div>
        </div>

        <div class="summary-grid">
          <div class="summary-card gross">
            <div class="label">Gross Revenue</div>
            <div class="value">${settings.currencySymbol} ${(summary.totalGrossSales || 0).toLocaleString()}</div>
          </div>
          <div class="summary-card profit">
            <div class="label">Gross Profit</div>
            <div class="value">${settings.currencySymbol} ${(summary.totalGrossProfit || 0).toLocaleString()}</div>
          </div>
          <div class="summary-card expenses">
            <div class="label">Total Expenses</div>
            <div class="value">${settings.currencySymbol} ${(summary.totalExpenses || 0).toLocaleString()}</div>
          </div>
          <div class="summary-card net">
            <div class="label">Net Profit</div>
            <div class="value">${settings.currencySymbol} ${(summary.netProfit || 0).toLocaleString()}</div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">📊 Income Statement Summary</div>
          <table>
            <tbody>
              <tr><td><strong>Gross Revenue (Completed Sales)</strong></td><td class="amount">${settings.currencySymbol} ${(summary.totalGrossSales || 0).toLocaleString()}</td></tr>
              <tr><td>Less: Cost of Goods Sold (COGS)</td><td class="amount negative">-${settings.currencySymbol} ${(summary.totalCostOfGoods || 0).toLocaleString()}</td></tr>
              <tr><td><strong>Gross Operating Profit</strong></td><td class="amount positive">${settings.currencySymbol} ${(summary.totalGrossProfit || 0).toLocaleString()} (${summary.profitMarginPercent || 0}%)</td></tr>
              <tr><td>Less: Operating Overhead Expenses</td><td class="amount negative">-${settings.currencySymbol} ${(summary.totalExpenses || 0).toLocaleString()}</td></tr>
              <tr style="background:#f0fdf4; font-size:13px;"><td><strong>NET PROFIT / (LOSS)</strong></td><td class="amount ${(summary.netProfit || 0) >= 0 ? 'positive' : 'negative'}">${settings.currencySymbol} ${(summary.netProfit || 0).toLocaleString()} (${summary.netMarginPercent || 0}%)</td></tr>
            </tbody>
          </table>
        </div>

        <hr class="divider">

        <div class="section">
          <div class="section-title">🏪 Shop Performance Breakdown</div>
          <table>
            <thead>
              <tr>
                <th>Shop Name</th>
                <th class="amount">Sales</th>
                <th class="amount">Total</th>
                <th class="amount">Profit</th>
                <th class="amount">Expenses</th>
                <th class="amount">Net</th>
              </tr>
            </thead>
            <tbody>
              ${(summary.shopSalesBreakdown || []).map(shop => `
                <tr>
                  <td><strong>🏪 ${shop.name}</strong></td>
                  <td class="amount">${shop.salesCount}</td>
                  <td class="amount">${settings.currencySymbol} ${shop.totalSales.toLocaleString()}</td>
                  <td class="amount positive">${settings.currencySymbol} ${shop.grossProfit.toLocaleString()}</td>
                  <td class="amount negative">${settings.currencySymbol} ${shop.expenseTotal.toLocaleString()}</td>
                  <td class="amount ${shop.grossProfit - shop.expenseTotal >= 0 ? 'positive' : 'negative'}">${settings.currencySymbol} ${(shop.grossProfit - shop.expenseTotal).toLocaleString()}</td>
                </tr>
              `).join('') || '<tr><td colspan="6" style="text-align:center;">No shop data available</td></tr>'}
            </tbody>
          </table>
        </div>

        <hr class="divider">

        <div class="section">
          <div class="section-title">📦 Product Profitability Breakdown</div>
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th class="amount">Units</th>
                <th class="amount">Revenue</th>
                <th class="amount">Profit</th>
              </tr>
            </thead>
            <tbody>
              ${(summary.topProducts || []).map(p => `
                <tr>
                  <td><strong>${p.name}</strong></td>
                  <td style="font-family:monospace;">${p.sku}</td>
                  <td class="amount">${p.unitsSold}</td>
                  <td class="amount">${settings.currencySymbol} ${p.revenue.toLocaleString()}</td>
                  <td class="amount positive">+${settings.currencySymbol} ${p.profit.toLocaleString()}</td>
                </tr>
              `).join('') || '<tr><td colspan="5" style="text-align:center;">No product data available</td></tr>'}
            </tbody>
          </table>
        </div>

        <hr class="divider">

        <div class="section">
          <div class="section-title">👥 Seller Performance Contribution</div>
          <table>
            <thead>
              <tr>
                <th>Seller Name</th>
                <th class="amount">Orders</th>
                <th class="amount">Total Sales</th>
                <th class="amount">Gross Profit</th>
              </tr>
            </thead>
            <tbody>
              ${(summary.sellerSales || []).map(seller => `
                <tr>
                  <td><strong>${seller.name}</strong></td>
                  <td class="amount">${seller.count}</td>
                  <td class="amount">${settings.currencySymbol} ${seller.total.toLocaleString()}</td>
                  <td class="amount positive">+${settings.currencySymbol} ${seller.profit.toLocaleString()}</td>
                </tr>
              `).join('') || '<tr><td colspan="4" style="text-align:center;">No seller data available</td></tr>'}
            </tbody>
          </table>
        </div>

        <div class="footer">
          ${settings.businessName} - ${settings.address || ''}<br>
          Phone: ${settings.phone || 'N/A'} | Email: ${settings.email || 'N/A'}<br>
          ${settings.receiptFooterNote || 'Thank you for your business!'}
        </div>

        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();

    setTimeout(() => setIsPrinting(false), 2000);
  };

  const handleExportCSV = () => {
    let csv = `Financial Report - ${selectedShopName}\n`;
    csv += `Period: ${dateRange.from || 'Beginning'} to ${dateRange.to || 'Present'}\n\n`;
    csv += `SUMMARY\n`;
    csv += `Gross Revenue,${summary.totalGrossSales || 0}\n`;
    csv += `Cost of Goods,${summary.totalCostOfGoods || 0}\n`;
    csv += `Gross Profit,${summary.totalGrossProfit || 0}\n`;
    csv += `Expenses,${summary.totalExpenses || 0}\n`;
    csv += `Net Profit,${summary.netProfit || 0}\n\n`;

    csv += `SHOP PERFORMANCE\n`;
    csv += `Shop,Sales Count,Total Sales,Gross Profit,Expenses,Net\n`;
    (summary.shopSalesBreakdown || []).forEach(s => {
      csv += `"${s.name}",${s.salesCount},${s.totalSales},${s.grossProfit},${s.expenseTotal},${s.grossProfit - s.expenseTotal}\n`;
    });
    csv += `\n`;

    csv += `PRODUCT PROFITABILITY\n`;
    csv += `Product,SKU,Units,Revenue,Profit\n`;
    (summary.topProducts || []).forEach(p => {
      csv += `"${p.name}","${p.sku}",${p.unitsSold},${p.revenue},${p.profit}\n`;
    });
    csv += `\n`;

    csv += `SELLER PERFORMANCE\n`;
    csv += `Seller,Orders,Total,Profit\n`;
    (summary.sellerSales || []).forEach(s => {
      csv += `"${s.name}",${s.count},${s.total},${s.profit}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `financial_report_${selectedShopName
      .toLowerCase()
      .replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    addToast({
      type: 'success',
      title: 'Report Exported',
      description: 'CSV report downloaded successfully.',
    });
  };

  return (
    <div
      id="admin-reports-view"
      className="flex-1 p-3.5 sm:p-6 bg-slate-950 text-slate-100 overflow-y-auto space-y-4 pb-24 sm:pb-6"
    >
      {/* Header & Controls */}
      <div className="flex flex-col gap-3 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
            Financial Reports
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Audit store performance, gross margins, operating expenses, and cash breakdown
          </p>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto">
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-semibold shrink-0">
            {[
              { id: 'today', label: 'Today' },
              { id: 'week', label: '7 Days' },
              { id: 'month', label: 'Month' },
              { id: 'custom', label: 'Custom' },
            ].map(p => (
              <button
                key={p.id}
                onClick={() => setReportPeriod(p.id as any)}
                className={`px-2.5 py-2 rounded-lg transition whitespace-nowrap ${
                  reportPeriod === p.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-slate-700 text-slate-200 border border-slate-800 text-xs font-semibold transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>

          <button
            onClick={handlePrintReport}
            disabled={isPrinting}
            className="flex-1 flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-semibold shadow transition disabled:opacity-50"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{isPrinting ? 'Printing...' : 'Print'}</span>
          </button>
        </div>
      </div>

      {/* Custom Date Inputs */}
      {reportPeriod === 'custom' && (
        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-slate-400">Custom Date Range</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-slate-500 text-[10px] mb-1">From</label>
              <input
                type="date"
                value={customStartDate}
                onChange={e => setCustomStartDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-white text-xs"
              />
            </div>
            <div>
              <label className="block text-slate-500 text-[10px] mb-1">To</label>
              <input
                type="date"
                value={customEndDate}
                onChange={e => setCustomEndDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-white text-xs"
              />
            </div>
          </div>
        </div>
      )}

      {/* Income Statement */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 text-blue-400 shrink-0" />
            <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider truncate">
              Income Statement
            </h3>
          </div>
        </div>

        <div className="space-y-2.5 text-xs">
          <div className="flex justify-between py-2 border-b border-slate-800/80">
            <span className="text-slate-300 font-medium">Gross Revenue</span>
            <span className="font-mono font-bold text-white">
              {formatCurrency(summary.totalGrossSales || 0, settings.currencySymbol)}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-slate-800/80 text-slate-400">
            <span>Less: COGS</span>
            <span className="font-mono text-rose-400">
              -{formatCurrency(summary.totalCostOfGoods || 0, settings.currencySymbol)}
            </span>
          </div>
          <div className="flex justify-between py-2.5 bg-slate-950/80 px-3 rounded-lg border border-slate-800">
            <div>
              <span className="font-bold text-white">Gross Profit</span>
              <span className="text-[10px] text-emerald-400 block font-mono">
                {summary.profitMarginPercent || 0}% Margin
              </span>
            </div>
            <span className="font-mono font-bold text-emerald-400 text-sm">
              {formatCurrency(summary.totalGrossProfit || 0, settings.currencySymbol)}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-slate-800/80 text-slate-400">
            <span>Less: Expenses</span>
            <span className="font-mono text-rose-400">
              -{formatCurrency(summary.totalExpenses || 0, settings.currencySymbol)}
            </span>
          </div>
          <div
            className={`flex justify-between py-2.5 px-3 rounded-lg border ${
              (summary.netProfit || 0) >= 0
                ? 'bg-emerald-500/10 border-emerald-500/30'
                : 'bg-rose-500/10 border-rose-500/30'
            }`}
          >
            <div>
              <span className="font-bold text-white">NET PROFIT</span>
              <span className="text-[10px] text-slate-300 block font-mono">
                {summary.netMarginPercent || 0}% Net Return
              </span>
            </div>
            <span
              className={`font-mono font-extrabold text-sm ${
                (summary.netProfit || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {formatCurrency(summary.netProfit || 0, settings.currencySymbol)}
            </span>
          </div>
        </div>
      </div>

      {/* Shop Performance */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
        <div className="flex items-center justify-between mb-3.5 gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Store className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs sm:text-sm font-bold text-white">Shop Performance</h3>
          </div>
          <select
            value={shopFilter}
            onChange={e => setShopFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white"
          >
            <option value="ALL">🏪 All Shops</option>
            {shops.map(s => (
              <option key={s.id} value={s.id}>
                🏪 {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-slate-800/60">
          {(summary.shopSalesBreakdown || []).length === 0 ? (
            <div className="py-6 text-center text-slate-500 text-xs">
              No shop data available
            </div>
          ) : (
            (summary.shopSalesBreakdown || []).map(shop => (
              <div key={shop.id} className="py-2.5 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-white font-semibold text-xs truncate">
                    🏪 {shop.name}
                  </span>
                  <span className="font-mono font-bold text-emerald-400 text-xs shrink-0">
                    +{formatCurrency(shop.grossProfit, settings.currencySymbol)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>
                    {shop.salesCount} {shop.salesCount === 1 ? 'sale' : 'sales'}
                  </span>
                  <span className="font-mono">
                    {formatCurrency(shop.totalSales, settings.currencySymbol)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="pb-2 font-semibold">Shop</th>
                <th className="pb-2 text-center font-semibold">Sales</th>
                <th className="pb-2 text-right font-semibold">Total Sales</th>
                <th className="pb-2 text-right font-semibold">Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {(summary.shopSalesBreakdown || []).map(shop => (
                <tr key={shop.id}>
                  <td className="py-2.5 text-white font-semibold">🏪 {shop.name}</td>
                  <td className="py-2.5 text-center font-mono text-slate-300">
                    {shop.salesCount}
                  </td>
                  <td className="py-2.5 text-right font-mono font-medium text-white">
                    {formatCurrency(shop.totalSales, settings.currencySymbol)}
                  </td>
                  <td className="py-2.5 text-right font-mono font-bold text-emerald-400">
                    +{formatCurrency(shop.grossProfit, settings.currencySymbol)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Profitability */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
        <div className="flex items-center gap-2 mb-3">
          <Package className="w-4 h-4 text-blue-400 shrink-0" />
          <h3 className="text-xs sm:text-sm font-bold text-white">Product Profitability</h3>
        </div>

        <div className="relative mb-3">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={productSearch}
            onChange={e => setProductSearch(e.target.value)}
            placeholder="Filter by product name or SKU..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-2 text-xs text-white"
          />
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-slate-800/60">
          {filteredProducts.length === 0 ? (
            <div className="py-6 text-center text-slate-500 text-xs">
              No products match
            </div>
          ) : (
            filteredProducts.map(p => (
              <div key={p.sku} className="py-2.5 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-white font-medium text-xs truncate">{p.name}</span>
                  <span className="font-mono font-bold text-emerald-400 text-xs shrink-0">
                    +{formatCurrency(p.profit, settings.currencySymbol)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-mono truncate">{p.sku}</span>
                  <span className="font-mono">
                    {p.unitsSold} × {formatCurrency(p.revenue, settings.currencySymbol)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="pb-2 font-semibold">Product</th>
                <th className="pb-2 text-center font-semibold">Qty</th>
                <th className="pb-2 text-right font-semibold">Revenue</th>
                <th className="pb-2 text-right font-semibold">Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredProducts.map(p => (
                <tr key={p.sku}>
                  <td className="py-2.5 text-white font-medium">
                    <div>{p.name}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{p.sku}</div>
                  </td>
                  <td className="py-2.5 text-center font-mono text-slate-300">
                    {p.unitsSold}
                  </td>
                  <td className="py-2.5 text-right font-mono font-medium text-white">
                    {formatCurrency(p.revenue, settings.currencySymbol)}
                  </td>
                  <td className="py-2.5 text-right font-mono font-bold text-emerald-400">
                    +{formatCurrency(p.profit, settings.currencySymbol)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Seller Performance */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-purple-400 shrink-0" />
          <h3 className="text-xs sm:text-sm font-bold text-white">Seller Performance</h3>
        </div>

        <div className="relative mb-3">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={sellerSearch}
            onChange={e => setSellerSearch(e.target.value)}
            placeholder="Filter by seller name..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-2 text-xs text-white"
          />
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-slate-800/60">
          {filteredSellers.length === 0 ? (
            <div className="py-6 text-center text-slate-500 text-xs">
              No sellers match
            </div>
          ) : (
            filteredSellers.map(seller => (
              <div key={seller.name} className="py-2.5 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-white font-semibold text-xs truncate">
                    {seller.name}
                  </span>
                  <span className="font-mono font-bold text-emerald-400 text-xs shrink-0">
                    +{formatCurrency(seller.profit, settings.currencySymbol)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>
                    {seller.count} {seller.count === 1 ? 'order' : 'orders'}
                  </span>
                  <span className="font-mono">
                    {formatCurrency(seller.total, settings.currencySymbol)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="pb-2 font-semibold">Seller</th>
                <th className="pb-2 text-center font-semibold">Orders</th>
                <th className="pb-2 text-right font-semibold">Total Sales</th>
                <th className="pb-2 text-right font-semibold">Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredSellers.map(seller => (
                <tr key={seller.name}>
                  <td className="py-2.5 text-white font-semibold">{seller.name}</td>
                  <td className="py-2.5 text-center font-mono text-slate-300">
                    {seller.count}
                  </td>
                  <td className="py-2.5 text-right font-mono font-medium text-white">
                    {formatCurrency(seller.total, settings.currencySymbol)}
                  </td>
                  <td className="py-2.5 text-right font-mono font-bold text-emerald-400">
                    +{formatCurrency(seller.profit, settings.currencySymbol)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
