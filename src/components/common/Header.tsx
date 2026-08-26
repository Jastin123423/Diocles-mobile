import React, { useState, useRef, useEffect } from 'react';
import {
  Monitor,
  WifiOff,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  LogOut,
  Shield,
  Clock,
  Store,
  ChevronDown,
  Bell,
  CheckCheck,
  ArrowRight,
  AlertTriangle,
  Package,
  DollarSign,
  FileText,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatDate, formatDateTime } from '../../utils/formatters';
import { NotificationService } from '../../services/notificationService';

interface HeaderProps {
  onOpenDrawer?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenDrawer }) => {
  const {
    currentUser,
    logout,
    syncStatus,
    triggerSync,
    sellerColor,
    dbState,
    selectedShopId,
    setSelectedShopId,
    availableShops,
    setActiveTab,
  } = useApp();
  const settings = dbState.settings;

  const [isNotifDropdownOpen, setIsNotifDropdownOpen] = useState(false);
  const notifDropdownRef = useRef<HTMLDivElement>(null);

  const isAdmin = currentUser?.role === 'ADMIN';

  // Sync automatic notifications
  useEffect(() => {
    NotificationService.syncAutomaticNotifications();
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(e.target as Node)) {
        setIsNotifDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const userNotifications = NotificationService.getUserNotifications(currentUser);
  const unreadCount = NotificationService.getUnreadCount(currentUser);
  const recentNotifications = userNotifications.slice(0, 4);

  const handleOpenAllNotifications = () => {
    setIsNotifDropdownOpen(false);
    setActiveTab('notifications');
  };

  return (
    <header id="app-header" className="bg-slate-900 text-slate-100 border-b border-slate-800 select-none sticky top-0 z-30 safe-top">
      {/* Main App Bar - Fully Responsive */}
      <div className="flex items-center justify-between px-2.5 sm:px-4 py-2 sm:py-2.5 gap-2">
        {/* Left: Mobile Drawer Trigger + User / App Identity */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* Mobile Hamburger Button */}
          {onOpenDrawer && (
            <button
              id="mobile-drawer-toggle"
              onClick={onOpenDrawer}
              className="lg:hidden p-2 rounded-xl bg-slate-800 text-slate-200 hover:text-white hover:bg-slate-750 transition active:scale-95"
              aria-label="Open menu"
            >
              <span className="text-lg font-bold">☰</span>
            </button>
          )}

          <div
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center font-bold text-white shadow-sm shrink-0 transition-colors"
            style={{ backgroundColor: currentUser?.role === 'ADMIN' ? '#334155' : sellerColor.primary }}
          >
            {currentUser?.role === 'ADMIN' ? (
              <Shield className="w-4 h-4 sm:w-5 sm:h-5" />
            ) : (
              currentUser?.name.charAt(0).toUpperCase() || 'S'
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="font-semibold text-xs sm:text-sm text-white tracking-tight truncate">
                {currentUser?.name || 'Diocres POS'}
              </h1>
              <span
                className={`text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.2 sm:py-0.5 rounded-full font-medium uppercase tracking-wider shrink-0 ${
                  currentUser?.role === 'ADMIN'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                }`}
              >
                {currentUser?.role === 'ADMIN' ? 'Admin' : 'Seller'}
              </span>
            </div>
            <p className="text-[10px] sm:text-xs text-slate-400 truncate hidden xs:block">
              {settings.businessName} • Offline Ready
            </p>
          </div>
        </div>

        {/* Middle: Shop Selector & Context (Desktop + Tablet) */}
        <div className="hidden sm:flex items-center gap-1.5 sm:gap-2 bg-slate-950/80 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-slate-800 shadow-inner">
          <Store className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 shrink-0" />
          <span className="text-[11px] sm:text-xs text-slate-400 font-medium hidden md:inline">Shop:</span>

          {isAdmin ? (
            <div className="relative flex items-center">
              <select
                id="header-admin-shop-select"
                value={selectedShopId}
                onChange={e => setSelectedShopId(e.target.value)}
                className="bg-slate-900 text-[11px] sm:text-xs text-slate-200 font-semibold py-1 pl-2 pr-6 rounded border border-slate-700 hover:border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer appearance-none max-w-[140px] sm:max-w-[200px] truncate"
              >
                <option value="ALL">🏢 All Shops</option>
                {availableShops.map(sh => (
                  <option key={sh.id} value={sh.id}>
                    {sh.status === 'INACTIVE' ? `🚫 ${sh.name}` : `🏪 ${sh.name}`}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 pointer-events-none" />
            </div>
          ) : availableShops.length > 1 ? (
            <div className="relative flex items-center">
              <select
                id="header-seller-shop-select"
                value={selectedShopId}
                onChange={e => setSelectedShopId(e.target.value)}
                className="bg-slate-900 text-[11px] sm:text-xs text-blue-300 font-semibold py-1 pl-2 pr-6 rounded border border-blue-700/60 hover:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer appearance-none max-w-[140px] sm:max-w-[200px] truncate"
              >
                {availableShops.map(sh => (
                  <option key={sh.id} value={sh.id}>
                    🏪 {sh.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-blue-400 absolute right-1.5 pointer-events-none" />
            </div>
          ) : availableShops.length === 1 ? (
            <span className="text-[11px] sm:text-xs font-semibold text-blue-300 bg-blue-950/60 px-2 py-0.5 rounded border border-blue-800/60 truncate max-w-[140px]">
              🏪 {availableShops[0].name}
            </span>
          ) : (
            <span className="text-[11px] sm:text-xs text-rose-400 bg-rose-950/40 px-2 py-0.5 rounded border border-rose-900/60">
              ⚠️ No Shop
            </span>
          )}
        </div>

        {/* Right side status indicators & user actions */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Notification Bell Dropdown */}
          <div className="relative" ref={notifDropdownRef}>
            <button
              id="header-notification-bell"
              onClick={() => setIsNotifDropdownOpen(!isNotifDropdownOpen)}
              title="Kituo cha Taarifa na Vikumbusho"
              className={`p-2 rounded-lg transition relative flex items-center justify-center border ${
                unreadCount > 0
                  ? 'bg-slate-800 text-amber-400 border-amber-500/40 hover:bg-slate-750'
                  : 'bg-slate-800/90 text-slate-300 border-slate-700 hover:bg-slate-800'
              }`}
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-0.5 rounded-full bg-rose-600 text-white font-mono text-[9px] font-bold flex items-center justify-center border-2 border-slate-900 animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notification Popover Dropdown */}
            {isNotifDropdownOpen && (
              <div className="fixed sm:absolute right-2 sm:right-0 top-12 sm:top-full mt-1 w-[92vw] max-w-sm bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                <div className="p-3 bg-slate-850 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-blue-400" />
                    <span className="font-bold text-xs text-white">Taarifa & Vikumbusho</span>
                    {unreadCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-mono font-bold">
                        {unreadCount} Mpya
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && currentUser && (
                    <button
                      onClick={() => NotificationService.markAllAsRead(currentUser)}
                      className="text-[11px] text-slate-400 hover:text-emerald-400 flex items-center gap-1 transition"
                      title="Weka zote zimesomwa"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span>Zisome zote</span>
                    </button>
                  )}
                </div>

                {/* List */}
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-800/60">
                  {recentNotifications.length === 0 ? (
                    <div className="p-6 text-center text-slate-500 text-xs">
                      <Bell className="w-8 h-8 mx-auto mb-1.5 opacity-20" />
                      <div>Hakuna taarifa yoyote kwa sasa.</div>
                    </div>
                  ) : (
                    recentNotifications.map(n => {
                      const isRead = (n.readByUserIds || []).includes(currentUser?.id || '');
                      return (
                        <div
                          key={n.id}
                          onClick={() => {
                            if (currentUser) NotificationService.markAsRead(n.id, currentUser);
                            setIsNotifDropdownOpen(false);
                            if (n.relatedEntityType === 'DEBT' || n.type.startsWith('DEBT_')) {
                              setActiveTab('debts');
                            } else {
                              setActiveTab('notifications');
                            }
                          }}
                          className={`p-3 text-xs transition cursor-pointer hover:bg-slate-800/60 flex items-start gap-2.5 ${
                            isRead ? 'text-slate-400' : 'bg-slate-850/50 text-slate-100 font-medium'
                          }`}
                        >
                          <div className="mt-0.5 shrink-0">
                            {n.type.startsWith('DEBT_') ? (
                              <Clock className="w-4 h-4 text-amber-400" />
                            ) : n.type === 'STOCK_OUT' ? (
                              <AlertTriangle className="w-4 h-4 text-rose-400" />
                            ) : n.type === 'STOCK_LOW' ? (
                              <Package className="w-4 h-4 text-amber-400" />
                            ) : (
                              <DollarSign className="w-4 h-4 text-blue-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1 mb-0.5">
                              <span className="font-bold text-[11px] text-white truncate">
                                {!isRead && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block mr-1" />}
                                {n.title}
                              </span>
                              <span className="text-[9px] text-slate-500 font-mono shrink-0">
                                {formatDate(n.createdAt)}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed">
                              {n.message}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer link to full notification center */}
                <div className="p-2.5 bg-slate-950/80 border-t border-slate-800 text-center">
                  <button
                    onClick={handleOpenAllNotifications}
                    className="w-full py-1.5 text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center justify-center gap-1 transition"
                  >
                    <span>Fungua Kituo Kamili cha Taarifa</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Sync & Offline Status Badge */}
          <button
            id="sync-status-button"
            onClick={triggerSync}
            title="Click to simulate synchronization with server"
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-800 text-xs font-medium border border-slate-700 transition"
          >
            {syncStatus.state === 'SYNCING' ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin shrink-0" />
                <span className="text-blue-300 hidden md:inline">Syncing...</span>
              </>
            ) : syncStatus.state === 'PENDING_SYNC' ? (
              <>
                <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="text-amber-300 hidden md:inline">Pending ({syncStatus.pendingCount})</span>
              </>
            ) : syncStatus.state === 'SYNCED' ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="text-emerald-300 hidden md:inline">Synced</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="text-emerald-300 hidden md:inline">Offline</span>
              </>
            )}
          </button>

          {/* Logout Button (Icon only on mobile, full text on desktop) */}
          <button
            id="logout-button"
            onClick={logout}
            title="Sign out / Switch user"
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/40 hover:text-rose-300 hover:border-rose-800/60 text-slate-300 text-xs font-medium border border-slate-700 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Switch User</span>
          </button>
        </div>

      </div>
    </header>
  );
};
