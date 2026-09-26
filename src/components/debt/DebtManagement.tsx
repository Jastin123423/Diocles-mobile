import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { DebtService } from '../../services/debtService';
import { DebtRecord, DebtType, DebtStatus, DebtPayment } from '../../types';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';
import {
  DollarSign,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Calendar,
  Phone,
  Edit2,
  Trash2,
  Filter,
  FileText,
  User,
  ArrowUpRight,
  ArrowDownLeft,
  X,
  Sparkles,
  Info,
  History,
  Receipt,
  CreditCard,
  Check,
  ChevronDown,
  Loader2,
  Archive,
  CircleDot,
} from 'lucide-react';

const PAGE_SIZE = 10;

export const DebtManagement: React.FC = () => {
  const { currentUser, dbState, addToast } = useApp();
  const settings = dbState.settings;

  // Active type filter
  const [activeTypeTab, setActiveTypeTab] = useState<'ALL' | DebtType>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Pagination — separate counters
  const [activeVisible, setActiveVisible] = useState(PAGE_SIZE);
  const [completedVisible, setCompletedVisible] = useState(PAGE_SIZE);
  const [loadingActive, setLoadingActive] = useState(false);
  const [loadingCompleted, setLoadingCompleted] = useState(false);

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<DebtRecord | null>(null);
  const [payingDebt, setPayingDebt] = useState<DebtRecord | null>(null);
  const [viewingHistoryDebt, setViewingHistoryDebt] = useState<DebtRecord | null>(null);
  const [deletingDebt, setDeletingDebt] = useState<DebtRecord | null>(null);

  // Form State
  const [formType, setFormType] = useState<DebtType>('WE_DEMAND');
  const [formName, setFormName] = useState('');
  const [formProduct, setFormProduct] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formDueDate, setFormDueDate] = useState('');
  const [formContact, setFormContact] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Payment Form State
  const [paymentAmountInput, setPaymentAmountInput] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));

  // Compute live debts
  const debts = useMemo(() => {
    return DebtService.getAllDebts(currentUser);
  }, [dbState.debts, currentUser]);

  // Summary
  const summary = useMemo(() => {
    return DebtService.getSummary(currentUser);
  }, [dbState.debts, currentUser]);

  // Filtered debts
  const filteredDebts = useMemo(() => {
    return debts.filter(d => {
      if (activeTypeTab !== 'ALL' && d.type !== activeTypeTab) return false;
      if (statusFilter !== 'ALL' && d.status !== statusFilter) return false;

      if (startDate) {
        const compareDate = (d.dueDate || d.createdAt).slice(0, 10);
        if (compareDate < startDate) return false;
      }
      if (endDate) {
        const compareDate = (d.dueDate || d.createdAt).slice(0, 10);
        if (compareDate > endDate) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = d.debtorName.toLowerCase().includes(q);
        const prodMatch = (d.productDescription || '').toLowerCase().includes(q);
        const contactMatch = (d.contact || '').toLowerCase().includes(q);
        const notesMatch = (d.notes || '').toLowerCase().includes(q);
        if (!nameMatch && !prodMatch && !contactMatch && !notesMatch) return false;
      }

      return true;
    });
  }, [debts, activeTypeTab, statusFilter, startDate, endDate, searchQuery]);

  // ─────────────────────────────────────────────────────────────
  // SPLIT: Active vs Completed
  // ─────────────────────────────────────────────────────────────
  const activeDebts = useMemo(() => {
    return filteredDebts
      .filter(
        d =>
          d.status !== 'PAID' &&
          d.status !== 'CANCELLED' &&
          d.status !== 'ARCHIVED'
      )
      .sort((a, b) => {
        const order: Record<string, number> = {
          OVERDUE: 0,
          DUE_TODAY: 1,
          PARTIALLY_PAID: 2,
          PENDING: 3,
        };
        const oa = order[a.status] ?? 99;
        const ob = order[b.status] ?? 99;
        if (oa !== ob) return oa - ob;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [filteredDebts]);

  const completedDebts = useMemo(() => {
    return filteredDebts
      .filter(
        d =>
          d.status === 'PAID' ||
          d.status === 'CANCELLED' ||
          d.status === 'ARCHIVED'
      )
      .sort((a, b) => {
        return (
          new Date(b.updatedAt || b.createdAt).getTime() -
          new Date(a.updatedAt || a.createdAt).getTime()
        );
      });
  }, [filteredDebts]);

  // Reset pagination when filters change
  useEffect(() => {
    setActiveVisible(PAGE_SIZE);
    setCompletedVisible(PAGE_SIZE);
  }, [activeTypeTab, statusFilter, searchQuery, startDate, endDate]);

  // Visible slices
  const visibleActive = activeDebts.slice(0, activeVisible);
  const visibleCompleted = completedDebts.slice(0, completedVisible);

  const hasMoreActive = activeDebts.length > activeVisible;
  const hasMoreCompleted = completedDebts.length > completedVisible;
  const remainingActive = activeDebts.length - activeVisible;
  const remainingCompleted = completedDebts.length - completedVisible;

  const handleSeeMoreActive = () => {
    setLoadingActive(true);
    setTimeout(() => {
      setActiveVisible(prev => prev + PAGE_SIZE);
      setLoadingActive(false);
    }, 300);
  };

  const handleSeeMoreCompleted = () => {
    setLoadingCompleted(true);
    setTimeout(() => {
      setCompletedVisible(prev => prev + PAGE_SIZE);
      setLoadingCompleted(false);
    }, 300);
  };

  const handleSeeLessActive = () => setActiveVisible(PAGE_SIZE);
  const handleSeeLessCompleted = () => setCompletedVisible(PAGE_SIZE);

  // Open Create Modal
  const openCreateModal = (type: DebtType = 'WE_DEMAND') => {
    setEditingDebt(null);
    setFormType(type);
    setFormName('');
    setFormProduct('');
    setFormAmount('');
    setFormDueDate('');
    setFormContact('');
    setFormNotes('');
    setIsCreateModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (debt: DebtRecord) => {
    setEditingDebt(debt);
    setFormType(debt.type);
    setFormName(debt.debtorName);
    setFormProduct(debt.productDescription || '');
    setFormAmount(debt.amount.toString());
    setFormDueDate(debt.dueDate ? debt.dueDate.slice(0, 10) : '');
    setFormContact(debt.contact || '');
    setFormNotes(debt.notes || '');
    setIsCreateModalOpen(true);
  };

  // Open Payment Modal
  const openPaymentModal = (debt: DebtRecord) => {
    setPayingDebt(debt);
    const remaining =
      debt.remainingAmount !== undefined
        ? debt.remainingAmount
        : debt.status === 'PAID'
        ? 0
        : debt.amount;
    setPaymentAmountInput(remaining > 0 ? remaining.toString() : debt.amount.toString());
    setPaymentMethod('CASH');
    setPaymentNote('');
    setPaymentDate(new Date().toISOString().slice(0, 10));
  };

  // Handle Form Submit
  const handleSaveDebt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (!formName.trim()) {
      addToast({ type: 'error', title: 'Tafadhali weka jina / Name is required' });
      return;
    }

    const amt = parseFloat(formAmount);
    if (isNaN(amt) || amt <= 0) {
      addToast({ type: 'error', title: 'Weka kiasi sahihi / Enter a valid amount' });
      return;
    }

    if (editingDebt) {
      const currentPaid = editingDebt.paidAmount || 0;
      const newRemaining = Math.max(0, amt - currentPaid);

      DebtService.updateDebt(
        editingDebt.id,
        {
          type: formType,
          debtorName: formName.trim(),
          productDescription: formProduct.trim() || undefined,
          amount: amt,
          paidAmount: currentPaid,
          remainingAmount: newRemaining,
          dueDate: formDueDate ? formDueDate : undefined,
          contact: formContact.trim() || undefined,
          notes: formNotes.trim() || undefined,
          status:
            newRemaining <= 0
              ? 'PAID'
              : currentPaid > 0
              ? 'PARTIALLY_PAID'
              : DebtService.calculateStatus({
                  ...editingDebt,
                  amount: amt,
                  paidAmount: currentPaid,
                  remainingAmount: newRemaining,
                  dueDate: formDueDate,
                }),
        },
        currentUser
      );

      addToast({
        type: 'success',
        title: 'Deni Limesasishwa / Debt Updated',
        description: `Rekodi ya ${formName} imesasishwa kwa mafanikio.`,
      });
    } else {
      DebtService.createDebt(
        {
          type: formType,
          debtorName: formName.trim(),
          productDescription: formProduct.trim() || undefined,
          amount: amt,
          dueDate: formDueDate ? formDueDate : undefined,
          contact: formContact.trim() || undefined,
          notes: formNotes.trim() || undefined,
        },
        currentUser
      );

      addToast({
        type: 'success',
        title:
          formType === 'WE_DEMAND'
            ? 'Deni la Mteja Limehifadhiwa'
            : 'Deni la Kampuni Limehifadhiwa',
        description: `Rekodi ya ${formName} (${formatCurrency(amt, settings.currencySymbol)}) imehifadhiwa.`,
      });
    }

    setIsCreateModalOpen(false);
    setEditingDebt(null);
  };

  // Handle Payment
  const handleConfirmPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingDebt || !currentUser) return;

    const paymentAmt = parseFloat(paymentAmountInput);
    if (isNaN(paymentAmt) || paymentAmt <= 0) {
      addToast({
        type: 'error',
        title: 'Kiasi Batili',
        description: 'Tafadhali weka kiasi halali cha malipo.',
      });
      return;
    }

    const currentRemaining =
      payingDebt.remainingAmount !== undefined
        ? payingDebt.remainingAmount
        : payingDebt.amount - (payingDebt.paidAmount || 0);

    if (paymentAmt > currentRemaining && currentRemaining > 0) {
      addToast({
        type: 'error',
        title: 'Kiasi Kimezidi Salio',
        description: `Kiasi ulichoweka (${formatCurrency(
          paymentAmt,
          settings.currencySymbol
        )}) kinazidi salio lililobaki (${formatCurrency(
          currentRemaining,
          settings.currencySymbol
        )}).`,
      });
      return;
    }

    const res = DebtService.recordPayment(payingDebt.id, paymentAmt, currentUser, {
      paymentDate,
      paymentMethod,
      notes: paymentNote,
    });

    if (res.success && res.debt) {
      const remainingAfter = res.debt.remainingAmount ?? 0;
      const isComplete = remainingAfter <= 0;

      addToast({
        type: 'success',
        title: isComplete ? 'Malipo Yamekamilika! 🎉' : 'Malipo ya Awamu Yamepokelewa',
        description: isComplete
          ? `Deni la ${payingDebt.debtorName} limelipwa kikamilifu (${formatCurrency(
              payingDebt.amount,
              settings.currencySymbol
            )}).`
          : `Imelipwa ${formatCurrency(paymentAmt, settings.currencySymbol)}. Baki iliyobaki: ${formatCurrency(
              remainingAfter,
              settings.currencySymbol
            )}.`,
      });

      setPayingDebt(null);
      setPaymentAmountInput('');
      setPaymentNote('');
    } else {
      addToast({
        type: 'error',
        title: 'Hitilafu ya Malipo',
        description: res.error || 'Imeshindikana kurekodi malipo.',
      });
    }
  };

  // Handle Delete
  const handleConfirmDelete = () => {
    if (!deletingDebt || !currentUser) return;

    DebtService.deleteDebt(deletingDebt.id, currentUser);

    addToast({
      type: 'info',
      title: 'Deni Limefutwa',
      description: `Rekodi ya ${deletingDebt.debtorName} imefutwa.`,
    });

    setDeletingDebt(null);
  };

  // ─────────────────────────────────────────────────────────────
  // MOBILE CARD RENDERER (shared by both sections)
  // ─────────────────────────────────────────────────────────────
  const renderDebtCard = (debt: DebtRecord) => {
    const isPaid = debt.status === 'PAID';
    const isPartiallyPaid = debt.status === 'PARTIALLY_PAID';
    const isOverdue = debt.status === 'OVERDUE';
    const isDueToday = debt.status === 'DUE_TODAY';
    const overdueDays = isOverdue ? DebtService.getOverdueDays(debt.dueDate) : 0;
    const paidAmount = debt.paidAmount || (isPaid ? debt.amount : 0);
    const remainingAmount =
      debt.remainingAmount !== undefined
        ? debt.remainingAmount
        : isPaid
        ? 0
        : Math.max(0, debt.amount - paidAmount);
    const paymentsCount = debt.payments?.length || (paidAmount > 0 ? 1 : 0);

    return (
      <div
        key={debt.id}
        className={`p-3.5 space-y-2.5 ${
          isOverdue && !isPaid ? 'bg-rose-950/10' : ''
        }`}
      >
        {/* Header Row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              {debt.type === 'WE_DEMAND' ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-semibold">
                  <ArrowDownLeft className="w-2.5 h-2.5" /> Tunadai
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-semibold">
                  <ArrowUpRight className="w-2.5 h-2.5" /> Wanatudai
                </span>
              )}
              <h4 className="font-bold text-xs text-white truncate">
                {debt.debtorName}
              </h4>
            </div>
            {debt.contact && (
              <div className="flex items-center gap-1 font-mono text-[10px] text-slate-400 mt-0.5">
                <Phone className="w-3 h-3 text-slate-500" />
                <span>{debt.contact}</span>
              </div>
            )}
          </div>

          {/* Status Badge */}
          <div className="shrink-0">
            {isPaid ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-700/80 text-[9px] font-bold">
                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" /> Imelipwa
              </span>
            ) : isPartiallyPaid ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-950/80 text-blue-300 border border-blue-700/80 text-[9px] font-bold">
                <Clock className="w-2.5 h-2.5 text-blue-400" /> Sehemu
              </span>
            ) : isOverdue ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-rose-950/80 text-rose-300 border border-rose-800 text-[9px] font-semibold">
                <AlertTriangle className="w-2.5 h-2.5" /> Imechelewa
              </span>
            ) : isDueToday ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-800 text-[9px] font-semibold">
                <Clock className="w-2.5 h-2.5" /> Leo
              </span>
            ) : (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[9px] font-semibold">
                Inasubiri
              </span>
            )}
          </div>
        </div>

        {/* Product + Notes */}
        {debt.productDescription && (
          <div className="text-xs text-slate-300 bg-slate-950/60 p-2 rounded-lg border border-slate-800 space-y-0.5">
            <div className="font-medium truncate">{debt.productDescription}</div>
            {debt.notes && (
              <div className="text-[10px] text-slate-500 truncate">{debt.notes}</div>
            )}
          </div>
        )}

        {/* Amounts Row: Total · Paid · Remaining */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="bg-slate-950/60 p-1.5 rounded-lg border border-slate-800">
            <div className="text-[9px] text-slate-400">Jumla</div>
            <div className="font-mono text-[11px] font-semibold text-slate-300 mt-0.5 truncate">
              {formatCurrency(debt.amount, settings.currencySymbol)}
            </div>
          </div>
          <div className="bg-slate-950/60 p-1.5 rounded-lg border border-slate-800">
            <div className="text-[9px] text-slate-400">Zilizolipwa</div>
            <div className="font-mono text-[11px] font-bold text-emerald-400 mt-0.5 truncate">
              {formatCurrency(paidAmount, settings.currencySymbol)}
            </div>
            {paymentsCount > 1 && (
              <button
                onClick={() => setViewingHistoryDebt(debt)}
                className="text-[9px] text-blue-400 hover:underline mt-0.5"
              >
                ({paymentsCount} awamu)
              </button>
            )}
          </div>
          <div
            className={`p-1.5 rounded-lg border ${
              debt.type === 'WE_DEMAND'
                ? 'bg-emerald-950/30 border-emerald-800/50'
                : 'bg-amber-950/30 border-amber-800/50'
            }`}
          >
            <div className="text-[9px] text-amber-400 font-semibold">Baki</div>
            {remainingAmount <= 0 ? (
              <div className="font-mono text-[11px] font-bold text-emerald-400 mt-0.5">
                <Check className="w-3 h-3 inline" /> 0
              </div>
            ) : (
              <div
                className={`font-mono text-[11px] font-extrabold mt-0.5 truncate ${
                  debt.type === 'WE_DEMAND' ? 'text-emerald-300' : 'text-amber-300'
                }`}
              >
                {formatCurrency(remainingAmount, settings.currencySymbol)}
              </div>
            )}
          </div>
        </div>

        {/* Due Date Row */}
        {debt.dueDate && (
          <div className="flex items-center justify-between text-[10px] pt-1">
            <div className="flex items-center gap-1 text-slate-400">
              <Calendar className="w-3 h-3 text-slate-500" />
              <span className="font-mono">{formatDate(debt.dueDate)}</span>
            </div>
            {isOverdue && !isPaid && (
              <span className="font-semibold text-rose-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Zimepita siku {overdueDays}
              </span>
            )}
            {isDueToday && !isPaid && (
              <span className="font-semibold text-amber-400 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Inatakiwa leo
              </span>
            )}
          </div>
        )}

        {/* Actions Row */}
        <div className="flex items-center gap-2 pt-1.5 border-t border-slate-800/60">
          {!isPaid && (
            <button
              onClick={() => openPaymentModal(debt)}
              className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-white font-semibold text-[11px] shadow-sm transition ${
                debt.type === 'WE_DEMAND'
                  ? 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700'
                  : 'bg-amber-600 hover:bg-amber-500 active:bg-amber-700'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Lipa</span>
            </button>
          )}

          {debt.payments && debt.payments.length > 0 && (
            <button
              onClick={() => setViewingHistoryDebt(debt)}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-blue-400"
              title="Historia ya Malipo"
            >
              <History className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => openEditModal(debt)}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-400"
            title="Hariri"
          >
            <Edit2 className="w-4 h-4" />
          </button>

          <button
            onClick={() => setDeletingDebt(debt)}
            className="p-2 rounded-lg bg-slate-800 hover:bg-rose-600 active:bg-rose-700 text-slate-400 hover:text-white"
            title="Futa"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div
      id="debt-management-page"
      className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950 text-slate-100"
    >
      {/* Top Header */}
      <header className="p-4 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white flex items-center gap-2">
                Usimamizi wa Madeni
              </h1>
              <p className="text-xs text-slate-400">
                Daftari la madeni ya Tunadai & Wanatudai
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => openCreateModal('WE_DEMAND')}
            className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1 shadow-sm transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tunadai</span>
          </button>
          <button
            onClick={() => openCreateModal('THEY_DEMAND')}
            className="px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white text-xs font-semibold flex items-center gap-1 shadow-sm transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Wanatudai</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
        {/* SUMMARY KPI CARDS */}
        <div className="grid grid-cols-1 gap-4">
          {/* TUNADAI */}
          <div className="bg-slate-900/80 border border-emerald-500/30 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <ArrowDownLeft className="w-4 h-4" />
                <span>Tunadai</span>
              </div>
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono font-bold">
                {summary.weDemand.totalCount}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-2.5">
                <div className="text-[10px] text-slate-400 font-medium uppercase">
                  Kinachodaiwa
                </div>
                <div className="text-sm font-bold font-mono text-emerald-400 mt-0.5">
                  {formatCurrency(summary.weDemand.totalOutstanding, settings.currencySymbol)}
                </div>
              </div>
              <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-2.5">
                <div className="text-[10px] text-amber-400 font-medium uppercase flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Leo
                </div>
                <div className="text-sm font-bold font-mono text-amber-300 mt-0.5">
                  {formatCurrency(summary.weDemand.dueTodayAmount, settings.currencySymbol)}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {summary.weDemand.dueTodayCount} wateja
                </div>
              </div>
              <div className="bg-slate-950/80 border border-rose-900/40 rounded-lg p-2.5 bg-rose-950/10">
                <div className="text-[10px] text-rose-400 font-medium uppercase flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Zimechelewa
                </div>
                <div className="text-sm font-bold font-mono text-rose-400 mt-0.5">
                  {formatCurrency(summary.weDemand.overdueAmount, settings.currencySymbol)}
                </div>
                <div className="text-[10px] text-rose-300/70 mt-0.5">
                  {summary.weDemand.overdueCount}
                </div>
              </div>
              <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-2.5">
                <div className="text-[10px] text-slate-400 font-medium uppercase flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Zimelipwa
                </div>
                <div className="text-sm font-bold font-mono text-slate-300 mt-0.5">
                  {formatCurrency(summary.weDemand.paidAmount, settings.currencySymbol)}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {summary.weDemand.paidCount}
                </div>
              </div>
            </div>
          </div>

          {/* WANATUDAI */}
          <div className="bg-slate-900/80 border border-amber-500/30 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <ArrowUpRight className="w-4 h-4" />
                <span>Wanatudai</span>
              </div>
              <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-mono font-bold">
                {summary.theyDemand.totalCount}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-2.5">
                <div className="text-[10px] text-slate-400 font-medium uppercase">
                  Wanachotudai
                </div>
                <div className="text-sm font-bold font-mono text-amber-400 mt-0.5">
                  {formatCurrency(summary.theyDemand.totalOutstanding, settings.currencySymbol)}
                </div>
              </div>
              <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-2.5">
                <div className="text-[10px] text-amber-400 font-medium uppercase flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Leo
                </div>
                <div className="text-sm font-bold font-mono text-amber-300 mt-0.5">
                  {formatCurrency(summary.theyDemand.dueTodayAmount, settings.currencySymbol)}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {summary.theyDemand.dueTodayCount} watoa huduma
                </div>
              </div>
              <div className="bg-slate-950/80 border border-rose-900/40 rounded-lg p-2.5 bg-rose-950/10">
                <div className="text-[10px] text-rose-400 font-medium uppercase flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Zimechelewa
                </div>
                <div className="text-sm font-bold font-mono text-rose-400 mt-0.5">
                  {formatCurrency(summary.theyDemand.overdueAmount, settings.currencySymbol)}
                </div>
                <div className="text-[10px] text-rose-300/70 mt-0.5">
                  {summary.theyDemand.overdueCount}
                </div>
              </div>
              <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-2.5">
                <div className="text-[10px] text-slate-400 font-medium uppercase flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Tumeshalipa
                </div>
                <div className="text-sm font-bold font-mono text-slate-300 mt-0.5">
                  {formatCurrency(summary.theyDemand.paidAmount, settings.currencySymbol)}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {summary.theyDemand.paidCount}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FILTER BAR */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 space-y-3">
          {/* Type Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-lg border border-slate-800 text-xs overflow-x-auto">
            <button
              onClick={() => setActiveTypeTab('ALL')}
              className={`px-3 py-1.5 rounded-md font-medium transition whitespace-nowrap ${
                activeTypeTab === 'ALL'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Zote ({debts.length})
            </button>
            <button
              onClick={() => setActiveTypeTab('WE_DEMAND')}
              className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition whitespace-nowrap ${
                activeTypeTab === 'WE_DEMAND'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-emerald-400 hover:bg-slate-900'
              }`}
            >
              <ArrowDownLeft className="w-3.5 h-3.5" />
              Tunadai ({summary.weDemand.totalCount})
            </button>
            <button
              onClick={() => setActiveTypeTab('THEY_DEMAND')}
              className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition whitespace-nowrap ${
                activeTypeTab === 'THEY_DEMAND'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-amber-400 hover:bg-slate-900'
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              Wanatudai ({summary.theyDemand.totalCount})
            </button>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 flex items-center gap-1 shrink-0">
              <Filter className="w-3.5 h-3.5" /> Hali:
            </span>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="flex-1 bg-slate-950 text-xs text-white px-2.5 py-1.5 rounded-lg border border-slate-800 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">Hali Zote</option>
              <option value="PENDING">Inasubiri</option>
              <option value="PARTIALLY_PAID">Imelipwa Sehemu</option>
              <option value="DUE_TODAY">Inatakiwa Leo</option>
              <option value="OVERDUE">Imechelewa</option>
              <option value="PAID">Imelipwa Kamili</option>
            </select>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Tafuta jina, bidhaa, simu..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 text-xs text-white pl-9 pr-3 py-2 rounded-lg border border-slate-800 focus:outline-none focus:border-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-500 whitespace-nowrap">Kuanzia:</span>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full bg-slate-950 text-xs text-white px-2 py-1.5 rounded-lg border border-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-500 whitespace-nowrap">Mpaka:</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full bg-slate-950 text-xs text-white px-2 py-1.5 rounded-lg border border-slate-800 focus:outline-none focus:border-blue-500"
              />
              {(startDate || endDate) && (
                <button
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                  }}
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 shrink-0"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            ACTIVE DEBTS SECTION
        ═══════════════════════════════════════════════════════ */}
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded-md bg-amber-500/10 border border-amber-500/20">
                <CircleDot className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <h2 className="text-xs font-bold text-white">Madeni Yanayoendelea</h2>
              <span className="px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                {activeDebts.length}
              </span>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            {activeDebts.length === 0 ? (
              <div className="py-10 text-center text-slate-500">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-30 text-emerald-500" />
                <div className="font-medium text-slate-400 text-xs">
                  Hakuna madeni yanayoendelea 🎉
                </div>
              </div>
            ) : (
              <>
                <div className="divide-y divide-slate-800/80">
                  {visibleActive.map(renderDebtCard)}
                </div>

                {activeDebts.length > PAGE_SIZE && (
                  <div className="p-3 bg-slate-950/40 border-t border-slate-800/80 space-y-2">
                    <div className="text-[10px] text-slate-500 text-center">
                      Showing{' '}
                      <span className="text-slate-300 font-semibold">
                        {Math.min(activeVisible, activeDebts.length)}
                      </span>{' '}
                      of{' '}
                      <span className="text-slate-300 font-semibold">
                        {activeDebts.length}
                      </span>{' '}
                      active debts
                    </div>
                    <div className="flex items-center gap-2">
                      {activeVisible > PAGE_SIZE && (
                        <button
                          onClick={handleSeeLessActive}
                          className="flex-1 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-300 text-[11px] font-semibold transition"
                        >
                          Show Less
                        </button>
                      )}
                      {hasMoreActive && (
                        <button
                          onClick={handleSeeMoreActive}
                          disabled={loadingActive}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white text-[11px] font-semibold shadow transition disabled:opacity-60 disabled:cursor-wait"
                        >
                          {loadingActive ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Loading...</span>
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3.5 h-3.5" />
                              <span>
                                See More ({Math.min(PAGE_SIZE, remainingActive)})
                              </span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            COMPLETED DEBTS SECTION
        ═══════════════════════════════════════════════════════ */}
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                <Archive className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <h2 className="text-xs font-bold text-white">Yaliyokamilika (All Completed)</h2>
              <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                {completedDebts.length}
              </span>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            {completedDebts.length === 0 ? (
              <div className="py-10 text-center text-slate-500">
                <Archive className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <div className="font-medium text-slate-400 text-xs">
                  Hakuna madeni yaliyokamilika bado
                </div>
              </div>
            ) : (
              <>
                <div className="divide-y divide-slate-800/80">
                  {visibleCompleted.map(renderDebtCard)}
                </div>

                {completedDebts.length > PAGE_SIZE && (
                  <div className="p-3 bg-slate-950/40 border-t border-slate-800/80 space-y-2">
                    <div className="text-[10px] text-slate-500 text-center">
                      Showing{' '}
                      <span className="text-slate-300 font-semibold">
                        {Math.min(completedVisible, completedDebts.length)}
                      </span>{' '}
                      of{' '}
                      <span className="text-slate-300 font-semibold">
                        {completedDebts.length}
                      </span>{' '}
                      completed debts
                    </div>
                    <div className="flex items-center gap-2">
                      {completedVisible > PAGE_SIZE && (
                        <button
                          onClick={handleSeeLessCompleted}
                          className="flex-1 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-300 text-[11px] font-semibold transition"
                        >
                          Show Less
                        </button>
                      )}
                      {hasMoreCompleted && (
                        <button
                          onClick={handleSeeMoreCompleted}
                          disabled={loadingCompleted}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-[11px] font-semibold shadow transition disabled:opacity-60 disabled:cursor-wait"
                        >
                          {loadingCompleted ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Loading...</span>
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3.5 h-3.5" />
                              <span>
                                See More ({Math.min(PAGE_SIZE, remainingCompleted)})
                              </span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ─── MODALS (unchanged) ─────────────────────────────── */}

      {/* CREATE / EDIT DEBT MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-xs sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[95vh] overflow-y-auto">
            <div className="p-4 bg-slate-850 border-b border-slate-800 flex items-center justify-between sticky top-0 z-10">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                <span>
                  {editingDebt
                    ? 'Hariri Deni'
                    : formType === 'WE_DEMAND'
                    ? 'Deni Jipya (Tunadai)'
                    : 'Deni Jipya (Wanatudai)'}
                </span>
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveDebt} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Aina ya Deni <span className="text-rose-400">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormType('WE_DEMAND')}
                    className={`py-2.5 px-3 rounded-lg border text-[11px] font-semibold flex items-center justify-center gap-1.5 transition ${
                      formType === 'WE_DEMAND'
                        ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Tunadai</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormType('THEY_DEMAND')}
                    className={`py-2.5 px-3 rounded-lg border text-[11px] font-semibold flex items-center justify-center gap-1.5 transition ${
                      formType === 'THEY_DEMAND'
                        ? 'bg-amber-600/20 border-amber-500 text-amber-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <ArrowUpRight className="w-3.5 h-3.5 text-amber-400" />
                    <span>Wanatudai</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Jina <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder={
                    formType === 'WE_DEMAND'
                      ? 'Mfano: Juma, Mama Amina...'
                      : 'Mfano: ABC Supplier...'
                  }
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  className="w-full bg-slate-950 text-xs text-white px-3 py-2.5 rounded-lg border border-slate-800 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Bidhaa / Maelezo
                </label>
                <input
                  type="text"
                  placeholder="Mfano: Daftari, Simenti..."
                  value={formProduct}
                  onChange={e => setFormProduct(e.target.value)}
                  className="w-full bg-slate-950 text-xs text-white px-3 py-2.5 rounded-lg border border-slate-800 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Jumla ya Deni (TSh) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="any"
                    inputMode="decimal"
                    placeholder="10000"
                    value={formAmount}
                    onChange={e => setFormAmount(e.target.value)}
                    className="w-full bg-slate-950 text-sm font-mono font-bold text-emerald-400 px-3 py-2.5 rounded-lg border border-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Siku ya Kulipa
                  </label>
                  <input
                    type="date"
                    value={formDueDate}
                    onChange={e => setFormDueDate(e.target.value)}
                    className="w-full bg-slate-950 text-xs text-white px-3 py-2.5 rounded-lg border border-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Namba ya Simu
                </label>
                <input
                  type="tel"
                  inputMode="tel"
                  placeholder="0712345678"
                  value={formContact}
                  onChange={e => setFormContact(e.target.value)}
                  className="w-full bg-slate-950 text-xs font-mono text-white px-3 py-2.5 rounded-lg border border-slate-800 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Maelezo ya Ziada (Hiari)
                </label>
                <textarea
                  rows={2}
                  placeholder="Maelezo mengine..."
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  className="w-full bg-slate-950 text-xs text-white px-3 py-2.5 rounded-lg border border-slate-800 focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  Ghairi
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2.5 rounded-lg text-white text-xs font-semibold shadow-sm transition ${
                    formType === 'WE_DEMAND'
                      ? 'bg-emerald-600 hover:bg-emerald-500'
                      : 'bg-amber-600 hover:bg-amber-500'
                  }`}
                >
                  {editingDebt ? 'Hifadhi' : 'Hifadhi Deni'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PAYMENT MODAL */}
      {payingDebt &&
        (() => {
          const totalDebt = payingDebt.amount;
          const currentPaid =
            payingDebt.paidAmount || (payingDebt.status === 'PAID' ? totalDebt : 0);
          const currentRemaining =
            payingDebt.remainingAmount !== undefined
              ? payingDebt.remainingAmount
              : Math.max(0, totalDebt - currentPaid);
          const typedPayAmt = parseFloat(paymentAmountInput) || 0;
          const calculatedRemainder = Math.max(0, currentRemaining - typedPayAmt);
          const isPayingFull =
            calculatedRemainder <= 0 && typedPayAmt >= currentRemaining;

          return (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-xs sm:p-4 overflow-y-auto">
              <div className="bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto max-h-[95vh] overflow-y-auto">
                <div
                  className={`p-4 border-b flex items-center justify-between sticky top-0 z-10 ${
                    payingDebt.type === 'WE_DEMAND'
                      ? 'bg-emerald-950/60 border-emerald-800/60 text-emerald-300'
                      : 'bg-amber-950/60 border-amber-800/60 text-amber-300'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="p-1.5 rounded-lg bg-black/40 shrink-0">
                      <DollarSign className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-xs text-white truncate">
                        {payingDebt.type === 'WE_DEMAND'
                          ? 'Pokea Malipo'
                          : 'Lipa Deni'}
                      </h3>
                      <p className="text-[10px] text-slate-300">
                        Kiasi chote au sehemu
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setPayingDebt(null)}
                    className="text-slate-400 hover:text-white p-1 rounded-lg shrink-0"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleConfirmPayment} className="p-4 space-y-4 text-xs">
                  <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-[11px]">Jina:</span>
                      <span className="font-bold text-white text-sm truncate max-w-[60%]">
                        {payingDebt.debtorName}
                      </span>
                    </div>
                    {payingDebt.productDescription && (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 text-[11px]">Bidhaa:</span>
                        <span className="text-slate-300 text-xs truncate max-w-[60%]">
                          {payingDebt.productDescription}
                        </span>
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 text-center">
                      <div className="p-2 rounded bg-slate-900 border border-slate-800">
                        <div className="text-[9px] text-slate-400 uppercase">Jumla</div>
                        <div className="font-mono font-bold text-white text-[11px] mt-0.5 truncate">
                          {formatCurrency(totalDebt, settings.currencySymbol)}
                        </div>
                      </div>
                      <div className="p-2 rounded bg-slate-900 border border-slate-800">
                        <div className="text-[9px] text-slate-400 uppercase">Zilizolipwa</div>
                        <div className="font-mono font-bold text-emerald-400 text-[11px] mt-0.5 truncate">
                          {formatCurrency(currentPaid, settings.currencySymbol)}
                        </div>
                      </div>
                      <div className="p-2 rounded bg-slate-900 border border-emerald-500/30">
                        <div className="text-[9px] text-amber-400 uppercase font-semibold">
                          Baki
                        </div>
                        <div className="font-mono font-extrabold text-amber-300 text-xs mt-0.5 truncate">
                          {formatCurrency(currentRemaining, settings.currencySymbol)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5 gap-2 flex-wrap">
                      <label className="block text-xs font-bold text-slate-200">
                        Kiasi Kinacholipwa *
                      </label>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setPaymentAmountInput(currentRemaining.toString())}
                          className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[10px] font-bold border border-emerald-500/40"
                        >
                          Lipa Yote
                        </button>
                        {currentRemaining > 100 && (
                          <button
                            type="button"
                            onClick={() =>
                              setPaymentAmountInput(Math.floor(currentRemaining / 2).toString())
                            }
                            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold"
                          >
                            50%
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="relative">
                      <span className="absolute left-3.5 top-2.5 font-mono font-bold text-emerald-400 text-sm">
                        {settings.currencySymbol}
                      </span>
                      <input
                        type="number"
                        required
                        min="1"
                        max={currentRemaining}
                        step="any"
                        inputMode="decimal"
                        placeholder="Weka kiasi..."
                        value={paymentAmountInput}
                        onChange={e => setPaymentAmountInput(e.target.value)}
                        className="w-full bg-slate-950 text-base font-mono font-extrabold text-white pl-10 pr-3 py-2.5 rounded-xl border-2 border-emerald-500/50 focus:outline-none focus:border-emerald-400"
                      />
                    </div>
                  </div>

                  <div
                    className={`p-3 rounded-xl border flex items-center justify-between ${
                      isPayingFull
                        ? 'bg-emerald-950/40 border-emerald-600/40'
                        : 'bg-blue-950/40 border-blue-600/40'
                    }`}
                  >
                    <div>
                      <span className="text-[10px] block text-slate-400">
                        Salio baada ya malipo:
                      </span>
                      <span className="font-mono text-sm font-extrabold text-white">
                        {formatCurrency(calculatedRemainder, settings.currencySymbol)}
                      </span>
                    </div>

                    <span
                      className={`px-2 py-1 rounded-full text-[9px] font-bold uppercase ${
                        isPayingFull
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      }`}
                    >
                      {isPayingFull ? '✓ Kamili' : '⏱ Sehemu'}
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Njia ya Malipo
                      </label>
                      <select
                        value={paymentMethod}
                        onChange={e => setPaymentMethod(e.target.value)}
                        className="w-full bg-slate-950 text-xs text-white px-3 py-2.5 rounded-lg border border-slate-800 focus:outline-none focus:border-emerald-500"
                      >
                        <option value="CASH">Taslimu (Cash)</option>
                        <option value="MOBILE_MONEY">Simu (M-Pesa / Tigo / Airtel)</option>
                        <option value="BANK">Benki</option>
                        <option value="OTHER">Nyingine</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Tarehe ya Malipo
                      </label>
                      <input
                        type="date"
                        value={paymentDate}
                        onChange={e => setPaymentDate(e.target.value)}
                        className="w-full bg-slate-950 text-xs text-white px-3 py-2.5 rounded-lg border border-slate-800 focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Maelezo (Hiari)
                      </label>
                      <input
                        type="text"
                        placeholder="Mfano: Awamu ya kwanza..."
                        value={paymentNote}
                        onChange={e => setPaymentNote(e.target.value)}
                        className="w-full bg-slate-950 text-xs text-white px-3 py-2.5 rounded-lg border border-slate-800 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  {payingDebt.payments && payingDebt.payments.length > 0 && (
                    <div className="pt-2 border-t border-slate-800">
                      <div className="text-[10px] font-semibold text-slate-400 mb-1.5 flex items-center gap-1">
                        <History className="w-3 h-3 text-blue-400" />
                        <span>Awamu zilizolipwa kabla:</span>
                      </div>
                      <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                        {payingDebt.payments.map((p, idx) => (
                          <div
                            key={p.id || idx}
                            className="flex justify-between items-center p-1.5 rounded bg-slate-950 border border-slate-800 text-[10px]"
                          >
                            <div className="min-w-0 truncate">
                              <span className="font-mono text-slate-400">{p.paymentDate}</span>
                              <span className="text-slate-500 ml-1">({p.paymentMethod})</span>
                            </div>
                            <span className="font-mono font-bold text-emerald-400 shrink-0 ml-2">
                              +{formatCurrency(p.amount, settings.currencySymbol)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setPayingDebt(null)}
                      className="px-4 py-2.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
                    >
                      Ghairi
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition flex items-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        Hifadhi ({formatCurrency(typedPayAmt || 0, settings.currencySymbol)})
                      </span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          );
        })()}

      {/* PAYMENT HISTORY MODAL */}
      {viewingHistoryDebt && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-xs sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 max-h-[95vh] overflow-y-auto">
            <div className="p-4 bg-slate-850 border-b border-slate-800 flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-2 text-blue-400 font-bold text-sm min-w-0">
                <History className="w-5 h-5 shrink-0" />
                <span className="truncate">Historia: {viewingHistoryDebt.debtorName}</span>
              </div>
              <button
                onClick={() => setViewingHistoryDebt(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4 text-xs">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-[10px] text-slate-400">Jumla</div>
                  <div className="text-xs font-bold font-mono text-white mt-0.5 truncate">
                    {formatCurrency(viewingHistoryDebt.amount, settings.currencySymbol)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">Zilizolipwa</div>
                  <div className="text-xs font-bold font-mono text-emerald-400 mt-0.5 truncate">
                    {formatCurrency(viewingHistoryDebt.paidAmount || 0, settings.currencySymbol)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">Baki</div>
                  <div className="text-xs font-bold font-mono text-amber-400 mt-0.5 truncate">
                    {formatCurrency(
                      viewingHistoryDebt.remainingAmount !== undefined
                        ? viewingHistoryDebt.remainingAmount
                        : viewingHistoryDebt.status === 'PAID'
                        ? 0
                        : viewingHistoryDebt.amount,
                      settings.currencySymbol
                    )}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-300 mb-2 text-xs">
                  Awamu za Malipo
                </h4>
                {!viewingHistoryDebt.payments || viewingHistoryDebt.payments.length === 0 ? (
                  <div className="p-6 text-center text-slate-500 bg-slate-950 rounded-lg border border-slate-800 text-xs">
                    Hakuna malipo yaliyorekodiwa bado.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {viewingHistoryDebt.payments.map((payment, idx) => (
                      <div
                        key={payment.id || idx}
                        className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[11px] text-slate-400">
                            {payment.paymentDate}
                          </span>
                          <span className="font-mono font-bold text-emerald-400 text-sm">
                            +{formatCurrency(payment.amount, settings.currencySymbol)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-500">
                          <span>Njia: {payment.paymentMethod}</span>
                          <span>
                            Baki baada:{' '}
                            {payment.remainingAfter !== undefined
                              ? formatCurrency(payment.remainingAfter, settings.currencySymbol)
                              : '—'}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Mpokeaji: {payment.paidByName || 'Cashier'}
                        </div>
                        {payment.notes && (
                          <div className="text-[10px] text-slate-400 italic pt-1 border-t border-slate-800/80">
                            {payment.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setViewingHistoryDebt(null)}
                  className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs transition"
                >
                  Funga
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingDebt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5">
              <div className="flex items-center gap-3 mb-3 text-rose-400">
                <AlertTriangle className="w-6 h-6 shrink-0" />
                <h3 className="font-bold text-sm text-white">
                  Futa Deni la "{deletingDebt.debtorName}"?
                </h3>
              </div>

              <p className="text-xs text-slate-300 mb-4">
                Una uhakika unataka kufuta rekodi hii ya deni la{' '}
                {formatCurrency(deletingDebt.amount, settings.currencySymbol)} (
                {deletingDebt.productDescription || 'bidhaa'})?
              </p>

              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setDeletingDebt(null)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  Ghairi
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-sm transition"
                >
                  Futa Deni
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
