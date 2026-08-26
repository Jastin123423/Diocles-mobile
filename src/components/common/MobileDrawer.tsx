import React from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Receipt,
  History,
  Users,
  TrendingDown,
  Truck,
  BarChart3,
  Database,
  Settings,
  Boxes,
  Lock,
  Store,
  FileText,
  Bell,
  X,
  Shield,
  LogOut,
  RefreshCw,
  WifiOff,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { NotificationService } from '../../services/notificationService';
import { formatDate } from '../../utils/formatters';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavItem {
  id: string;
  label: string;
  subtitle?: string;
  icon: React.ElementType;
  badge?: number | string;
  badgeColor?: 'red' | 'amber' | 'blue';
  category: 'core' | 'operations' | 'management' | 'system';
}

export const MobileDrawer: React.FC<MobileDrawerProps> = ({ isOpen, onClose }) => {
  const {
    currentUser,
    activeTab,
    setActiveTab,
    sellerColor,
    dbState,
    logout,
    syncStatus,
    triggerSync,
    selectedShopId,
    setSelectedShopId,
    availableShops,
    currentShop,
  } = useApp();

  if (!isOpen || !currentUser) return null;

  const isSeller = currentUser.role === 'SELLER';
  const isAdmin = currentUser.role === 'ADMIN';
  const settings = dbState.settings;

  // Count low-stock items
  const lowStockCount = (dbState.products || []).filter(
    p => p.status === 'ACTIVE' && p.currentStock <= p.minStock
  ).length;

  // Count unread notifications
  const unreadNotifsCount = NotificationService.getUnreadCount(currentUser);

  // Count pending/overdue debts
  const debts = dbState.debts || [];
  const overdueDebtsCount = debts.filter(d => d.status === 'OVERDUE').length;

  const sellerNav: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', subtitle: 'Muhtasari wa mauzo na takwimu', icon: LayoutDashboard, category: 'core' },
    { id: 'new_sale', label: 'New Sale (POS)', subtitle: 'Kuuza bidhaa na risiti', icon: ShoppingCart, category: 'core' },
    { id: 'products', label: 'Product Catalog', subtitle: 'Orodha ya bidhaa na bei', icon: Package, badge: lowStockCount > 0 ? lowStockCount : undefined, category: 'operations' },
    { id: 'purchases', label: 'Purchases (Manunuzi)', subtitle: 'Kuingiza mzigo dukani', icon: Truck, category: 'operations' },
    { id: 'my_sales', label: 'My Sales History', subtitle: 'Historia ya mauzo yangu', icon: History, category: 'operations' },
    { id: 'debts', label: 'Debt Management (Madeni)', subtitle: 'Wanaotudai & tunaowadai', icon: FileText, badge: overdueDebtsCount > 0 ? `${overdueDebtsCount} Overdue` : debts.filter(d => d.status !== 'PAID').length || undefined, badgeColor: overdueDebtsCount > 0 ? 'red' : 'amber', category: 'management' },
    { id: 'notifications', label: 'Taarifa & Vikumbusho', subtitle: 'Stock, madeni na bei', icon: Bell, badge: unreadNotifsCount > 0 ? unreadNotifsCount : undefined, badgeColor: 'red', category: 'management' },
    { id: 'receipts', label: 'Receipts (Risiti)', subtitle: 'Kutazama na kuchapisha risiti', icon: Receipt, category: 'management' },
    { id: 'settings', label: 'Seller Settings', subtitle: 'Mpangilio wa akaunti', icon: Settings, category: 'system' },
  ];

  const adminNav: NavItem[] = [
    { id: 'dashboard', label: 'Executive Dashboard', subtitle: 'Uchambuzi wa kampuni yote', icon: LayoutDashboard, category: 'core' },
    { id: 'new_sale', label: 'New Sale (POS Terminal)', subtitle: 'Kuuza na kutoa risiti', icon: ShoppingCart, category: 'core' },
    { id: 'shops', label: 'Shops & Business Units', subtitle: 'Maduka na vitengo vyote', icon: Store, badge: (dbState.shops || []).length, category: 'core' },
    { id: 'sales', label: 'Sales Transactions', subtitle: 'Historia na faida ya mauzo', icon: History, category: 'operations' },
    { id: 'products', label: 'Products & Categories', subtitle: 'Bidhaa, picha na makundi', icon: Package, category: 'operations' },
    { id: 'inventory', label: 'Stock & Inventory', subtitle: 'Kudhibiti na marekebisho ya stoo', icon: Boxes, badge: lowStockCount > 0 ? `${lowStockCount} Low` : undefined, category: 'operations' },
    { id: 'purchases', label: 'Purchases & Stock-In', subtitle: 'Manunuzi na gharama za mzigo', icon: Truck, category: 'operations' },
    { id: 'expenses', label: 'Operational Expenses', subtitle: 'Matumizi ya duka na kampuni', icon: TrendingDown, category: 'operations' },
    { id: 'debts', label: 'Debt Management (Madeni)', subtitle: 'Daftari la madeni na vikumbusho', icon: FileText, badge: overdueDebtsCount > 0 ? `${overdueDebtsCount} Overdue` : undefined, badgeColor: 'red', category: 'management' },
    { id: 'reports', label: 'Reports & Analytics', subtitle: 'Ripoti za kifedha na faida', icon: BarChart3, category: 'management' },
    { id: 'sellers', label: 'Sellers & Staff Accounts', subtitle: 'Wauzaji, maduka na password', icon: Users, category: 'management' },
    { id: 'notifications', label: 'Notification Center', subtitle: 'Tahadhari na taarifa za mfumo', icon: Bell, badge: unreadNotifsCount > 0 ? unreadNotifsCount : undefined, badgeColor: 'red', category: 'management' },
    { id: 'data_management', label: 'Data & CSV Backup', subtitle: 'Kuhifadhi, import na export', icon: Database, category: 'system' },
    { id: 'settings', label: 'System Settings', subtitle: 'Identity, theme, na kodi', icon: Settings, category: 'system' },
  ];

  const items = isSeller ? sellerNav : adminNav;

  const handleNavClick = (tabId: string) => {
    setActiveTab(tabId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex lg:hidden animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="relative w-[85vw] max-w-[340px] bg-slate-900 border-r border-slate-800 h-full flex flex-col justify-between shadow-2xl z-10 overflow-hidden">
        {/* Drawer Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/80 safe-top">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-md"
                style={{ backgroundColor: isSeller ? sellerColor.primary : '#2563eb' }}
              >
                {isAdmin ? <Shield className="w-5 h-5" /> : currentUser.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-white truncate">{currentUser.name}</h3>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                    isAdmin
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  }`}
                >
                  {isAdmin ? 'Administrator' : 'Seller'}
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Shop Switcher inside Drawer for Mobile */}
          <div className="mt-2 p-2.5 rounded-xl bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5 text-amber-400" />
                <span>Selected Shop Unit</span>
              </span>
              {currentShop && (
                <span className="text-[10px] text-emerald-400 font-mono">Active</span>
              )}
            </div>

            {isAdmin ? (
              <select
                id="drawer-admin-shop-select"
                value={selectedShopId}
                onChange={e => {
                  setSelectedShopId(e.target.value);
                }}
                className="w-full bg-slate-950 text-xs text-white font-medium py-2 px-2.5 rounded-lg border border-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">🏢 All Shops (Overview)</option>
                {availableShops.map(sh => (
                  <option key={sh.id} value={sh.id}>
                    {sh.status === 'INACTIVE' ? `🚫 ${sh.name} (Inactive)` : `🏪 ${sh.name}`}
                  </option>
                ))}
              </select>
            ) : availableShops.length > 1 ? (
              <select
                id="drawer-seller-shop-select"
                value={selectedShopId}
                onChange={e => {
                  setSelectedShopId(e.target.value);
                }}
                className="w-full bg-slate-950 text-xs text-blue-300 font-medium py-2 px-2.5 rounded-lg border border-blue-700/60 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {availableShops.map(sh => (
                  <option key={sh.id} value={sh.id}>
                    🏪 {sh.name}
                  </option>
                ))}
              </select>
            ) : availableShops.length === 1 ? (
              <div className="text-xs font-semibold text-blue-300 py-1 px-1">
                🏪 {availableShops[0].name}
              </div>
            ) : (
              <div className="text-xs text-rose-400 py-1">
                ⚠️ No Assigned Shops
              </div>
            )}
          </div>
        </div>

        {/* Navigation Items List */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          {items.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                id={`drawer-nav-${item.id}`}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all ${
                  isActive
                    ? 'text-white shadow-md font-semibold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                }`}
                style={{
                  backgroundColor: isActive
                    ? isSeller
                      ? sellerColor.primary
                      : '#2563eb'
                    : undefined,
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`p-2 rounded-lg ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold truncate">{item.label}</div>
                    {item.subtitle && (
                      <div className={`text-[10px] truncate ${isActive ? 'text-white/80' : 'text-slate-500'}`}>
                        {item.subtitle}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {item.badge !== undefined && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        isActive
                          ? 'bg-white/30 text-white'
                          : item.badgeColor === 'red'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : item.badgeColor === 'blue'
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                  <ChevronRight className={`w-3.5 h-3.5 ${isActive ? 'text-white/70' : 'text-slate-600'}`} />
                </div>
              </button>
            );
          })}
        </div>

        {/* Drawer Footer with Sync, Offline & Logout */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/90 safe-bottom space-y-2">
          {/* Sync status */}
          <div className="flex items-center justify-between text-xs px-1">
            <div className="flex items-center gap-1.5">
              <WifiOff className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px] text-slate-300 font-medium">Offline Engine Ready</span>
            </div>
            <button
              onClick={triggerSync}
              className="text-[11px] text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${syncStatus.state === 'SYNCING' ? 'animate-spin' : ''}`} />
              <span>Sync</span>
            </button>
          </div>

          {/* Logout button */}
          <button
            onClick={() => {
              onClose();
              logout();
            }}
            className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-rose-950/50 hover:text-rose-300 text-slate-300 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition"
          >
            <LogOut className="w-4 h-4" />
            <span>Switch User / Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
