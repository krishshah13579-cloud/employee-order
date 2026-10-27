"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  ArrowLeft,
  Sparkles,
  ShoppingBag,
  Truck,
  UserPlus,
  CheckCheck,
  Clock,
  ArrowRight,
  Filter,
  RefreshCw,
} from "lucide-react";
import { useNotifications, LiveNotification } from "@/components/notifications/NotificationProvider";

function formatNotificationTime(timestamp: string | Date): string {
  try {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "";
  }
}

function getDateGroupKey(timestamp: string | Date): { key: string; label: string; dateSortKey: number } {
  try {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) {
      return { key: "unknown", label: "Other", dateSortKey: 0 };
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const itemDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

    const diffDays = Math.round((today.getTime() - itemDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return { key: "today", label: "Today", dateSortKey: today.getTime() };
    }
    if (diffDays === 1) {
      return { key: "yesterday", label: "Yesterday", dateSortKey: itemDate.getTime() };
    }

    const formatted = d.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    return { key: d.toISOString().slice(0, 10), label: formatted, dateSortKey: itemDate.getTime() };
  } catch {
    return { key: "unknown", label: "Other", dateSortKey: 0 };
  }
}

export default function NotificationPage() {
  const router = useRouter();
  const {
    notifications,
    unreadCount,
    markAllAsRead,
    refreshNotifications,
    loading,
    permission,
    requestPermission,
  } = useNotifications();

  const [activeFilter, setActiveFilter] = useState<"ALL" | "ORDERS" | "ARTICLES" | "CUSTOMERS">("ALL");
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isTestingPush, setIsTestingPush] = useState<boolean>(false);

  const handleTestPush = async () => {
    setIsTestingPush(true);
    try {
      const res = await fetch("/api/notifications/test-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "🔔 IQ TROUSERS Lock-Screen Test",
          message: "Background VAPID Push is fully active on your phone!",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || "Test push dispatched! Lock your phone to see it on your lock screen.");
      } else {
        alert(data.error || "Failed to dispatch test push.");
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setIsTestingPush(false);
    }
  };

  // Automatically mark notifications as read when opening this dedicated page
  useEffect(() => {
    if (unreadCount > 0) {
      markAllAsRead();
    }
  }, [unreadCount, markAllAsRead]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshNotifications();
    } finally {
      setIsRefreshing(false);
    }
  };

  // Filter list by selected tab
  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (activeFilter === "ALL") return true;
      if (activeFilter === "ORDERS") return n.type === "ORDER_PLACED" || n.type === "ORDER_STATUS";
      if (activeFilter === "ARTICLES") return n.type === "ARTICLE";
      if (activeFilter === "CUSTOMERS") return n.type === "CUSTOMER";
      return true;
    });
  }, [notifications, activeFilter]);

  // Group date-wise, and time-wise within each date (newest on top, oldest at the bottom)
  const groupedNotifications = useMemo(() => {
    const groupsMap = new Map<string, { label: string; dateSortKey: number; items: LiveNotification[] }>();

    filteredNotifications.forEach((item) => {
      const { key, label, dateSortKey } = getDateGroupKey(item.timestamp);
      if (!groupsMap.has(key)) {
        groupsMap.set(key, { label, dateSortKey, items: [] });
      }
      groupsMap.get(key)!.items.push(item);
    });

    // Sort dates: newest date group first
    const sortedGroups = Array.from(groupsMap.values()).sort(
      (a, b) => b.dateSortKey - a.dateSortKey
    );

    // Within each date group, sort time-wise (newest on top, oldest goes to bottom)
    sortedGroups.forEach((group) => {
      group.items.sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return timeB - timeA; // Newest first, oldest at bottom
      });
    });

    return sortedGroups;
  }, [filteredNotifications]);

  const getNotificationIcon = (type: LiveNotification["type"]) => {
    switch (type) {
      case "ARTICLE":
        return <Sparkles className="w-5 h-5 text-emerald-600" />;
      case "ORDER_PLACED":
        return <ShoppingBag className="w-5 h-5 text-amber-600" />;
      case "ORDER_STATUS":
        return <Truck className="w-5 h-5 text-blue-600" />;
      case "CUSTOMER":
        return <UserPlus className="w-5 h-5 text-purple-600" />;
      default:
        return <Bell className="w-5 h-5 text-slate-600" />;
    }
  };

  const getIconBackground = (type: LiveNotification["type"]) => {
    switch (type) {
      case "ARTICLE":
        return "bg-emerald-50 border-emerald-200";
      case "ORDER_PLACED":
        return "bg-amber-50 border-amber-200";
      case "ORDER_STATUS":
        return "bg-blue-50 border-blue-200";
      case "CUSTOMER":
        return "bg-purple-50 border-purple-200";
      default:
        return "bg-slate-50 border-slate-200";
    }
  };

  const getCategoryLabel = (type: LiveNotification["type"]) => {
    switch (type) {
      case "ARTICLE":
        return "Article";
      case "ORDER_PLACED":
        return "Order Placed";
      case "ORDER_STATUS":
        return "Status Update";
      case "CUSTOMER":
        return "Customer";
      default:
        return "Alert";
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24 sm:pb-12">
      {/* Header Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-xs">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="p-2 rounded-xl text-slate-600 hover:text-black hover:bg-slate-100 transition cursor-pointer"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black text-slate-950 tracking-tight flex items-center gap-2">
                  <Bell className="w-5 h-5 text-orange-600" />
                  <span>Notifications</span>
                </h1>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-red-600 text-white font-bold text-xs shadow-xs">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                Live alerts for orders, articles, and customers
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing || loading}
              className="p-2 text-slate-600 hover:text-black hover:bg-slate-100 rounded-xl transition cursor-pointer"
              title="Refresh notifications"
              aria-label="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-orange-600" : ""}`} />
            </button>

            <button
              type="button"
              onClick={markAllAsRead}
              className="px-2.5 sm:px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-black hover:bg-slate-100 rounded-xl border border-slate-200 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <CheckCheck className="w-4 h-4 text-emerald-600" />
              <span className="hidden sm:inline">Mark all read</span>
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-2.5 pt-1 overflow-x-auto scrollbar-none flex items-center gap-1.5">
          {[
            { id: "ALL", label: "All" },
            { id: "ORDERS", label: "Orders" },
            { id: "ARTICLES", label: "New Articles" },
            { id: "CUSTOMERS", label: "Customers" },
          ].map((tab) => {
            const isSelected = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  isSelected
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* VAPID Lock-Screen Push Banner */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-4">
        {permission === "granted" ? (
          <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <div>
                <p className="text-xs font-bold text-emerald-950">
                  Lock-Screen Push Alerts Active
                </p>
                <p className="text-[11px] text-emerald-700">
                  You will receive updates even when this app is closed or phone is locked.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleTestPush}
              disabled={isTestingPush}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer self-start sm:self-auto shrink-0 disabled:opacity-50"
            >
              {isTestingPush ? "Dispatching..." : "Test Lock-Screen Push"}
            </button>
          </div>
        ) : (
          <div className="bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
            <div>
              <p className="text-xs font-extrabold flex items-center gap-1.5">
                <Bell className="w-4 h-4" />
                <span>Enable Background Lock-Screen Alerts</span>
              </p>
              <p className="text-[11px] text-orange-100 mt-0.5">
                Receive new orders and article updates even when you are out of the webapp.
              </p>
            </div>
            <button
              type="button"
              onClick={requestPermission}
              className="px-3.5 py-1.5 bg-white text-orange-700 hover:bg-orange-50 font-bold text-xs rounded-xl transition shadow-xs cursor-pointer self-start sm:self-auto shrink-0"
            >
              Turn On
            </button>
          </div>
        )}
      </div>

      {/* Main Notification Stream */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-5">
        {groupedNotifications.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center shadow-xs mt-6">
            <div className="w-14 h-14 rounded-2xl bg-orange-50 border border-orange-200 text-orange-600 flex items-center justify-center mx-auto mb-3 shadow-xs">
              <Bell className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No Notifications</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
              Any updates on orders, articles, or customers will appear here organized date-wise.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedNotifications.map((group) => (
              <section key={group.label} className="space-y-2.5">
                {/* Date Group Heading */}
                <div className="flex items-center gap-2 sticky top-[108px] z-30 py-1 bg-slate-50/95 backdrop-blur-xs">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-700 bg-white border border-slate-200 px-2.5 py-1 rounded-lg shadow-2xs">
                    {group.label}
                  </span>
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-[11px] font-bold text-slate-400">
                    {group.items.length} {group.items.length === 1 ? "update" : "updates"}
                  </span>
                </div>

                {/* Notifications list for this date (Newest on top, Oldest at bottom) */}
                <div className="space-y-2">
                  {group.items.map((item) => {
                    const timeStr = formatNotificationTime(item.timestamp);
                    const iconBg = getIconBackground(item.type);
                    const category = getCategoryLabel(item.type);

                    return (
                      <Link
                        key={item.id}
                        href={item.link || "/orders"}
                        className="block bg-white hover:bg-slate-50/80 rounded-2xl p-3.5 sm:p-4 border border-slate-200/90 shadow-2xs hover:shadow-md transition-all group"
                      >
                        <div className="flex items-start gap-3">
                          {/* Type Icon */}
                          <div
                            className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 shadow-2xs ${iconBg}`}
                          >
                            {getNotificationIcon(item.type)}
                          </div>

                          {/* Content Details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${item.badgeColor}`}
                              >
                                {category}
                              </span>

                              {timeStr && (
                                <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1 shrink-0">
                                  <Clock className="w-3 h-3 text-slate-400" />
                                  <span>{timeStr}</span>
                                </span>
                              )}
                            </div>

                            <h4 className="text-xs sm:text-sm font-bold text-slate-900 mt-1 leading-snug group-hover:text-orange-600 transition-colors">
                              {item.title}
                            </h4>

                            <p className="text-[11px] sm:text-xs text-slate-600 mt-0.5 line-clamp-2">
                              {item.subtitle}
                            </p>
                          </div>

                          {/* Arrow indicator */}
                          <div className="self-center pl-1 text-slate-300 group-hover:text-orange-600 group-hover:translate-x-0.5 transition-all">
                            <ArrowRight className="w-4 h-4" />
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
