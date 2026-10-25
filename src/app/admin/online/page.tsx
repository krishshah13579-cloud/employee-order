"use client";

import Link from "next/link";
import { Package, ShoppingCart, Tag, Users, FolderTree, ArrowRight, ExternalLink } from "lucide-react";

export default function OnlineDashboard() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <h1 className="text-2xl font-black text-zinc-950 tracking-tight flex items-center gap-2">
            <span>🌐 Online Store Admin</span>
            <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full border border-emerald-300">
              D2C Retail
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-1">
            Manage e-commerce products, online orders, discount coupons, and customer profiles.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/stock"
            className="px-3.5 py-2 text-xs font-bold bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition flex items-center gap-1.5 shadow-sm"
          >
            <span>View Common Stock</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      {/* Quick Action Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link
          href="/admin/online/orders"
          className="p-5 bg-white rounded-2xl border border-gray-200 shadow-xs hover:border-orange-500 hover:shadow-md transition group"
        >
          <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center mb-3 group-hover:scale-110 transition">
            <ShoppingCart size={20} />
          </div>
          <h3 className="font-bold text-zinc-900 text-base">Online Store Orders</h3>
          <p className="text-xs text-zinc-500 mt-1">View consumer retail orders, tracking numbers, and delivery statuses.</p>
        </Link>

        <Link
          href="/admin/online/products"
          className="p-5 bg-white rounded-2xl border border-gray-200 shadow-xs hover:border-emerald-500 hover:shadow-md transition group"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3 group-hover:scale-110 transition">
            <Package size={20} />
          </div>
          <h3 className="font-bold text-zinc-900 text-base">Products Catalog</h3>
          <p className="text-xs text-zinc-500 mt-1">Manage single-piece trouser variants, retail prices, and descriptions.</p>
        </Link>

        <Link
          href="/admin/online/discounts"
          className="p-5 bg-white rounded-2xl border border-gray-200 shadow-xs hover:border-blue-500 hover:shadow-md transition group"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3 group-hover:scale-110 transition">
            <Tag size={20} />
          </div>
          <h3 className="font-bold text-zinc-900 text-base">Discounts & Coupons</h3>
          <p className="text-xs text-zinc-500 mt-1">Create promotional coupon codes, percentage sales, and order minimums.</p>
        </Link>

        <Link
          href="/admin/online/users"
          className="p-5 bg-white rounded-2xl border border-gray-200 shadow-xs hover:border-purple-500 hover:shadow-md transition group"
        >
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-3 group-hover:scale-110 transition">
            <Users size={20} />
          </div>
          <h3 className="font-bold text-zinc-900 text-base">Registered Shoppers</h3>
          <p className="text-xs text-zinc-500 mt-1">View retail consumer profiles, phone verifications, and order histories.</p>
        </Link>

        <Link
          href="/admin/online/categories"
          className="p-5 bg-white rounded-2xl border border-gray-200 shadow-xs hover:border-amber-500 hover:shadow-md transition group"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3 group-hover:scale-110 transition">
            <FolderTree size={20} />
          </div>
          <h3 className="font-bold text-zinc-900 text-base">Categories</h3>
          <p className="text-xs text-zinc-500 mt-1">Organize trouser collections, formal, casual, and seasonal styles.</p>
        </Link>

        <Link
          href="/admin/stock"
          className="p-5 bg-white rounded-2xl border border-gray-200 shadow-xs hover:border-zinc-900 hover:shadow-md transition group"
        >
          <div className="w-10 h-10 rounded-xl bg-zinc-100 text-zinc-900 flex items-center justify-center mb-3 group-hover:scale-110 transition">
            <Package size={20} />
          </div>
          <h3 className="font-bold text-zinc-900 text-base">Live Shared Stock</h3>
          <p className="text-xs text-zinc-500 mt-1">Synchronized inventory engine with 1-set break limit for single pieces.</p>
        </Link>
      </div>
    </div>
  );
}
