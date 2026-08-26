export type UserRole = 'ADMIN' | 'SELLER';

export type UserStatus = 'ACTIVE' | 'INACTIVE';

export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  passwordHash: string;
  color: string;
  status: UserStatus;
  assignedShopIds?: string[];
  avatarUrl?: string; // ADDED: Profile picture URL
  createdAt: string;
  updatedAt: string;
}

export type ShopStatus = 'ACTIVE' | 'INACTIVE';

export interface Shop {
  id: string;
  name: string;
  code?: string;
  description?: string;
  address?: string;
  phone?: string;
  status: ShopStatus;
  color?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  shopId: string;
  name: string;
  icon?: string;
  color?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  createdAt?: string;
  updatedAt?: string;
}

export type ProductStatus = 'ACTIVE' | 'INACTIVE';

export interface ProductImage {
  imageId: string;
  productId?: string;
  imageOrder: number;
  version: number;
  dataUrl: string;
  thumbnailUrl?: string;
  filename?: string;
  mimeType: string;
  fileSize: number;
  width?: number;
  height?: number;
  hash?: string;
  syncStatus?: 'LOCAL_ONLY' | 'SYNCED' | 'MODIFIED_LOCALLY';
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  shopId: string;
  name: string;
  sku: string;
  barcode: string;
  categoryId: string;
  sellingPrice: number;
  proposedSellingPrice?: number;
  purchasePrice: number;
  currentStock: number;
  minStock: number;
  unit: string;
  status: ProductStatus;
  imageUrl?: string;
  images?: ProductImage[];
  createdAt: string;
  updatedAt: string;
}

export type PaymentMethod = 'CASH' | 'MOBILE_MONEY' | 'CARD' | 'BANK' | 'OTHER';

export type SaleStatus = 'COMPLETED' | 'VOIDED';

export interface SaleItem {
  id: string;
  saleId: string;
  shopId?: string;
  productId: string;
  productName: string;
  sku: string;
  unitPrice: number;
  purchasePrice: number;
  quantity: number;
  discount: number;
  total: number;
}

export interface Sale {
  id: string;
  receiptNumber: string;
  shopId: string;
  shopName?: string;
  sellerId: string;
  sellerName: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  costOfGoods: number;
  grossProfit: number;
  paymentMethod: PaymentMethod;
  amountReceived: number;
  change: number;
  status: SaleStatus;
  voidReason?: string;
  voidedAt?: string;
  voidedBy?: string;
  notes?: string;
  createdAt: string;
  items: SaleItem[];
}

export type MovementType = 'SALE' | 'PURCHASE' | 'ADJUSTMENT' | 'CORRECTION' | 'RETURN' | 'VOID_RETURN' | 'DAMAGED' | 'BROKEN' | 'EXPIRED' | 'LOST';

export interface InventoryMovement {
  id: string;
  shopId: string;
  shopName?: string;
  productId: string;
  productName: string;
  previousQty: number;
  changeQty: number;
  newQty: number;
  type: MovementType;
  reason: string;
  costValue?: number;
  referenceId?: string;
  userId: string;
  userName: string;
  createdAt: string;
}

export type PaymentStatus = 'PAID' | 'PARTIAL' | 'UNPAID';

export interface PurchaseItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  total: number;
}

export interface Purchase {
  id: string;
  purchaseNumber: string;
  shopId: string;
  shopName?: string;
  supplierName: string;
  date: string;
  items: PurchaseItem[];
  totalAmount: number;
  paymentStatus: PaymentStatus;
  notes?: string;
  invoiceNumber?: string;
  createdByUserId: string;
  createdByName: string;
  createdAt: string;
}

export type ExpenseCategory =
  | 'ELECTRICITY'
  | 'RENT'
  | 'TRANSPORT'
  | 'SALARIES'
  | 'INTERNET'
  | 'MAINTENANCE'
  | 'MARKETING'
  | 'SUPPLIES'
  | 'OFFICE_SUPPLIES'
  | 'OTHER';

export interface Expense {
  id: string;
  shopId?: string | null;
  shopName?: string;
  isCompanyExpense?: boolean;
  category: ExpenseCategory | string;
  description: string;
  title?: string;
  amount: number;
  paymentMethod: PaymentMethod;
  date: string;
  reference?: string;
  notes?: string;
  createdByUserId: string;
  createdByName: string;
  createdAt: string;
}

export interface BusinessSettings {
  businessName: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  currencySymbol: string;
  currencyCode?: string;
  taxRatePercent: number;
  enableTax: boolean;
  receiptHeaderNote: string;
  receiptFooterNote: string;
  receiptPaperWidth: '80mm' | '58mm' | 'A4';
  lowStockThresholdDefault: number;
  logoUrl?: string;
  themePrimaryColor?: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  entityType: 'PRODUCT' | 'SALE' | 'PURCHASE' | 'EXPENSE' | 'SELLER' | 'INVENTORY' | 'SETTINGS' | 'AUTH' | 'BACKUP' | 'SHOP' | 'IMPORT';
  entityId?: string;
  shopId?: string;
  timestamp: string;
  performedByName?: string;
  createdAt?: string;
}

