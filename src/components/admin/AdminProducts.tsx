import React, { useState } from 'react';
import {
  Search,
  Plus,
  Package,
  Edit,
  Power,
  X,
  AlertCircle,
  FolderTree,
  Tag,
  Store,
  Check,
  Trash2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ProductService } from '../../services/productService';
import { CategoryService } from '../../services/categoryService';
import { Product, Category, ProductImage } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { ProductThumbnail } from '../common/ProductThumbnail';
import { ProductImageViewerModal } from '../common/ProductImageViewerModal';
import { ProductImageUpload } from '../common/ProductImageUpload';

export const AdminProducts: React.FC = () => {
  const { currentUser, dbState, addToast, selectedShopId } = useApp();
  const [activeSubTab, setActiveSubTab] = useState<'products' | 'categories'>('products');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [shopFilter, setShopFilter] = useState('ALL');
  const [categoryShopFilter, setCategoryShopFilter] = useState('ALL');

  // Add / Edit Product Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);

  // Product Form Fields
  const [productShopId, setProductShopId] = useState('');
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [currentStock, setCurrentStock] = useState('0');
  const [minStock, setMinStock] = useState('5');
  const [unit, setUnit] = useState('pcs');
  const [productImages, setProductImages] = useState<ProductImage[]>([]);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Image Viewer
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  // Category Modal
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [catShopIdInput, setCatShopIdInput] = useState('');
  const [catNameInput, setCatNameInput] = useState('');
  const [catColorInput, setCatColorInput] = useState('#3b82f6');
  const [catModalError, setCatModalError] = useState('');

  // Permission check: Admin OR Seller with canEditProducts/canDeleteProducts
  if (!currentUser) return null;
  if (
    currentUser.role !== 'ADMIN' &&
    !currentUser.permissions?.canEditProducts &&
    !currentUser.permissions?.canDeleteProducts
  )
    return null;

  const settings = dbState.settings;
  const categories = dbState.categories || [];
  const shops = dbState.shops || [];

  const availableFilterCategories =
    shopFilter === 'ALL' ? categories : categories.filter(c => c.shopId === shopFilter);

  // Pull products directly from dbState so it stays fresh
  const allProducts = dbState.products || [];

  const products = allProducts.filter(p => {
    if (shopFilter !== 'ALL' && p.shopId !== shopFilter) return false;
    if (categoryFilter !== 'ALL' && p.categoryId !== categoryFilter) return false;
    if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const openAddModal = () => {
    setEditingProduct(null);
    const initialShopId =
      selectedShopId && selectedShopId !== 'ALL' ? selectedShopId : shops[0]?.id || '';
    setProductShopId(initialShopId);
    setName('');
    setSku('');
    setBarcode('');
    const shopCats = categories.filter(c => c.shopId === initialShopId && c.status !== 'INACTIVE');
    setCategoryId(
      shopCats[0]?.id ||
        categories.find(c => c.status !== 'INACTIVE')?.id ||
        categories[0]?.id ||
        ''
    );
    setPurchasePrice('');
    setSellingPrice('');
    setCurrentStock('0');
    setMinStock('5');
    setUnit('pcs');
    setProductImages([]);
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    const pShopId = p.shopId || shops[0]?.id || '';
    setProductShopId(pShopId);
    setName(p.name);
    setSku(p.sku);
    setBarcode(p.barcode);
    setCategoryId(p.categoryId);
    setPurchasePrice(p.purchasePrice.toString());
    setSellingPrice(p.sellingPrice.toString());
    setCurrentStock(p.currentStock.toString());
    setMinStock(p.minStock.toString());
    setUnit(p.unit);
    setProductImages(p.images || []);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleProductShopChange = (newShopId: string) => {
    setProductShopId(newShopId);
    const shopCats = categories.filter(c => c.shopId === newShopId && c.status !== 'INACTIVE');
    if (shopCats.length > 0 && !shopCats.some(c => c.id === categoryId)) {
      setCategoryId(shopCats[0].id);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setIsSaving(true);

    if (!name.trim()) {
      setFormError('Product title is required.');
      setIsSaving(false);
      return;
    }

    if (!productShopId) {
      setFormError('Please select a shop/business unit for this product.');
      setIsSaving(false);
      return;
    }

    const sPrice = parseFloat(sellingPrice) || 0;
    const pPrice = parseFloat(purchasePrice) || 0;

    if (isNaN(sPrice) || sPrice < 0) {
      setFormError('Please enter a valid selling price.');
      setIsSaving(false);
      return;
    }

    try {
      let result;

      if (editingProduct) {
        result = await ProductService.updateProduct(
          editingProduct.id,
          {
            shopId: productShopId,
            name,
            sku: sku.trim(),
            barcode: barcode.trim(),
            categoryId,
            purchasePrice: pPrice,
            sellingPrice: sPrice,
            currentStock: parseInt(currentStock, 10) || 0,
            minStock: parseInt(minStock, 10) || 5,
            unit,
            images: productImages,
          },
          currentUser
        );
      } else {
        result = await ProductService.createProduct(
          {
            shopId: productShopId,
            name,
            sku: sku.trim() || undefined,
            barcode: barcode.trim() || undefined,
            categoryId,
            purchasePrice: pPrice,
            sellingPrice: sPrice,
            currentStock: parseInt(currentStock, 10) || 0,
            minStock: parseInt(minStock, 10) || 5,
            unit,
            images: productImages,
          },
          currentUser
        );
      }

      if (result.success) {
        addToast({
          type: 'success',
          title: editingProduct ? 'Product Updated' : 'Product Created',
          description: editingProduct
            ? `'${name}' details updated.`
            : `'${name}' added to inventory catalog.`,
        });
        setIsModalOpen(false);
      } else {
        setFormError(result.error || 'Failed to save product.');
      }
    } catch (error: any) {
      console.error('Save product error:', error);
      setFormError(error.message || 'An error occurred while saving product.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (p: Product) => {
    const newStatus = p.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const res = await ProductService.toggleProductStatus(p.id, newStatus, currentUser);
    if (res.success) {
      addToast({
        type: 'info',
        title: `Product ${newStatus === 'ACTIVE' ? 'Activated' : 'Deactivated'}`,
        description: `'${p.name}' is now ${newStatus}. Preserved in history.`,
      });
    }
  };

  const handleDeleteProduct = () => {
    if (!deletingProduct || !currentUser) return;

    const res = ProductService.deleteProduct(deletingProduct.id, currentUser);

    if (res.success) {
      addToast({
        type: 'success',
        title: 'Product Deleted',
        description: `'${deletingProduct.name}' has been permanently deleted.`,
      });
    } else {
      addToast({
        type: 'error',
        title: 'Delete Failed',
        description: res.error || 'Could not delete product.',
      });
    }
    setDeletingProduct(null);
  };

  // Category Actions
  const openAddCategoryModal = (targetShopId?: string) => {
    setEditingCategory(null);
    const defaultShop =
      targetShopId ||
      (selectedShopId && selectedShopId !== 'ALL' ? selectedShopId : shops[0]?.id || '');
    setCatShopIdInput(defaultShop);
    setCatNameInput('');
    setCatColorInput('#3b82f6');
    setCatModalError('');
    setIsCategoryModalOpen(true);
  };

  const openEditCategoryModal = (cat: Category) => {
    setEditingCategory(cat);
    setCatShopIdInput(cat.shopId || shops[0]?.id || '');
    setCatNameInput(cat.name);
    setCatColorInput(cat.color || '#3b82f6');
    setCatModalError('');
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    setCatModalError('');

    if (!catNameInput.trim()) {
      setCatModalError('Category name is required.');
      return;
    }

    if (!catShopIdInput) {
      setCatModalError('Please select a specific shop for this category.');
      return;
    }

    if (editingCategory) {
      const res = CategoryService.updateCategory(
        editingCategory.id,
        { name: catNameInput.trim(), shopId: catShopIdInput, color: catColorInput },
        currentUser
      );
      if (res.success) {
        addToast({
          type: 'success',
          title: 'Category Updated',
          description: `Category '${catNameInput}' updated.`,
        });
        setIsCategoryModalOpen(false);
      } else {
        setCatModalError(res.error || 'Failed to update category.');
      }
    } else {
      const res = CategoryService.createCategory(
        { name: catNameInput.trim(), shopId: catShopIdInput, color: catColorInput },
        currentUser
      );
      if (res.success) {
        addToast({
          type: 'success',
          title: 'Category Created',
          description: `New category '${catNameInput}' created.`,
        });
        setIsCategoryModalOpen(false);
      } else {
        setCatModalError(res.error || 'Failed to create category.');
      }
    }
  };

  const handleToggleCategoryStatus = (cat: Category) => {
    const res = CategoryService.toggleCategoryStatus(cat.id, currentUser);
    if (res.success) {
      addToast({
        type: 'info',
        title: 'Category Status Updated',
        description: `Category '${cat.name}' is now ${
          cat.status === 'INACTIVE' ? 'Active' : 'Inactive'
        }.`,
      });
    }
  };

  const canEdit = currentUser.permissions?.canEditProducts;
  const canDelete = currentUser.permissions?.canDeleteProducts;

  return (
    <div
      id="admin-products-view"
      className="flex-1 p-3.5 sm:p-6 bg-slate-950 text-slate-100 overflow-y-auto pb-24 sm:pb-6"
    >
      {/* Header */}
      <div className="flex flex-col gap-3 mb-5 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
            Products & Categories
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure catalog pricing, active/deactivated items, and product classification
          </p>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto">
          <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs">
            <button
              onClick={() => setActiveSubTab('products')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-semibold transition whitespace-nowrap ${
                activeSubTab === 'products'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Products</span>
            </button>
            <button
              onClick={() => setActiveSubTab('categories')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-semibold transition whitespace-nowrap ${
                activeSubTab === 'categories'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FolderTree className="w-3.5 h-3.5" />
              <span>Categories</span>
              <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] font-mono">
                {categories.length}
              </span>
            </button>
          </div>
        </div>

        {activeSubTab === 'products' ? (
          <button
            id="admin-add-product-btn"
            onClick={openAddModal}
            className="flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold text-xs shadow-lg transition"
          >
            <Plus className="w-4 h-4" />
            <span>New Product</span>
          </button>
        ) : (
          canEdit && (
            <button
              onClick={() => openAddCategoryModal()}
              className="flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold text-xs shadow-lg transition"
            >
              <Plus className="w-4 h-4" />
              <span>New Category</span>
            </button>
          )
        )}
      </div>

      {/* PRODUCTS TAB */}
      {activeSubTab === 'products' && (
        <>
          {/* Filters */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 mb-4 space-y-2.5 text-xs">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search name, SKU, or barcode..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <select
                value={shopFilter}
                onChange={e => setShopFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">All Shops</option>
                {shops.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Only</option>
                <option value="INACTIVE">Inactive Only</option>
              </select>
            </div>

            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">All Categories</option>
              {availableFilterCategories.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <div className="text-slate-400 font-medium text-right pt-1">
              Total: <span className="text-white font-bold">{products.length}</span>
            </div>
          </div>

          {/* Products list */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            {products.length === 0 ? (
              <div className="py-12 text-center text-slate-500">
                <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="font-medium text-slate-400">
                  No products match your criteria.
                  {shops.length === 0 ? ' Create a shop first!' : ''}
                </p>
              </div>
            ) : (
              <>
                {/* Mobile Cards (< md) */}
                <div className="md:hidden divide-y divide-slate-800/80">
                  {products.map(product => {
                    const cat = categories.find(c => c.id === product.categoryId);
                    const shop = shops.find(s => s.id === product.shopId);
                    const isLow = product.currentStock <= product.minStock;
                    const proposedPrice =
                      product.proposedSellingPrice || product.sellingPrice;
                    const marginPct =
                      proposedPrice > 0
                        ? (
                            ((proposedPrice - product.purchasePrice) / proposedPrice) *
                            100
                          ).toFixed(1)
                        : '0';

                    return (
                      <div
                        key={product.id}
                        className={`p-3.5 space-y-2.5 ${
                          product.status === 'INACTIVE'
                            ? 'opacity-55 bg-slate-950/40'
                            : ''
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <ProductThumbnail
                            product={product}
                            size="md"
                            onClick={() => {
                              setViewingProduct(product);
                              setIsViewerOpen(true);
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="font-bold text-xs text-white truncate">
                                {product.name}
                              </h4>
                              <span
                                className={`px-1.5 py-0.2 rounded text-[9px] font-bold shrink-0 ${
                                  product.status === 'ACTIVE'
                                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                                    : 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
                                }`}
                              >
                                {product.status}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 flex-wrap mt-1 text-[10px]">
                              <span className="px-1.5 py-0.2 rounded bg-blue-950 text-blue-300 border border-blue-800/50 font-medium">
                                {shop?.name || 'Main Shop'}
                              </span>
                              <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                                {cat?.name || 'General'}
                              </span>
                              {product.sku && (
                                <span className="font-mono text-slate-400">
                                  SKU: {product.sku}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center text-xs py-1">
                          <div className="bg-slate-950/60 p-1.5 rounded-lg border border-slate-800">
                            <div className="text-[9px] text-slate-400">Buying</div>
                            <div className="font-mono text-[11px] text-slate-400">
                              {formatCurrency(
                                product.purchasePrice,
                                settings.currencySymbol
                              )}
                            </div>
                          </div>
                          <div className="bg-slate-950/60 p-1.5 rounded-lg border border-slate-800">
                            <div className="text-[9px] text-slate-400">Selling</div>
                            <div className="font-mono text-[11px] font-bold text-white">
                              {formatCurrency(proposedPrice, settings.currencySymbol)}
                            </div>
                          </div>
                          <div className="bg-slate-950/60 p-1.5 rounded-lg border border-slate-800">
                            <div className="text-[9px] text-slate-400">Stock</div>
                            <div
                              className={`font-mono text-[11px] font-bold ${
                                product.currentStock <= 0
                                  ? 'text-rose-400'
                                  : isLow
                                  ? 'text-amber-300'
                                  : 'text-emerald-400'
                              }`}
                            >
                              {product.currentStock} {product.unit}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-xs">
                          <div className="text-[11px] text-emerald-400 font-mono">
                            Margin: <strong>{marginPct}%</strong>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {canEdit && (
                              <>
                                <button
                                  onClick={() => openEditModal(product)}
                                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 text-xs font-semibold flex items-center gap-1 transition"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                  <span>Edit</span>
                                </button>
                                <button
                                  onClick={() => handleToggleStatus(product)}
                                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
                                    product.status === 'ACTIVE'
                                      ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20'
                                      : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20'
                                  }`}
                                >
                                  <Power className="w-3.5 h-3.5" />
                                  <span>
                                    {product.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                                  </span>
                                </button>
                              </>
                            )}
                            {canDelete && (
                              <button
                                onClick={() => setDeletingProduct(product)}
                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 active:bg-rose-500/30 text-rose-400 transition"
                                title="Delete product"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Tablet / Desktop Table (md+) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400">
                        <th className="py-3 px-4 font-semibold">Product Name</th>
                        <th className="py-3 px-4 font-semibold">Shop</th>
                        <th className="py-3 px-4 font-semibold">SKU / Barcode</th>
                        <th className="py-3 px-4 font-semibold">Category</th>
                        <th className="py-3 px-4 text-right font-semibold">Purchase</th>
                        <th className="py-3 px-4 text-right font-semibold">Selling</th>
                        <th className="py-3 px-4 text-right font-semibold">Margin</th>
                        <th className="py-3 px-4 text-center font-semibold">Stock</th>
                        <th className="py-3 px-4 text-center font-semibold">Status</th>
                        <th className="py-3 px-4 text-right font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {products.map(product => {
                        const cat = categories.find(c => c.id === product.categoryId);
                        const shop = shops.find(s => s.id === product.shopId);
                        const isLow = product.currentStock <= product.minStock;
                        const proposedPrice =
                          product.proposedSellingPrice || product.sellingPrice;
                        const marginPct =
                          proposedPrice > 0
                            ? (
                                ((proposedPrice - product.purchasePrice) /
                                  proposedPrice) *
                                100
                              ).toFixed(1)
                            : '0';

                        return (
                          <tr
                            key={product.id}
                            className={`hover:bg-slate-850/60 transition ${
                              product.status === 'INACTIVE'
                                ? 'opacity-50 bg-slate-950/40'
                                : ''
                            }`}
                          >
                            <td className="py-3.5 px-4 font-semibold text-white">
                              <div className="flex items-center gap-3">
                                <ProductThumbnail
                                  product={product}
                                  size="md"
                                  onClick={() => {
                                    setViewingProduct(product);
                                    setIsViewerOpen(true);
                                  }}
                                />
                                <div className="min-w-0">
                                  <div className="truncate font-semibold">
                                    {product.name}
                                  </div>
                                  {product.status === 'INACTIVE' && (
                                    <span className="text-[10px] font-normal text-rose-400 bg-rose-500/10 px-1.5 py-0.2 rounded border border-rose-500/20">
                                      Deactivated / Hidden from POS
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-slate-300">
                              <span className="px-2 py-0.5 rounded bg-blue-950/70 text-blue-300 border border-blue-800/50 text-[10px] font-semibold">
                                {shop?.name || 'Main Shop'}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-mono text-slate-400">
                              <div>{product.sku}</div>
                              <div className="text-[10px] text-slate-500">
                                {product.barcode}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-slate-300">
                              <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] font-medium border border-slate-700/60">
                                {cat?.name || 'General'}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono text-slate-400">
                              {formatCurrency(
                                product.purchasePrice,
                                settings.currencySymbol
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono font-bold text-white">
                              {formatCurrency(proposedPrice, settings.currencySymbol)}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono text-emerald-400 font-semibold">
                              {marginPct}%
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <span
                                className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                                  product.currentStock <= 0
                                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                    : isLow
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    : 'bg-emerald-500/15 text-emerald-300'
                                }`}
                              >
                                {product.currentStock} {product.unit}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  product.status === 'ACTIVE'
                                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                                    : 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
                                }`}
                              >
                                {product.status}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right space-x-2 whitespace-nowrap">
                              {canEdit && (
                                <>
                                  <button
                                    onClick={() => openEditModal(product)}
                                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                                    title="Edit product"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleToggleStatus(product)}
                                    className={`p-1.5 rounded-lg transition ${
                                      product.status === 'ACTIVE'
                                        ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400'
                                        : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400'
                                    }`}
                                    title={
                                      product.status === 'ACTIVE'
                                        ? 'Deactivate Product'
                                        : 'Activate Product'
                                    }
                                  >
                                    <Power className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                              {canDelete && (
                                <button
                                  onClick={() => setDeletingProduct(product)}
                                  className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition"
                                  title="Delete product"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
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
        </>
      )}

      {/* CATEGORIES TAB */}
      {activeSubTab === 'categories' && (
        <div className="space-y-4">
          {/* Header + Shop filter chips */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FolderTree className="w-4 h-4 text-emerald-400" />
                <span>Shop-Specific Categories</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Every category is assigned to a specific shop to keep products classified and
                isolated.
              </p>
            </div>

            {/* Shop filter chips - horizontal scroll */}
            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs overflow-x-auto">
              <button
                onClick={() => setCategoryShopFilter('ALL')}
                className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition ${
                  categoryShopFilter === 'ALL'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All ({categories.length})
              </button>
              {shops.map(s => {
                const count = categories.filter(c => c.shopId === s.id).length;
                return (
                  <button
                    key={s.id}
                    onClick={() => setCategoryShopFilter(s.id)}
                    className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition ${
                      categoryShopFilter === s.id
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {s.name} ({count})
                  </button>
                );
              })}
            </div>

            {canEdit && (
              <button
                onClick={() =>
                  openAddCategoryModal(
                    categoryShopFilter === 'ALL' ? undefined : categoryShopFilter
                  )
                }
                className="w-full flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold text-xs transition shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Add Category</span>
              </button>
            )}
          </div>

          {/* Category sections grouped by shop */}
          {shops.length === 0 ? (
            <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-xl text-slate-500">
              <FolderTree className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No shops exist. Create a shop first!</p>
            </div>
          ) : categories.length === 0 ? (
            <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-xl text-slate-500">
              <FolderTree className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No categories yet. Create your first category!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {shops
                .filter(
                  shop =>
                    categoryShopFilter === 'ALL' || categoryShopFilter === shop.id
                )
                .map(shop => {
                  const shopCats = categories.filter(c => c.shopId === shop.id);
                  const totalShopProducts = allProducts.filter(
                    p => p.shopId === shop.id
                  ).length;

                  return (
                    <div
                      key={shop.id}
                      className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 space-y-3"
                    >
                      {/* Shop banner */}
                      <div className="flex items-center gap-3 pb-3 border-b border-slate-800/80">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-bold shrink-0">
                          <Store className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-bold text-white truncate">
                              {shop.name}
                            </h4>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                              {shop.code || 'UNIT'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {shopCats.length}{' '}
                            {shopCats.length === 1 ? 'Category' : 'Categories'} •{' '}
                            {totalShopProducts} Products
                          </p>
                        </div>
                      </div>

                      {shopCats.length === 0 ? (
                        <div className="p-6 text-center bg-slate-950/40 rounded-xl border border-dashed border-slate-800 text-slate-500">
                          <Tag className="w-6 h-6 mx-auto mb-2 opacity-40" />
                          <p className="text-xs text-slate-400">
                            No categories yet for {shop.name}.
                          </p>
                          {canEdit && (
                            <button
                              onClick={() => openAddCategoryModal(shop.id)}
                              className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-semibold transition"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Create First Category</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {shopCats.map(cat => {
                            const productCount = allProducts.filter(
                              p => p.categoryId === cat.id && p.shopId === shop.id
                            ).length;
                            const isActive = cat.status !== 'INACTIVE';

                            return (
                              <div
                                key={cat.id}
                                className={`bg-slate-950/70 border rounded-xl p-3.5 space-y-3 ${
                                  isActive
                                    ? 'border-slate-800'
                                    : 'border-slate-800/60 opacity-60'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                    <div
                                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0 shadow"
                                      style={{ backgroundColor: cat.color || '#3b82f6' }}
                                    >
                                      <Tag className="w-3.5 h-3.5" />
                                    </div>
                                    <div className="min-w-0">
                                      <h5 className="text-xs font-bold text-white truncate">
                                        {cat.name}
                                      </h5>
                                      <p className="text-[10px] text-slate-400 mt-0.5">
                                        {productCount}{' '}
                                        {productCount === 1 ? 'Product' : 'Products'}
                                      </p>
                                    </div>
                                  </div>

                                  <span
                                    className={`px-1.5 py-0.2 text-[9px] font-bold rounded-full shrink-0 ${
                                      isActive
                                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                                        : 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
                                    }`}
                                  >
                                    {isActive ? 'Active' : 'Inactive'}
                                  </span>
                                </div>

                                {canEdit && (
                                  <div className="flex items-center gap-1.5 pt-2.5 border-t border-slate-800/80">
                                    <button
                                      onClick={() => openEditCategoryModal(cat)}
                                      className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 text-xs font-semibold transition"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => handleToggleCategoryStatus(cat)}
                                      className={`flex-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                                        isActive
                                          ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300'
                                          : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300'
                                      }`}
                                    >
                                      {isActive ? 'Deactivate' : 'Activate'}
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* Delete Product Confirmation */}
      {deletingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2 text-rose-400">
                <Trash2 className="w-5 h-5" />
                <h3 className="text-base font-bold text-white">Delete Product?</h3>
              </div>
              <button
                onClick={() => setDeletingProduct(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-200 text-xs mb-4">
              <strong>Warning:</strong> This action is permanent and cannot be undone.
            </div>

            <p className="text-xs text-slate-400 mb-4">
              Are you sure you want to delete{' '}
              <strong className="text-white">{deletingProduct.name}</strong>?
              <br />
              <br />
              This will permanently remove the product from all shops and delete its images.
            </p>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setDeletingProduct(null)}
                className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteProduct}
                className="px-4 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition"
              >
                Delete Product
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/80 backdrop-blur-sm sm:p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-t-2xl sm:rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-400" />
                <h3 className="text-base font-bold text-white">
                  {editingProduct ? 'Edit Product' : 'Create New Product'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveProduct} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Assigned Shop / Unit *
                </label>
                <select
                  value={productShopId}
                  onChange={e => handleProductShopChange(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Select shop...</option>
                  {shops.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code || 'UNIT'})
                    </option>
                  ))}
                </select>
                {shops.length === 0 && (
                  <p className="text-[10px] text-rose-400 mt-1">
                    No shops available. Create a shop first!
                  </p>
                )}
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Product Title *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Bosch Hammer Drill 650W"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Purchasing Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    value={purchasePrice}
                    onChange={e => setPurchasePrice(e.target.value)}
                    placeholder="0"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-white font-mono placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Selling Price *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    required
                    value={sellingPrice}
                    onChange={e => setSellingPrice(e.target.value)}
                    placeholder="0"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-white font-mono placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    {editingProduct ? 'Current Stock' : 'Initial Stock'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={currentStock}
                    onChange={e => setCurrentStock(e.target.value)}
                    placeholder="0"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-white font-mono placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Min Threshold
                  </label>
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={minStock}
                    onChange={e => setMinStock(e.target.value)}
                    placeholder="5"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-white font-mono placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-slate-300 font-medium">
                      Category *
                    </label>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => openAddCategoryModal(productShopId)}
                        className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-0.5"
                      >
                        <Plus className="w-3 h-3" />
                        <span>New</span>
                      </button>
                    )}
                  </div>
                  <select
                    value={categoryId}
                    onChange={e => setCategoryId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Select category...</option>
                    {categories
                      .filter(
                        c =>
                          c.shopId === productShopId &&
                          (c.status !== 'INACTIVE' || c.id === categoryId)
                      )
                      .map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.status === 'INACTIVE' ? '(Inactive)' : ''}
                        </option>
                      ))}
                  </select>
                  {categories.filter(c => c.shopId === productShopId).length === 0 && (
                    <p className="text-[10px] text-amber-400 mt-1">
                      No categories exist for this shop yet. Click "+ New" above.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Unit of Measure *
                  </label>
                  <select
                    value={unit}
                    onChange={e => setUnit(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="pcs">Pieces (pcs)</option>
                    <option value="meter">Meter (m)</option>
                    <option value="pack">Pack</option>
                    <option value="box">Box</option>
                    <option value="kg">Kilogram (kg)</option>
                    <option value="pair">Pair</option>
                    <option value="roll">Roll</option>
                    <option value="liter">Liter</option>
                    <option value="set">Set</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    SKU / Code
                  </label>
                  <input
                    type="text"
                    value={sku}
                    onChange={e => setSku(e.target.value)}
                    placeholder="Auto if empty"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-white font-mono placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Barcode</label>
                  <input
                    type="text"
                    value={barcode}
                    onChange={e => setBarcode(e.target.value)}
                    placeholder="Scan or enter"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-white font-mono placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/80">
                <ProductImageUpload
                  images={productImages}
                  onChange={setProductImages}
                  productId={editingProduct?.id}
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving || shops.length === 0}
                  className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow transition disabled:opacity-50"
                >
                  {isSaving
                    ? 'Saving...'
                    : editingProduct
                    ? 'Save Changes'
                    : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Category Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/80 backdrop-blur-sm sm:p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-t-2xl sm:rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <FolderTree className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">
                  {editingCategory ? 'Edit Category' : 'Create Category'}
                </h3>
              </div>
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {catModalError && (
              <div className="mb-4 p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{catModalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveCategory} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Shop *</label>
                <select
                  value={catShopIdInput}
                  onChange={e => setCatShopIdInput(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="" disabled>
                    Select target shop...
                  </option>
                  {shops.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code || 'UNIT'})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Categories are strictly assigned to this specific shop.
                </p>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  value={catNameInput}
                  onChange={e => setCatNameInput(e.target.value)}
                  placeholder="e.g. Plumbing, Tools, Paint..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Color Theme
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    '#3b82f6',
                    '#10b981',
                    '#f59e0b',
                    '#ec4899',
                    '#8b5cf6',
                    '#06b6d4',
                    '#64748b',
                  ].map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setCatColorInput(color)}
                      className={`w-8 h-8 rounded-full transition flex items-center justify-center ${
                        catColorInput === color
                          ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110'
                          : 'opacity-70 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: color }}
                    >
                      {catColorInput === color && (
                        <Check className="w-3.5 h-3.5 text-white" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow transition"
                >
                  {editingCategory ? 'Save' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ProductImageViewerModal
        product={viewingProduct}
        isOpen={isViewerOpen}
        onClose={() => setIsViewerOpen(false)}
        currencySymbol={settings.currencySymbol}
      />
    </div>
  );
};
