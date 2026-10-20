/* ═══════════════════════════════════════════
   GarmentPro Wholesale Types & Constants
   ═══════════════════════════════════════════ */

export interface CartItem {
  productId: number;
  productName: string;
  size: string;
  color: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
  setsCount?: number;
  pcsPerSet?: number;
  maxSetsAvailable?: number;
}

export interface CreateOrderPayload {
  customerId: number;
  placedBy?: string;
  notes?: string;
  businessType?: string;
  creditDays?: number;
  items: {
    productId: number;
    colorSets?: ColorSetEntry[] | string;
    sizeRatio?: string;
    sizesList?: string;
    pcsPerSet?: number;
    totalSets?: number;
    size?: string;
    color?: string;
    quantity?: number;
    unitPrice: number;
    notes?: string;
  }[];
}

export interface CreateCustomerPayload {
  shopName?: string;
  firmName?: string;
  name?: string;
  gstPanNo?: string;
  businessType?: "RETAILER" | "WHOLESALER" | "WHOLESALER WITHOUT GST" | "RETAILER WITH SPECIAL DISCOUNT" | string;
  creditDays?: number;
  specialDiscount?: number;
  address?: string;
  city?: string;
  state?: string;
  phone?: string;
  phoneNumber?: string;
  email?: string;
  company?: string;
  visitingCardUrl?: string;
  contactPerson?: string;
  contactPersons?: string;
}

export interface AdminProfileData {
  id?: number;
  fullName: string;
  email: string;
  phone: string;
  companyName: string;
  gstNo: string;
  panNo: string;
  address: string;
  bankName: string;
  accountNo: string;
  ifscCode: string;
  notes?: string | null;
}

