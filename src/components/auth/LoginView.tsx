import React, { useState } from 'react';
import {
  Monitor,
  Shield,
  User as UserIcon,
  KeyRound,
  ArrowRight,
  Lock,
  Boxes,
  Smartphone,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AuthService } from '../../services/authService';
import { UserRole } from '../../types';

export const LoginView: React.FC = () => {
  const { login, dbState } = useApp();
  const [activePortal, setActivePortal] = useState<UserRole>('SELLER');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const settings = dbState.settings;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!username.trim()) {
      setErrorMsg('Please enter your username or account ID.');
      return;
    }

    if (!password) {
      setErrorMsg('Please enter your password.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await AuthService.login(username, password, activePortal);
      if (result.success && result.user) {
        login(result.user);
      } else {
        setErrorMsg(result.error || 'Authentication failed. Please verify credentials.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div id="login-screen" className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between select-none safe-top safe-bottom">
      {/* Top Status Bar */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs text-slate-400">
        <div className="flex items-center gap-1.5 sm:gap-2 truncate">
          <Smartphone className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400 shrink-0" />
          <span className="font-semibold text-slate-200 truncate">{settings.businessName}</span>
          <span className="text-slate-600 hidden xs:inline">•</span>
          <span className="text-slate-400 hidden xs:inline">Mobile & Desktop Ready</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
          <span className="text-[10px] sm:text-[11px] text-emerald-400 font-medium">Offline Ready</span>
        </div>
      </div>

      {/* Main Login Body */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="max-w-md w-full">
          {/* Brand Header */}
          <div className="text-center mb-6 sm:mb-8">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center mx-auto mb-3 sm:mb-4 shadow-xl shadow-blue-500/10 border border-blue-400/30">
              <Boxes className="w-8 h-8 sm:w-9 sm:h-9 text-white" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">{settings.businessName}</h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">{settings.tagline}</p>
          </div>

          {/* Portal Switcher Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-2xl">
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950/80 rounded-xl border border-slate-800/80 mb-5 sm:mb-6">
              <button
                type="button"
                id="portal-seller-btn"
                onClick={() => {
                  setActivePortal('SELLER');
                  setErrorMsg('');
                }}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all active:scale-95 ${
                  activePortal === 'SELLER'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <UserIcon className="w-4 h-4" />
                <span>Seller Login</span>
              </button>

              <button
                type="button"
                id="portal-admin-btn"
                onClick={() => {
                  setActivePortal('ADMIN');
                  setErrorMsg('');
                }}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all active:scale-95 ${
                  activePortal === 'ADMIN'
                    ? 'bg-slate-800 text-amber-300 border border-amber-500/40 shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Shield className="w-4 h-4" />
                <span>Admin Login</span>
              </button>
            </div>

            {/* Error banner */}
            {errorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2 animate-in fade-in">
                <Lock className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  {activePortal === 'ADMIN' ? 'Admin Username' : 'Seller Username / Account ID'}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <input
                    id="login-username-input"
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder={activePortal === 'ADMIN' ? 'Enter admin username' : 'Enter seller username'}
                    autoFocus
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    id="login-password-input"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter password..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                id="login-submit-btn"
                disabled={isLoading}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white shadow-lg transition-all active:scale-95 ${
                  activePortal === 'ADMIN'
                    ? 'bg-amber-600 hover:bg-amber-500 focus:ring-amber-500'
                    : 'bg-blue-600 hover:bg-blue-500 focus:ring-blue-500'
                } disabled:opacity-50`}
              >
                {isLoading ? (
                  <span>Authenticating...</span>
                ) : (
                  <>
                    <span>Ingia ({activePortal === 'ADMIN' ? 'Admin Portal' : 'POS Register'})</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <footer className="px-4 py-3 border-t border-slate-900 text-center text-[11px] sm:text-xs text-slate-400">
        Local SQLite-compatible Storage • Zero Internet Requirement • Multi-Shop Ready
      </footer>
    </div>
  );
};
