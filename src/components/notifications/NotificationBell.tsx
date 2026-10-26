"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Bell,
  Sparkles,
  ShoppingBag,
  Truck,
  UserPlus,
  CheckCheck,
  Smartphone,
  ExternalLink,
  X,
  Volume2,
} from "lucide-react";
import { useNotifications, LiveNotification } from "./NotificationProvider";

function formatTimeAgo(dateInput: string | Date): string {
  const date = new Date(dateInput);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

export default function NotificationBell() {
  const {
    notifications,
    unreadCount,
    markAllAsRead,
    requestPermission,
    permission,
    isTrayOpen,
    setIsTrayOpen,
    setIsInstallGuideOpen,
  } = useNotifications();

  const [activeTab, setActiveTab] = useState<"ALL" | "ARTICLE" | "ORDER" | "CUSTOMER">("ALL");
  const trayRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (trayRef.current && !trayRef.current.contains(e.target as Node)) {
        setIsTrayOpen(false);
      }
    }
    if (isTrayOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isTrayOpen, setIsTrayOpen]);

  // Filter list
  const filteredNotifications = notifications.filter((n) => {
    if (activeTab === "ALL") return true;
    if (activeTab === "ARTICLE") return n.type === "ARTICLE";
    if (activeTab === "ORDER") return n.type === "ORDER_PLACED" || n.type === "ORDER_STATUS";
    if (activeTab === "CUSTOMER") return n.type === "CUSTOMER";
    return true;
  });

  const getNotificationIcon = (type: LiveNotification["type"]) => {
    switch (type) {
      case "ARTICLE":
        return <Sparkles className="w-4 h-4 text-emerald-600" />;
      case "ORDER_PLACED":
        return <ShoppingBag className="w-4 h-4 text-amber-600" />;
      case "ORDER_STATUS":
        return <Truck className="w-4 h-4 text-blue-600" />;
      case "CUSTOMER":
        return <UserPlus className="w-4 h-4 text-purple-600" />;
      default:
        return <Bell className="w-4 h-4 text-gray-600" />;
    }
  };

  return (
    <div className="relative" ref={trayRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => {
          setIsTrayOpen(!isTrayOpen);
          if (!isTrayOpen && unreadCount > 0) {
            markAllAsRead();
          }
        }}
        className="relative p-2 rounded-full text-gray-700 hover:text-black hover:bg-gray-100 transition-colors cursor-pointer flex items-center justify-center"
        aria-label="View live notifications"
        title="Live Admin & Order Updates"
      >
        <Bell className="w-5 h-5 sm:w-6 sm:h-6" />

        {/* Unread Glowing Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-600 text-white text-[10px] font-black shadow-xs ring-2 ring-white animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Slide-over / Dropdown Notification Panel */}
      {isTrayOpen && (
        <div className="fixed sm:absolute right-2 sm:right-0 top-16 sm:top-full mt-2 w-[calc(100vw-16px)] sm:w-96 max-w-sm bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150 flex flex-col max-h-[85vh]">
          {/* Header */}
          <div className="p-3.5 bg-gray-50/90 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <h4 className="font-extrabold text-xs sm:text-sm text-gray-900 tracking-tight">
                Live Admin &amp; Store Updates
              </h4>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={markAllAsRead}
                className="text-[11px] font-bold text-[#162082] hover:underline flex items-center gap-1 cursor-pointer"
                title="Mark all as read"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark Read</span>
              </button>
              <button
                type="button"
                onClick={() => setIsTrayOpen(false)}
                className="sm:hidden p-1 rounded-md text-gray-500 hover:text-black"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Bar: Install WebApp on iPhone Button */}
          <div className="px-3.5 py-2 bg-gradient-to-r from-blue-50 to-indigo-50/70 border-b border-blue-100/80 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                setIsTrayOpen(false);
                setIsInstallGuideOpen(true);
              }}
              className="text-[11px] font-bold text-[#162082] hover:text-[#0b1257] flex items-center gap-1.5 cursor-pointer text-left"
            >
              <Smartphone className="w-3.5 h-3.5 text-blue-700 shrink-0" />
              <span>Save WebApp to iPhone Home Screen ↗</span>
            </button>
          </div>

          {/* Enable Notifications Permission Bar (if not yet granted) */}
          {permission !== "granted" && (
            <div className="px-3.5 py-2 bg-amber-50 border-b border-amber-200/80 flex items-center justify-between gap-2 text-xs">
              <span className="text-[11px] text-amber-900 font-medium">
                Enable live push alerts on lock screen
              </span>
              <button
                type="button"
                onClick={requestPermission}
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-bold transition shrink-0"
              >
                Allow Alerts
              </button>
            </div>
          )}

          {/* Filter Pills */}
          <div className="flex items-center gap-1 p-2 bg-white border-b border-gray-100 overflow-x-auto text-[11px]">
            <button
              type="button"
              onClick={() => setActiveTab("ALL")}
              className={`px-2.5 py-1 rounded-full font-bold transition shrink-0 ${
                activeTab === "ALL"
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("ARTICLE")}
              className={`px-2.5 py-1 rounded-full font-bold transition shrink-0 ${
                activeTab === "ARTICLE"
                  ? "bg-emerald-700 text-white"
                  : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
              }`}
            >
              Articles
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("ORDER")}
              className={`px-2.5 py-1 rounded-full font-bold transition shrink-0 ${
                activeTab === "ORDER"
                  ? "bg-blue-700 text-white"
                  : "bg-blue-50 text-blue-800 hover:bg-blue-100"
              }`}
            >
              Orders
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("CUSTOMER")}
              className={`px-2.5 py-1 rounded-full font-bold transition shrink-0 ${
                activeTab === "CUSTOMER"
                  ? "bg-purple-700 text-white"
                  : "bg-purple-50 text-purple-800 hover:bg-purple-100"
              }`}
            >
              Customers
            </button>
          </div>

          {/* Notifications List */}
          <div className="overflow-y-auto divide-y divide-gray-100 flex-1">
            {filteredNotifications.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-xs">
                No recent notifications found.
              </div>
            ) : (
              filteredNotifications.map((notif) => (
                <Link
                  key={notif.id}
                  href={notif.link}
                  onClick={() => setIsTrayOpen(false)}
                  className="p-3 sm:p-3.5 hover:bg-gray-50 flex items-start gap-3 transition-colors block text-left"
                >
                  <div className="p-2 rounded-xl bg-gray-100 shrink-0 mt-0.5">
                    {getNotificationIcon(notif.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold text-gray-900 text-xs truncate">
                        {notif.title}
                      </p>
                      <span className="text-[10px] text-gray-400 shrink-0 font-medium">
                        {formatTimeAgo(notif.timestamp)}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-600 leading-snug line-clamp-2 mt-0.5">
                      {notif.subtitle}
                    </p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