export type SyncOperation =
  | 'CREATE_PRODUCT'
  | 'UPDATE_PRODUCT'
  | 'TOGGLE_PRODUCT_STATUS'
  | 'CREATE_SALE'
  | 'VOID_SALE'
  | 'CREATE_PURCHASE'
  | 'CREATE_EXPENSE'
  | 'CREATE_SELLER'
  | 'UPDATE_SELLER'
  | 'STOCK_ADJUSTMENT'
  | 'UPDATE_SETTINGS'
  | 'CREATE_SHOP'
  | 'UPDATE_SHOP'
  | 'TOGGLE_SHOP_STATUS'
  | 'CREATE_DEBT'
  | 'UPDATE_DEBT';

export interface SyncQueueItem {
  id: string;
  operation?: SyncOperation;
  action?: string;
  entityType: string;
  entityId: string;
  payload: any;
  status: 'PENDING' | 'SYNCED' | 'FAILED';
  retryCount?: number;
  timestamp?: string;
  createdAt: string;
}

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

export interface ColorOption {
  id: string;
  name: string;
  primary: string;
  bgLight: string;
  border: string;
  hover: string;
  text: string;
}

export type CsvDataType = 'PRODUCTS' | 'INVENTORY' | 'SALES' | 'PURCHASES' | 'EXPENSES' | 'SELLERS' | 'SHOPS' | 'DEBTS';

export interface ImportHistoryItem {
  id: string;
  fileName: string;
  dataType: CsvDataType;
  totalRecords: number;
  successCount: number;
  failedCount: number;
  updatedCount?: number;
  createdCount?: number;
  importedByUserId: string;
  importedByName: string;
  createdAt: string;
  notes?: string;
}

// ==========================================
// DEBT MANAGEMENT
// ==========================================
export type DebtType = 'WE_DEMAND' | 'THEY_DEMAND';

export type DebtStatus = 'PENDING' | 'DUE_TODAY' | 'OVERDUE' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED' | 'ARCHIVED';

export interface DebtPayment {
  id: string;
  debtId: string;
  amount: number;
  paymentDate: string;
  paymentMethod?: string;
  paidByUserId: string;
  paidByName: string;
  notes?: string;
  remainingAfter: number;
  createdAt: string;
}

export interface DebtRecord {
  id: string;
  type: DebtType;
  debtorName: string;
  productDescription?: string;
  amount: number;
  paidAmount?: number;
  remainingAmount?: number;
  payments?: DebtPayment[];
  dueDate?: string;
  contact?: string;
  notes?: string;
  status: DebtStatus;
  paidAt?: string;
  paidByUserId?: string;
  paidByName?: string;
  paymentNotes?: string;
  createdByUserId: string;
  createdByName: string;
  shopId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DebtSummary {
  weDemand: {
    totalOutstanding: number;
    dueTodayCount: number;
    dueTodayAmount: number;
    overdueCount: number;
    overdueAmount: number;
    paidCount: number;
    paidAmount: number;
    totalCount: number;
  };
  theyDemand: {
    totalOutstanding: number;
    dueTodayCount: number;
    dueTodayAmount: number;
    overdueCount: number;
    overdueAmount: number;
    paidCount: number;
    paidAmount: number;
    totalCount: number;
  };
}

// ==========================================
// NOTIFICATION CENTER
// ==========================================
export type NotificationCategory = 'CRITICAL' | 'WARNING' | 'INFO' | 'SUCCESS';

export type NotificationType =
  | 'DEBT_UPCOMING_CUSTOMER'
  | 'DEBT_UPCOMING_COMPANY'
  | 'DEBT_OVERDUE_CUSTOMER'
  | 'DEBT_OVERDUE_COMPANY'
  | 'STOCK_LOW'
  | 'STOCK_LOW_ADMIN'
  | 'STOCK_OUT'
  | 'STOCK_OUT_ADMIN'
  | 'PRICE_CHANGE_SELLER'
  | 'PRICE_CHANGE_ADMIN'
  | 'LOSS_OCCURRED'
  | 'SYSTEM_EVENT';

export interface AppNotification {
  id: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  isGlobal: boolean;
  targetShopId?: string;
  targetShopName?: string;
  targetUserIds?: string[];
  targetRole?: 'ADMIN' | 'SELLER' | 'ALL';
  relatedEntityId?: string;
  relatedEntityType?: 'DEBT' | 'PRODUCT' | 'SHOP' | 'SALE';
  createdAt: string;
  readByUserIds: string[];
}
