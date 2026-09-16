import React, { useState } from 'react';
import {
  Truck,
  Plus,
  Trash2,
  Search,
  X,
  Pencil,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PurchaseService } from '../../services/purchaseService';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import type { Purchase } from '../../types';

interface PurchaseItemInput {
  productId: string;
  quantity: number | string;
  unitCost: number | string;
}

export const AdminPurchases: React.FC = () => {
  const { currentUser, dbState, addToast, selectedShopId, currentShop } = useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [purchaseShopId, setPurchaseShopId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'PAID' | 'PARTIAL' | 'UNPAID'>('PAID');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<PurchaseItemInput[]>([]);
  const [formError, setFormError] = useState('');

  if (!currentUser) return null;

  // Both Admin and Seller can always record purchases (no permission required)
  const canRecordPurchase = true;

  const settings = dbState.settings;
  const isSeller = currentUser.role === 'SELLER';

  const availableShops = dbState.shops.filter(s => {
    if (currentUser.role === 'ADMIN') return true;
    const assigned = currentUser.assignedShopIds || [];
    return assigned.length === 0 || assigned.includes(s.id);
  });

  const activeShopId =
    purchaseShopId ||
    currentShop?.id ||
    (selectedShopId !== 'ALL' ? selectedShopId : '') ||
    availableShops[0]?.id ||
    '';

  const shopProducts = dbState.products.filter(
    p => !purchaseShopId || purchaseShopId === 'ALL' || p.shopId === purchaseShopId
  );

  // Purchases with local enhanced search (supplier, PO#, invoice#, products, shop)
  const purchases = PurchaseService.getPurchases(
    {
      shopId: isSeller
        ? currentShop?.id || selectedShopId
        : selectedShopId === 'ALL'
        ? undefined
        : selectedShopId,
    },
    currentUser
  ).filter(purchase => {
    if (!searchQuery.trim()) return true;

    const q = searchQuery.trim().toLowerCase();

    if (purchase.supplierName.toLowerCase().includes(q)) return true;
    if (purchase.purchaseNumber.toLowerCase().includes(q)) return true;
    if (purchase.invoiceNumber && purchase.invoiceNumber.toLowerCase().includes(q)) return true;
    if (
      (purchase.items || []).some(
        item =>
          item.productName.toLowerCase().includes(q) ||
          item.productId.toLowerCase().includes(q)
      )
    )
      return true;
    if (purchase.shopName && purchase.shopName.toLowerCase().includes(q)) return true;

    return false;
  });

  const openNewPurchaseModal = () => {
    const targetShop =
      currentShop?.id ||
      (selectedShopId !== 'ALL' ? selectedShopId : availableShops[0]?.id) ||
      '';
    setPurchaseShopId(targetShop);
    setSupplierName('');
    setInvoiceNumber('');
    setPaymentStatus('PAID');
    setNotes('');
    setIsEditMode(false);
    setEditingPurchase(null);

    const prodList = dbState.products.filter(p => p.shopId === targetShop);
    const initialProd = prodList[0] || dbState.products[0];

    setItems([
      {
        productId: initialProd?.id || '',
        quantity: '',
        unitCost: initialProd?.purchasePrice ? initialProd.purchasePrice.toString() : '',
      },
    ]);
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditPurchase = (purchase: Purchase) => {
    setEditingPurchase(purchase);
    setIsEditMode(true);
    setPurchaseShopId(purchase.shopId);
    setSupplierName(purchase.supplierName);
    setInvoiceNumber(purchase.invoiceNumber || '');
    setPaymentStatus(purchase.paymentStatus);
    setNotes(purchase.notes || '');

    setItems(
      (purchase.items || []).map(item => ({
        productId: item.productId,
        quantity: item.quantity.toString(),
        unitCost: item.unitCost.toString(),
      }))
    );

    setFormError('');
    setIsModalOpen(true);
  };

  const addItemRow = () => {
    const prodList = dbState.products.filter(p => !purchaseShopId || p.shopId === purchaseShopId);
    const prod = prodList[0] || dbState.products[0];
    setItems(prev => [
      ...prev,
      {
        productId: prod?.id || '',
        quantity: '',
        unitCost: prod?.purchasePrice ? prod.purchasePrice.toString() : '',
      },
    ]);
  };

  const removeItemRow = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const updateItemRow = (idx: number, field: keyof PurchaseItemInput, value: any) => {
    setItems(prev =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        if (field === 'productId') {
          const matched = dbState.products.find(p => p.id === value);
          return {
            ...item,
            productId: value,
            unitCost:
              matched?.purchasePrice !== undefined && matched?.purchasePrice !== null
                ? matched.purchasePrice.toString()
                : '',
          };
        }
        return { ...item, [field]: value };
      })
    );
  };

  const calculatedTotal = items.reduce((sum, item) => {
    const qty = parseFloat(item.quantity as string) || 0;
    const cost = parseFloat(item.unitCost as string) || 0;
    return sum + qty * cost;
  }, 0);

  const handleSavePurchase = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (items.length === 0) {
      setFormError('Please add at least one line item.');
      return;
    }

    const finalItems = items.map(item => ({
      productId: item.productId,
      quantity: parseFloat(item.quantity as string) || 0,
      unitCost: parseFloat(item.unitCost as string) || 0,
    }));

    for (const item of finalItems) {
      if (item.quantity <= 0) {
        setFormError('Quantity must be greater than 0 for all items.');
        return;
      }
      if (item.unitCost <= 0) {
        setFormError('Unit cost must be greater than 0 for all items.');
        return;
      }
      if (!item.productId) {
        setFormError('Please select a product for all items.');
        return;
      }
    }

    const finalSupplierName = supplierName.trim() || 'Walk-in Supplier';

    if (editingPurchase) {
      const res = PurchaseService.updatePurchase(
        editingPurchase.id,
        {
          supplierName: finalSupplierName,
          invoiceNumber: invoiceNumber.trim() || undefined,
          paymentStatus,
          notes,
          items: finalItems,
        },
        currentUser
      );

      if (res.success) {
        addToast({
          type: 'success',
          title: 'Purchase Updated',
          description: `Purchase ${
            editingPurchase.purchaseNumber || editingPurchase.id
          } updated. Stock recalculated.`,
        });
        setIsModalOpen(false);
        setEditingPurchase(null);
        setIsEditMode(false);
      } else {
        setFormError(res.error || 'Failed to update purchase.');
      }
    } else {
      const res = PurchaseService.createPurchase(
        {
          shopId: purchaseShopId || availableShops[0]?.id || '',
          supplierName: finalSupplierName,
          invoiceNumber: invoiceNumber.trim() || undefined,
          items: finalItems,
          paymentStatus,
          notes,
        },
        currentUser
      );

      if (res.success) {
        addToast({
          type: 'success',
          title: 'Purchase Recorded & Stock Ingested',
          description: `Order from ${finalSupplierName} recorded. Product inventories were automatically restocked.`,
        });
        setIsModalOpen(false);
      } else {
        setFormError(res.error || 'Failed to record purchase.');
      }
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingPurchase(null);
    setIsEditMode(false);
  };

  return (
    <div
      id="admin-purchases-view"
      className="flex-1 p-3.5 sm:p-6 bg-slate-950 text-slate-100 overflow-y-auto pb-24 sm:pb-6"
    >
      {/* Header */}
      <div className="flex flex-col gap-3 mb-5 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
            Supplier Purchases
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Log procurement orders, record cost of goods, and automatically increase inventory
          </p>
        </div>

        {canRecordPurchase && (
          <button
            id="new-purchase-btn"
            onClick={openNewPurchaseModal}
            className="flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold text-xs shadow-lg transition"
          >
            <Plus className="w-4 h-4" />
            <span>Record Purchase</span>
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 mb-4 space-y-2.5 text-xs">
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search supplier, product, invoice #..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="text-slate-400 font-medium text-right">
          Total: <span className="text-white font-bold">{purchases.length}</span>
        </div>
      </div>

      {/* Purchases: Cards + Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {purchases.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <Truck className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-xs">No supplier purchases recorded yet.</p>
          </div>
        ) : (
          <>
            {/* Mobile Cards (< md) */}
            <div className="md:hidden divide-y divide-slate-800/80">
              {purchases.map(purchase => (
                <div key={purchase.id} className="p-3.5 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-xs text-white truncate">
                        {purchase.supplierName}
                      </h4>
                      <p className="text-[10px] font-mono text-slate-400">
                        {formatDateTime(purchase.createdAt)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono font-bold text-white text-sm">
                        {formatCurrency(purchase.totalAmount, settings.currencySymbol)}
                      </div>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[9px] font-bold inline-block mt-0.5 ${
                          purchase.paymentStatus === 'PAID'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {purchase.paymentStatus}
                      </span>
                    </div>
                  </div>

                  <div className="text-xs text-slate-300 bg-slate-950/60 p-2 rounded-lg border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-medium">
                        {(purchase.items || []).length} items received
                      </span>
                      {purchase.invoiceNumber && (
                        <span className="font-mono text-slate-400">
                          Inv: {purchase.invoiceNumber}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 truncate">
                      {(purchase.items || [])
                        .map(i => `${i.quantity}x ${i.productName}`)
                        .join(', ')}
                    </p>
                  </div>

                  {canRecordPurchase && (
                    <div className="flex items-center gap-2 pt-1.5 border-t border-slate-800/60">
                      <button
                        onClick={() => openEditPurchase(purchase)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-slate-800 hover:bg-blue-600 active:bg-blue-700 text-slate-300 hover:text-white transition text-[11px] font-semibold"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Edit / Correct
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Tablet / Desktop Table (md+) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400">
                    <th className="py-3 px-4 font-semibold">Date</th>
                    <th className="py-3 px-4 font-semibold">Supplier</th>
                    <th className="py-3 px-4 font-semibold">Invoice #</th>
                    <th className="py-3 px-4 font-semibold">Items</th>
                    <th className="py-3 px-4 font-semibold">Payment</th>
                    <th className="py-3 px-4 text-right font-semibold">Total</th>
                    {canRecordPurchase && (
                      <th className="py-3 px-4 text-right font-semibold">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {purchases.map(purchase => (
                    <tr key={purchase.id} className="hover:bg-slate-850/60 transition">
                      <td className="py-3.5 px-4 text-slate-400 font-mono">
                        {formatDateTime(purchase.createdAt)}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-white">
                        {purchase.supplierName}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-400">
                        {purchase.invoiceNumber || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-300">
                        <div>{(purchase.items || []).length} items</div>
                        <div className="text-[10px] text-slate-500 truncate max-w-xs">
                          {(purchase.items || [])
                            .map(i => `${i.quantity}x ${i.productName}`)
                            .join(', ')}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            purchase.paymentStatus === 'PAID'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {purchase.paymentStatus}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-white text-sm">
                        {formatCurrency(purchase.totalAmount, settings.currencySymbol)}
                      </td>
                      {canRecordPurchase && (
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <button
                            onClick={() => openEditPurchase(purchase)}
                            className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium transition inline-flex items-center gap-1"
                          >
                            <Pencil className="w-3 h-3" />
                            Edit
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Modal: New / Edit Purchase */}
      {isModalOpen && canRecordPurchase && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/80 backdrop-blur-sm sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-t-2xl sm:rounded-2xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl max-h-[95vh] overflow-y-auto my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2 min-w-0">
                {isEditMode ? (
                  <Pencil className="w-5 h-5 text-amber-400 shrink-0" />
                ) : (
                  <Truck className="w-5 h-5 text-blue-400 shrink-0" />
                )}
                <h3 className="text-sm sm:text-base font-bold text-white truncate">
                  {editingPurchase ? 'Edit Purchase' : 'Record Stock In'}
                </h3>
              </div>
              <button
                onClick={closeModal}
                className="text-slate-400 hover:text-white p-1 shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleSavePurchase} className="space-y-4 text-xs">
              {!isEditMode && (
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Target Shop / Unit *
                  </label>
                  <select
                    value={purchaseShopId}
                    onChange={e => setPurchaseShopId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {availableShops.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code || 'UNIT'})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Supplier / Vendor (Optional)
                  </label>
                  <input
                    type="text"
                    value={supplierName}
                    onChange={e => setSupplierName(e.target.value)}
                    placeholder="Leave blank for 'Walk-in Supplier'"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Vendor Invoice # (Optional)
                  </label>
                  <input
                    type="text"
                    value={invoiceNumber}
                    onChange={e => setInvoiceNumber(e.target.value)}
                    placeholder="e.g. INV-98442"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-white font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Line Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-slate-300 font-semibold uppercase tracking-wider text-[11px]">
                    {isEditMode ? 'Correct Items' : 'Received Items'}
                  </label>
                  <button
                    type="button"
                    onClick={addItemRow}
                    className="flex items-center gap-1 text-blue-400 hover:text-blue-300 font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                {isEditMode && (
                  <div className="mb-2 p-2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px]">
                    ⚠️ Changing quantities recalculates stock. Old quantities will be reversed and
                    new ones applied.
                  </div>
                )}

                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {items.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2"
                    >
                      {/* Product select */}
                      <select
                        value={item.productId}
                        onChange={e => updateItemRow(idx, 'productId', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-2 text-white text-xs"
                      >
                        {(shopProducts.length > 0 ? shopProducts : dbState.products).map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.sku}) — Stock: {p.currentStock} {p.unit}
                          </option>
                        ))}
                      </select>

                      {/* Qty + Cost row */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <label className="block text-slate-500 text-[10px] mb-0.5">Qty</label>
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            value={item.quantity}
                            onChange={e => updateItemRow(idx, 'quantity', e.target.value)}
                            placeholder="0"
                            className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-2 text-white font-mono text-xs text-center"
                          />
                        </div>

                        <div className="flex-1">
                          <label className="block text-slate-500 text-[10px] mb-0.5">
                            Unit Cost ({settings.currencySymbol})
                          </label>
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0"
                            value={item.unitCost}
                            onChange={e => updateItemRow(idx, 'unitCost', e.target.value)}
                            placeholder="0"
                            className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-2 text-white font-mono text-xs"
                          />
                        </div>

                        <div className="flex flex-col items-end justify-end pb-1 min-w-[70px]">
                          <label className="text-slate-500 text-[10px] mb-0.5">Subtotal</label>
                          <div className="font-mono font-bold text-white text-xs truncate">
                            {formatCurrency(
                              (parseFloat(item.quantity as string) || 0) *
                                (parseFloat(item.unitCost as string) || 0),
                              settings.currencySymbol
                            )}
                          </div>
                        </div>

                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItemRow(idx)}
                            className="mt-3 text-slate-500 hover:text-rose-400 p-1.5"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Payment Status</label>
                  <select
                    value={paymentStatus}
                    onChange={e => setPaymentStatus(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="PAID">Paid in Full</option>
                    <option value="PARTIAL">Partially Paid</option>
                    <option value="UNPAID">Pending / On Credit</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Notes</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="e.g. Delivered by freight truck"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Total + Actions */}
              <div className="pt-3 border-t border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Total Cost:</span>
                  <span className="text-base font-bold font-mono text-white">
                    {formatCurrency(calculatedTotal, settings.currencySymbol)}
                  </span>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow transition"
                  >
                    {editingPurchase ? 'Update & Recalculate' : 'Record & Ingest'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
