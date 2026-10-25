export const CLOTHING_SIZES = [
  "28",
  "30",
  "32",
  "34",
  "36",
  "38",
  "40",
  "42",
  "44",
] as const;

export type ClothingSize = (typeof CLOTHING_SIZES)[number];

export interface SizeGuideRow {
  brandSize: string;
  waist: string;
  length: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  careInstructions?: string | null;
  price: number;
  comparePrice: number | null;
  images: string;
  sizes?: string | null; // JSON array string e.g. '["28","30","32"]'
  colors?: string | null; // JSON array string e.g. '["Navy Blue","Charcoal"]'
  inventory?: string | null; // JSON map string e.g. '{"Navy Blue":{"30":10,"32":15}}'
  sizeGuide?: string | null; // JSON array string e.g. '[{"brandSize":"30","waist":"30","length":"41"}]'
  categoryId: string;
  category?: Category;
  stock: number;
  featured: boolean;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  reviews?: Review[];
  _count?: { reviews: number };
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  products?: Product[];
  _count?: { products: number };
}

export interface CartItemType {
  id: string;
  productId: string;
  quantity: number;
  size?: string; // e.g. "32"
  color?: string; // e.g. "Navy Blue"
  product: Product;
}

export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  total: number;
  status: string;
  trackingNumber: string | null;
  shippingAddress: string;
  paymentIntent: string | null;
  discountCode: string | null;
  discountAmount: number;
  createdAt: Date;
  updatedAt: Date;
  user?: { name: string | null; email: string };
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  price: number;
  size?: string | null; // e.g. "32"
  product?: Product;
}

export interface Review {
  id: string;
  rating: number;
  comment: string;
  userId: string;
  productId: string;
  createdAt: Date;
  user?: { id?: string; name: string | null; email: string };
}

export interface Discount {
  id: string;
  code: string;
  type: "PERCENTAGE" | "FIXED";
  value: number;
  minOrder: number;
  maxDiscount?: number | null;
  maxUses: number | null;
  usedCount: number;
  active: boolean;
  expiresAt: Date | null;
  userId?: string | null;
  userPhone?: string | null;
  description?: string | null;
  targetAudience?: string | null;
  minOrders?: number | null;
  maxOrders?: number | null;
  minSpend?: number | null;
  createdAt: Date;
}

export interface ShippingAddress {
  fullName: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  phone: string;
}
