import React, { useState, useMemo } from 'react';
import {
  FileText,
  Printer,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Download,
  Users,
  Package,
  Store,
  Search,
  Filter,
  X,
  Layers,
  PieChart,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ReportService } from '../../services/reportService';
import { formatCurrency, formatDateTime } from '../../utils/formatters';

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

  if (!currentUser || currentUser.role !== 'ADMIN') return null;

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

  const summary = useMemo(() => {
    return ReportService.getFinancialSummary(dateRange, currentUser);
  }, [dateRange, currentUser, dbState]);

  const selectedShopName = shopFilter === 'ALL' ? 'All Shops' : (shops.find(s => s.id === shopFilter)?.name || 'Unknown');

  // Filter products
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return summary.topProducts || [];
    const q = productSearch.trim().toLowerCase();
    return (summary.topProducts || []).filter(p => 
      p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    );
  }, [summary.topProducts, productSearch]);

  // Filter sellers
  const filteredSellers = useMemo(() => {
    if (!sellerSearch.trim()) return summary.sellerSales || [];
    const q = sellerSearch.trim().toLowerCase();
    return (summary.sellerSales || []).filter(s => s.name.toLowerCase().includes(q));
  }, [summary.sellerSales, sellerSearch]);

  // Filter shop breakdown
  const filteredShops = useMemo(() => {
    if (shopFilter === 'ALL') return summary.shopSalesBreakdown || [];
    return (summary.shopSalesBreakdown || []).filter(s => s.id === shopFilter);
  }, [summary.shopSalesBreakdown, shopFilter]);

  // Print Report (formatted document)
  const handlePrintReport = () => {
    setIsPrinting(true);
    
    const printWindow = window.open('', '_blank', 'width=1400,height=900');
    if (!printWindow) {
      addToast({ type: 'error', title: 'Popup Blocked', description: 'Please allow popups to print.' });
      setIsPrinting(false);
      return;
    }

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Financial Report - ${selectedShopName}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', sans-serif; padding: 30px; color: #1e293b; }
          .header { text-align: center; margin-bottom: 25px; border-bottom: 3px double #3b82f6; padding-bottom: 20px; }
          .header h1 { font-size: 28px; color: #1e40af; }
          .header .meta { font-size: 12px; color: #64748b; margin-top: 10px; }
          .badge { display: inline-block; background: #dbeafe; color: #1e40af; padding: 5px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; margin-top: 10px; }
          .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 25px; }
          .summary-card { padding: 20px; border-radius: 10px; text-align: center; color: #fff; }
          .summary-card.gross { background: linear-gradient(135deg, #3b82f6, #2563eb); }
          .summary-card.profit { background: linear-gradient(135deg, #22c55e, #16a34a); }
          .summary-card.expenses { background: linear-gradient(135deg, #f59e0b, #d97706); }
          .summary-card.net { background: linear-gradient(135deg, #8b5cf6, #7c3aed); }
          .summary-card .label { font-size: 11px; text-transform: uppercase; }
          .summary-card .value { font-size: 22px; font-weight: bold; margin-top: 5px; }
          .section { margin-bottom: 25px; page-break-inside: avoid; }
          .section-title { font-size: 18px; font-weight: bold; margin-bottom: 15px; padding: 10px 15px; background: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 0 8px 8px 0; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          thead { background: #1e293b; color: #fff; }
          th { padding: 10px; text-align: left; }
          td { padding: 8px; border-bottom: 1px solid #e2e8f0; }
          tr:nth-child(even) { background: #f8fafc; }
          .amount { text-align: right; font-family: 'Courier New', monospace; font-weight: bold; }
          .positive { color: #16a34a; }
          .negative { color: #dc2626; }
          .footer { text-align: center; margin-top: 20px; font-size: 11px; color: #94a3b8; border-top: 2px solid #e2e8f0; padding-top: 15px; }
          .divider { border: none; border-top: 2px dashed #cbd5e1; margin: 25px 0; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${settings.businessName}</h1>
          <div class="meta">Financial & Performance Report | Period: ${dateRange.from || 'Start'} to ${dateRange.to || 'Present'}<br>Generated: ${new Date().toLocaleString()}</div>
          <div class="badge">🏪 ${selectedShopName}</div>
        </div>

        <div class="summary-grid">
          <div class="summary-card gross"><div class="label">Gross Revenue</div><div class="value">${settings.currencySymbol} ${summary.totalGrossSales.toLocaleString()}</div></div>
          <div class="summary-card profit"><div class="label">Gross Profit</div><div class="value">${settings.currencySymbol} ${summary.totalGrossProfit.toLocaleString()}</div></div>
          <div class="summary-card expenses"><div class="label">Expenses</div><div class="value">${settings.currencySymbol} ${summary.totalExpenses.toLocaleString()}</div></div>
          <div class="summary-card net"><div class="label">Net Profit</div><div class="value">${settings.currencySymbol} ${summary.netProfit.toLocaleString()}</div></div>
        </div>

        <div class="section">
          <div class="section-title">🏪 Shop Performance</div>
          <table>
            <thead><tr><th>Shop</th><th class="amount">Sales</th><th class="amount">Total Sales</th><th class="amount">Profit</th></tr></thead>
            <tbody>
              ${(summary.shopSalesBreakdown || []).map(s => `
                <tr><td><strong>🏪 ${s.name}</strong></td><td class="amount">${s.salesCount}</td><td class="amount">${settings.currencySymbol} ${s.totalSales.toLocaleString()}</td><td class="amount positive">${settings.currencySymbol} ${s.grossProfit.toLocaleString()}</td></tr>
              `).join('') || '<tr><td colspan="4" style="text-align:center;">No data</td></tr>'}
            </tbody>
          </table>
        </div>

        <hr class="divider">

        <div class="section">
          <div class="section-title">📦 Product Profitability</div>
          <table>
            <thead><tr><th>Product</th><th>SKU</th><th class="amount">Units</th><th class="amount">Revenue</th><th class="amount">Profit</th></tr></thead>
            <tbody>
              ${(summary.topProducts || []).map(p => `
                <tr><td><strong>${p.name}</strong></td><td>${p.sku}</td><td class="amount">${p.unitsSold}</td><td class="amount">${settings.currencySymbol} ${p.revenue.toLocaleString()}</td><td class="amount positive">+${settings.currencySymbol} ${p.profit.toLocaleString()}</td></tr>
              `).join('') || '<tr><td colspan="5" style="text-align:center;">No data</td></tr>'}
            </tbody>
          </table>
        </div>

        <hr class="divider">

        <div class="section">
          <div class="section-title">👥 Seller Performance</div>
          <table>
            <thead><tr><th>Seller</th><th class="amount">Orders</th><th class="amount">Total</th><th class="amount">Profit</th></tr></thead>
            <tbody>
              ${(summary.sellerSales || []).map(s => `
                <tr><td><strong>${s.name}</strong></td><td class="amount">${s.count}</td><td class="amount">${settings.currencySymbol} ${s.total.toLocaleString()}</td><td class="amount positive">+${settings.currencySymbol} ${s.profit.toLocaleString()}</td></tr>
              `).join('') || '<tr><td colspan="4" style="text-align:center;">No data</td></tr>'}
            </tbody>
          </table>
        </div>

        <div class="footer">${settings.businessName} - ${settings.address || ''}<br>${settings.phone || ''}</div>
        <script>window.onload = function() { window.print(); }</script>
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
    csv += `SUMMARY\nGross Revenue,${summary.totalGrossSales}\n`;
    csv += `Cost of Goods,${summary.totalCostOfGoods}\n`;
    csv += `Gross Profit,${summary.totalGrossProfit}\n`;
    csv += `Expenses,${summary.totalExpenses}\n`;
    csv += `Net Profit,${summary.netProfit}\n\n`;
    
    csv += `SHOP PERFORMANCE\nShop,Sales Count,Total Sales,Gross Profit\n`;
    (summary.shopSalesBreakdown || []).forEach(s => {
      csv += `"${s.name}",${s.salesCount},${s.totalSales},${s.grossProfit}\n`;
    });
    csv += `\n`;
    
    csv += `PRODUCT PROFITABILITY\nProduct,SKU,Units,Revenue,Profit\n`;
    (summary.topProducts || []).forEach(p => {
      csv += `"${p.name}","${p.sku}",${p.unitsSold},${p.revenue},${p.profit}\n`;
    });
    csv += `\n`;
    
    csv += `SELLER PERFORMANCE\nSeller,Orders,Total,Profit\n`;
    (summary.sellerSales || []).forEach(s => {
      csv += `"${s.name}",${s.count},${s.total},${s.profit}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `financial_report_${selectedShopName.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    addToast({ type: 'success', title: 'Report Exported', description: 'CSV report downloaded successfully.' });
  };

  return (
    <div id="admin-reports-view" className="flex-1 p-3.5 sm:p-6 bg-slate-950 text-slate-100 overflow-y-auto space-y-4 sm:space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 pb-3.5 sm:pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">Financial & Profit/Loss Reports</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Audit store performance, gross margins, operating expenses
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
            {[
              { id: 'today', label: 'Today' },
              { id: 'week', label: '7 Days' },
              { id: 'month', label: 'Month' },
              { id: 'custom', label: 'Custom' },
            ].map(p => (
              <button
                key={p.id}
                onClick={() => setReportPeriod(p.id as any)}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
                  reportPeriod === p.id ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <button onClick={handleExportCSV} className="flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-semibold transition">
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>

          <button onClick={handlePrintReport} disabled={isPrinting} className="flex items-center gap-1 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow transition disabled:opacity-50">
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Custom Date Inputs */}
      {reportPeriod === 'custom' && (
        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-wrap items-center gap-2.5 text-xs">
          <Calendar className="w-4 h-4 text-slate-400" />
          <input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white" />
          <span className="text-slate-500">to</span>
          <input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white" />
        </div>
      )}

      {/* Profit & Loss Statement */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl">
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-800 mb-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            <h3 className="text-sm sm:text-base font-bold text-white uppercase">Income Statement</h3>
          </div>
          <span className="text-[11px] font-mono text-slate-400">Period: {dateRange.from || 'Start'} to {dateRange.to || 'Present'}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-2 border-b border-slate-800/80">
              <span className="text-slate-300 font-medium">Gross Revenue</span>
              <span className="font-mono font-bold text-white">{formatCurrency(summary.totalGrossSales, settings.currencySymbol)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-800/80 text-slate-400">
              <span>Less: COGS</span>
              <span className="font-mono text-rose-400">-{formatCurrency(summary.totalCostOfGoods, settings.currencySymbol)}</span>
            </div>
            <div className="flex justify-between py-2.5 bg-slate-950/80 px-3 rounded-xl border border-slate-800">
              <span className="font-bold text-white">Gross Profit</span>
              <span className="font-mono font-bold text-emerald-400">{formatCurrency(summary.totalGrossProfit, settings.currencySymbol)} ({summary.profitMarginPercent}%)</span>
            </div>
          </div>
          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-2 border-b border-slate-800/80 text-slate-400">
              <span>Less: Expenses</span>
              <span className="font-mono text-rose-400">-{formatCurrency(summary.totalExpenses, settings.currencySymbol)}</span>
            </div>
            <div className={`flex justify-between py-2.5 px-3 rounded-xl border ${summary.netProfit >= 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/30'}`}>
              <span className="font-bold text-white">NET PROFIT</span>
              <span className={`font-mono font-extrabold ${summary.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formatCurrency(summary.netProfit, settings.currencySymbol)} ({summary.netMarginPercent}%)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Shop Performance */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl">
        <div className="flex items-center justify-between mb-3.5 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Store className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs sm:text-sm font-bold text-white">Shop Performance</h3>
          </div>
          <select
            value={shopFilter}
            onChange={e => setShopFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
          >
            <option value="ALL">🏪 All Shops</option>
            {shops.map(s => <option key={s.id} value={s.id}>🏪 {s.name}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto">
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
                  <td className="py-2.5 text-center font-mono text-slate-300">{shop.salesCount}</td>
                  <td className="py-2.5 text-right font-mono font-medium text-white">{formatCurrency(shop.totalSales, settings.currencySymbol)}</td>
                  <td className="py-2.5 text-right font-mono font-bold text-emerald-400">+{formatCurrency(shop.grossProfit, settings.currencySymbol)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Profitability */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl">
        <div className="flex items-center justify-between mb-3.5 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs sm:text-sm font-bold text-white">Product Profitability</h3>
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={productSearch}
              onChange={e => setProductSearch(e.target.value)}
              placeholder="Filter by product..."
              className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white w-40 sm:w-56"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
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
                  <td className="py-2.5 text-center font-mono text-slate-300">{p.unitsSold}</td>
                  <td className="py-2.5 text-right font-mono font-medium text-white">{formatCurrency(p.revenue, settings.currencySymbol)}</td>
                  <td className="py-2.5 text-right font-mono font-bold text-emerald-400">+{formatCurrency(p.profit, settings.currencySymbol)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Seller Performance */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl">
        <div className="flex items-center justify-between mb-3.5 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-purple-400" />
            <h3 className="text-xs sm:text-sm font-bold text-white">Seller Performance</h3>
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={sellerSearch}
              onChange={e => setSellerSearch(e.target.value)}
              placeholder="Filter by seller..."
              className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white w-40 sm:w-56"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
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
                  <td className="py-2.5 text-center font-mono text-slate-300">{seller.count}</td>
                  <td className="py-2.5 text-right font-mono font-medium text-white">{formatCurrency(seller.total, settings.currencySymbol)}</td>
                  <td className="py-2.5 text-right font-mono font-bold text-emerald-400">+{formatCurrency(seller.profit, settings.currencySymbol)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