export interface EmployeeData {
  id: number;
  name: string;
  email?: string | null;
  pin?: string;
  mobileNumber: string;
  address: string;
  proofUrl?: string | null;
  designation: string;
  isTeamLeader?: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerData {
  id: number;
  shopName: string; // Firm Name / Shop Name
  firmName?: string;
  gstPanNo: string;
  businessType?: "RETAILER" | "WHOLESALER" | "WHOLESALER WITHOUT GST" | "RETAILER WITH SPECIAL DISCOUNT" | string;
  creditDays?: number;
  specialDiscount?: number | null;
  address: string; // Shop Address
  city?: string | null;
  state?: string | null;
  phoneNumber: string;
  visitingCardUrl?: string | null;
  contactPerson?: string | null;
  contactPersons?: string | null;
  allocatedEmployeeId?: number | null;
  allocatedEmployeeName?: string | null;
  createdAt: string;
  updatedAt: string;
  orders?: any[];
  _count?: {
    orders: number;
  };
}

export interface SizeGuideRow {
  brandSize: string;
  waist: string;
  length: string;
}

export interface ProductData {
  id: number;
  name: string;
  category: string;
  colorsAvailable: string; // e.g. "Dark Blue, Jet Black, Grey, Olive"
  colorMapping?: string | null; // e.g. '{"A": "Dark Blue", "B": "Jet Black"}'
  sizesRatio: string;      // e.g. "30 to 38"
  sizesList: string;       // e.g. "30, 32, 34, 36, 38"
  pcsPerSet: number;       // e.g. 5
  mrp?: number | null;      // Maximum Retail Price
  retailerPrice?: number | null; // Retailer Selling Price (MRP / 2)
  wholesalerPrice?: number | null; // Wholesaler Selling Price (MRP / 2 - 100)
  price: number;           // base price per piece
  costPrice?: number | null; // Costing price per PC
  mixPcs?: number;          // Mixed / loose pieces in stock
  colorImages?: string | null; // JSON map of color -> image
  setsColorwise?: string | null; // e.g. "Dark Blue: 20, Jet Black: 25, Grey: 15"
  sizeGuide?: string | null;
  imageUrl?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ColorSetEntry {
  color: string;
  sets: number;
}

export interface OrderItemData {
  id?: number;
  productId: number;
  productName: string;
  colorSets: ColorSetEntry[] | string; // Color sets list, e.g. [{color: "Dark Blue", sets: 2}]
  sizeRatio: string;                   // e.g. "30 to 38"
  sizesList: string;                   // e.g. "30, 32, 34, 36, 38"
  pcsPerSet: number;                   // e.g. 5
  totalSets: number;                   // sum of color sets (e.g. 2 + 3 = 5)
  totalPcs: number;                    // totalSets * pcsPerSet (e.g. 5 * 5 = 25)
  unitPrice: number;                   // price per piece
  itemSubtotal: number;                // totalPcs * unitPrice
  notes?: string | null;
}

export interface OrderData {
  id: number;
  orderNumber: string;
  customerId: number;
  customerName: string;
  customerGstPan: string;
  customerPhone?: string | null;
  customerAddress?: string | null;
  businessType?: string | null;
  creditDays?: number;
  orderDate: string;
  status: OrderStatus;
  subtotal: number;
  gstRate: number;      // 5%
  gstAmount: number;     // subtotal * 0.05
  grandTotal: number;    // subtotal + gstAmount
  totalPcs: number;
  totalSets: number;
  placedBy?: string | null;
  taxInvoiceNumber?: string | null;
  taxInvoiceDate?: string | null;
  taxInvoiceItems?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: CustomerData;
  items: OrderItemData[];
}

export interface PaymentData {
  id: number;
  customerId: number;
  customerName: string;
  amount: number;
  paymentDate: string;
  paymentMode: string;
  referenceNo?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: CustomerData;
}

export interface SalesReturnItem {
  productName: string;
  color?: string;
  sizeRatio?: string;
  sets?: number;
  pcs: number;
  unitPrice: number;
  amount: number;
  reason?: string;
}

export interface SalesReturnData {
  id: number;
  returnNumber: string;
  customerId: number;
  customerName: string;
  orderId?: number | null;
  orderNumber?: string | null;
  returnDate: string;
  totalAmount: number;
  totalPcs: number;
  totalSets: number;
  items: SalesReturnItem[] | string;
  reason?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: CustomerData;
}

export interface DashboardStats {
  totalOrders: number;
  pendingOrders: number;
  totalCustomers: number;
  totalEmployees: number;
  totalProducts: number;
  totalRevenue: number;
  recentOrders: {
    id: number;
    orderNumber: string;
    customerName: string;
    status: string;
    grandTotal: number;
    totalPcs: number;
    orderDate: string;
  }[];
}

export const ORDER_STATUSES = [
  "Pending",
  "Confirmed",
  "In Production",
  "Ready",
  "Dispatched",
  "Delivered",
  "Cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const STANDARD_SIZE_RATIOS = [
  { label: "28 to 36 (28, 30, 32, 34, 36) - 5 Pcs", value: "28 to 36", sizes: "28, 30, 32, 34, 36", pcs: 5 },
  { label: "28 to 34 (28, 30, 32, 34) - 4 Pc Set", value: "28 to 34", sizes: "28, 30, 32, 34", pcs: 4 },
  { label: "30 to 38 (30, 32, 34, 36, 38) - 5 Pcs", value: "30 to 38", sizes: "30, 32, 34, 36, 38", pcs: 5 },
  { label: "32 to 38 (32, 34, 36, 38) - 4 Pcs", value: "32 to 38", sizes: "32, 34, 36, 38", pcs: 4 },
];

export const PRODUCT_CATEGORIES = [
  "EVERYDAY CASUAL",
  "FORMAL WEAR",
  "LINEN",
] as const;

export const STATUS_COLORS: Record<string, string> = {
  Pending: "bg-amber-100 text-amber-800 border-amber-300",
  Confirmed: "bg-blue-100 text-blue-800 border-blue-300",
  "In Production": "bg-purple-100 text-purple-800 border-purple-300",
  Ready: "bg-teal-100 text-teal-800 border-teal-300",
  Dispatched: "bg-indigo-100 text-indigo-800 border-indigo-300",
  Delivered: "bg-green-100 text-green-800 border-green-300",
  Cancelled: "bg-red-100 text-red-700 border-red-300",
};
