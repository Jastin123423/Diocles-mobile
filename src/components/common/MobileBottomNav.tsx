import React from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  History,
  FileText,
  Menu,
  Boxes,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { NotificationService } from '../../services/notificationService';

interface MobileBottomNavProps {
  onOpenMenu: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ onOpenMenu }) => {
  const { currentUser, activeTab, setActiveTab, sellerColor, dbState } = useApp();

  if (!currentUser) return null;

  const isSeller = currentUser.role === 'SELLER';

  // Count low-stock items
  const lowStockCount = (dbState.products || []).filter(
    p => p.status === 'ACTIVE' && p.currentStock <= p.minStock
  ).length;

  // Count unread notifications + debts
  const debts = dbState.debts || [];
  const overdueDebtsCount = debts.filter(d => d.status === 'OVERDUE').length;

  // Primary tabs for Seller:
  // 1. Dashboard (Home)
  // 2. Products
  // 3. New Sale (POS) - Elevated center button
  // 4. Debts (Madeni)
  // 5. More (☰ Menu)

  // Primary tabs for Admin:
  // 1. Dashboard (Home)
  // 2. Sales History
  // 3. New Sale (POS) - Elevated center button
  // 4. Products / Inventory
  // 5. More (☰ Menu)

  const isMoreActive = isSeller
    ? ['purchases', 'my_sales', 'notifications', 'receipts', 'settings'].includes(activeTab)
    : ['shops', 'sellers', 'purchases', 'expenses', 'reports', 'debts', 'notifications', 'data_management', 'settings'].includes(activeTab);

  return (
    <nav
      id="mobile-bottom-navigation"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 safe-bottom px-2 py-1 select-none shadow-2xl"
    >
      <div className="flex items-center justify-around">
        {/* Tab 1: Dashboard */}
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition ${
            activeTab === 'dashboard'
              ? 'text-blue-400 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <LayoutDashboard className={`w-5 h-5 mb-1 ${activeTab === 'dashboard' ? 'scale-110' : ''} transition-transform`} />
          <span className="text-[10px] tracking-tight leading-none">Home</span>
        </button>

        {/* Tab 2: Products (Seller) or Sales (Admin) */}
        {isSeller ? (
          <button
            onClick={() => setActiveTab('products')}
            className={`flex-1 relative flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition ${
              activeTab === 'products'
                ? 'text-blue-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="relative">
              <Package className={`w-5 h-5 mb-1 ${activeTab === 'products' ? 'scale-110' : ''} transition-transform`} />
              {lowStockCount > 0 && (
                <span className="absolute -top-1 -right-2 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-slate-900" />
              )}
            </div>
            <span className="text-[10px] tracking-tight leading-none">Products</span>
          </button>
        ) : (
          <button
            onClick={() => setActiveTab('sales')}
            className={`flex-1 flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition ${
              activeTab === 'sales'
                ? 'text-blue-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className={`w-5 h-5 mb-1 ${activeTab === 'sales' ? 'scale-110' : ''} transition-transform`} />
            <span className="text-[10px] tracking-tight leading-none">Sales</span>
          </button>
        )}

        {/* Tab 3: CENTER POS ACTION BUTTON (Elevated) */}
        <div className="flex-1 flex items-center justify-center px-1 -mt-4">
          <button
            id="mobile-pos-center-btn"
            onClick={() => setActiveTab('new_sale')}
            className={`w-13 h-13 rounded-full flex flex-col items-center justify-center text-white shadow-xl shadow-blue-500/25 ring-4 ring-slate-950 transition-all active:scale-95 ${
              activeTab === 'new_sale' ? 'scale-105 ring-blue-500/40' : ''
            }`}
            style={{
              backgroundColor: isSeller ? sellerColor.primary : '#2563eb',
            }}
          >
            <ShoppingCart className="w-6 h-6" />
            <span className="text-[9px] font-extrabold uppercase tracking-tighter mt-0.5">POS</span>
          </button>
        </div>

        {/* Tab 4: Debts (Seller) or Inventory/Products (Admin) */}
        {isSeller ? (
          <button
            onClick={() => setActiveTab('debts')}
            className={`flex-1 relative flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition ${
              activeTab === 'debts'
                ? 'text-blue-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="relative">
              <FileText className={`w-5 h-5 mb-1 ${activeTab === 'debts' ? 'scale-110' : ''} transition-transform`} />
              {overdueDebtsCount > 0 && (
                <span className="absolute -top-1 -right-2 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-slate-900 animate-pulse" />
              )}
            </div>
            <span className="text-[10px] tracking-tight leading-none">Madeni</span>
          </button>
        ) : (
          <button
            onClick={() => setActiveTab('products')}
            className={`flex-1 relative flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition ${
              ['products', 'inventory'].includes(activeTab)
                ? 'text-blue-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="relative">
              <Boxes className={`w-5 h-5 mb-1 ${['products', 'inventory'].includes(activeTab) ? 'scale-110' : ''} transition-transform`} />
              {lowStockCount > 0 && (
                <span className="absolute -top-1 -right-2 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-slate-900" />
              )}
            </div>
            <span className="text-[10px] tracking-tight leading-none">Stock</span>
          </button>
        )}

        {/* Tab 5: More (Menu Drawer trigger) */}
        <button
          id="mobile-more-menu-btn"
          onClick={onOpenMenu}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition ${
            isMoreActive
              ? 'text-blue-400 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Menu className="w-5 h-5 mb-1" />
          <span className="text-[10px] tracking-tight leading-none">Menu</span>
        </button>
      </div>
    </nav>
  );
};
