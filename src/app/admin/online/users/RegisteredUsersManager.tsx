"use client";

import { useState } from "react";
import {
  Users,
  Search,
  ShieldCheck,
  Trash2,
  ShoppingCart,
  DollarSign,
  UserCheck,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Phone,
} from "lucide-react";
import { formatPrice } from "@/lib/utils";

interface UserWithStats {
  id: string;
  name: string | null;
  email: string;
  phone?: string | null;
  role: string;
  createdAt: string;
  ordersCount: number;
  reviewsCount: number;
  totalSpent: number;
}

interface RegisteredUsersManagerProps {
  initialUsers: UserWithStats[];
}

export default function RegisteredUsersManager({
  initialUsers,
}: RegisteredUsersManagerProps) {
  const [users, setUsers] = useState<UserWithStats[]>(initialUsers);
  const [search, setSearch] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const handlePromoteToAdmin = async (user: UserWithStats) => {
    const confirmed = confirm(
      `Are you sure you want to promote "${user.name || user.email}" to an ADMIN? They will have full administrative access to products, orders, categories, and settings.`
    );
    if (!confirmed) return;

    setLoadingId(user.id);
    setFeedback(null);

    try {
      const res = await fetch("/api/online/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id, role: "ADMIN" }),
      });

      const data = await res.json();

      if (!res.ok) {
        setFeedback({
          type: "error",
          message: data.error || "Failed to promote user to Admin",
        });
        return;
      }

      // Remove from regular users list since they are now admin
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      setFeedback({
        type: "success",
        message: `${user.name || user.email} was successfully promoted to Administrator! You can manage them in the Admin Users tab.`,
      });
    } catch {
      setFeedback({
        type: "error",
        message: "Something went wrong. Please try again.",
      });
    } finally {
      setLoadingId(null);
    }
  };

  const handleDeleteUser = async (user: UserWithStats) => {
    const confirmed = confirm(
      `Are you sure you want to delete registered user "${user.name || user.email}"? This will permanently delete their account and history.`
    );
    if (!confirmed) return;

    setLoadingId(user.id);
    setFeedback(null);

    try {
      const res = await fetch(`/api/online/users?id=${user.id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        setFeedback({
          type: "error",
          message: data.error || "Failed to delete user",
        });
        return;
      }

      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      setFeedback({
        type: "success",
        message: "User account deleted successfully.",
      });
    } catch {
      setFeedback({
        type: "error",
        message: "Something went wrong. Please try again.",
      });
    } finally {
      setLoadingId(null);
    }
  };

  const filteredUsers = users.filter((u) => {
    const query = search.toLowerCase();
    return (
      (u.name && u.name.toLowerCase().includes(query)) ||
      u.email.toLowerCase().includes(query) ||
      (u.phone && u.phone.toLowerCase().includes(query))
    );
  });

  const totalOrders = users.reduce((sum, u) => sum + u.ordersCount, 0);
  const totalSpend = users.reduce((sum, u) => sum + u.totalSpent, 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Registered Users
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          View and manage registered customers, order histories, and shopper profiles.
        </p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Registered Customers
            </span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-2">
            {users.length}
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Customer Orders
            </span>
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-2">
            {totalOrders}
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Total Customer Spend
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-2">
            {formatPrice(totalSpend)}
          </p>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center justify-between gap-3 animate-fadeIn ${
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs underline font-semibold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Search Input */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search registered customers by name, email, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          {filteredUsers.length === 0 ? (
            <div className="p-12 text-center text-sm text-gray-500">
              {search
                ? "No registered users match your search query."
                : "No registered customers found yet."}
            </div>
          ) : (
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-700 border-b border-gray-200">
                <tr>
                  <th scope="col" className="px-6 py-3.5">User</th>
                  <th scope="col" className="px-6 py-3.5">Phone Number</th>
                  <th scope="col" className="px-6 py-3.5">Registered Date</th>
                  <th scope="col" className="px-6 py-3.5">Orders</th>
                  <th scope="col" className="px-6 py-3.5">Total Spent</th>
                  <th scope="col" className="px-6 py-3.5">Role</th>
                  <th scope="col" className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredUsers.map((u) => {
                  const isProcessing = loadingId === u.id;
                  const initialLetter = (u.name || u.email)[0].toUpperCase();

                  return (
                    <tr
                      key={u.id}
                      className="hover:bg-gray-50/80 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-neutral-900 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-xs">
                            {initialLetter}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 text-sm">
                              {u.name || "Customer"}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {u.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-gray-700 whitespace-nowrap">
                        {u.phone ? (
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-gray-400" />
                            <span>{u.phone}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">Not provided</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-500">
                        {new Date(u.createdAt).toLocaleDateString("en-IN", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          <ShoppingCart className="w-3 h-3 text-gray-500" />
                          <span>{u.ordersCount} orders</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 font-semibold text-gray-900">
                        {formatPrice(u.totalSpent)}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                          <UserCheck className="w-3 h-3" />
                          <span>Customer</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handlePromoteToAdmin(u)}
                            disabled={isProcessing}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-900 hover:text-white text-neutral-800 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                            title="Promote this user to Admin"
                          >
                            {isProcessing ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                            )}
                            <span>Make Admin</span>
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u)}
                            disabled={isProcessing}
                            className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Delete user account"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
