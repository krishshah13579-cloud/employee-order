"use client";

import React, { useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ChevronRight } from "lucide-react";
import { useEmployee } from "@/components/providers/EmployeeProvider";
import { useToast } from "@/components/ui/Toast";

const MOTIVATIONAL_MESSAGES = [
  "“Success is the sum of small efforts, repeated day in and day out. Have a winning sales day!”",
  "“Quality and dedication build lasting customer trust. Let's make today count and achieve great milestones!”",
  "“Every wholesale customer order is a step toward excellence. Keep shining and stay focused!”",
  "“Believe in the value you deliver every day. Your commitment drives IQ Trousers forward!”",
  "“Great things never come from comfort zones. Give your best effort today and celebrate your progress!”",
];

export default function EmployeeWelcomeBreadcrumb() {
  const pathname = usePathname();
  const { employee } = useEmployee();
  const { toast } = useToast();

  const welcomedRef = useRef(false);
  const orderStatusesRef = useRef<Record<number, string>>({});
  const initialFetchDoneRef = useRef(false);

  // Pick a consistent daily motivational quote based on current date
  const motivationalMessage = useMemo(() => {
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    return MOTIVATIONAL_MESSAGES[dayOfYear % MOTIVATIONAL_MESSAGES.length];
  }, []);

  // 1. Show Welcome & Motivational Greeting as a Toast on Login / Mount
  useEffect(() => {
    if (!employee || welcomedRef.current) return;

    const sessionWelcomed = sessionStorage.getItem(`emp_welcomed_${employee.id}`);
    if (!sessionWelcomed) {
      toast(
        `👋 Welcome, ${employee.name} (${employee.designation || "Staff"})! ${motivationalMessage}`,
        "info"
      );
      sessionStorage.setItem(`emp_welcomed_${employee.id}`, "true");
      welcomedRef.current = true;
    }
  }, [employee, motivationalMessage, toast]);

  // 2. Poll for Order Updates & Admin Confirmations every 15 seconds
  useEffect(() => {
    if (!employee) return;

    const checkUpdates = async () => {
      try {
        const res = await fetch("/api/employee/updates");
        if (!res.ok) return;
        const data = await res.json();
        const orders = data.orders || [];

        if (!initialFetchDoneRef.current) {
          // Record current statuses on first fetch
          orders.forEach((ord: any) => {
            orderStatusesRef.current[ord.id] = ord.status;
          });
          initialFetchDoneRef.current = true;
          return;
        }

        // Check for status changes on subsequent polls
        orders.forEach((ord: any) => {
          const prevStatus = orderStatusesRef.current[ord.id];
          if (prevStatus && prevStatus !== ord.status) {
            if (ord.status === "Confirmed") {
              toast(`🎉 Order #${ord.orderNumber} has been CONFIRMED by Admin!`, "success");
            } else {
              toast(`📢 Admin Update: Order #${ord.orderNumber} status changed to "${ord.status}"!`, "info");
            }
          }
          orderStatusesRef.current[ord.id] = ord.status;
        });
      } catch (err) {
        // Silent background polling
      }
    };

    checkUpdates();
    const interval = setInterval(checkUpdates, 15000);
    return () => clearInterval(interval);
  }, [employee, toast]);

  if (!employee) return null;

  // Compute current page name for breadcrumb
  let currentPageTitle = "Dashboard";
  if (pathname === "/orders/new") {
    currentPageTitle = "New Order Form";
  } else if (pathname === "/orders") {
    currentPageTitle = "Customer Wholesale Orders";
  } else if (pathname.startsWith("/orders/")) {
    currentPageTitle = "Order Details & Dispatch";
  } else if (pathname === "/customers/new") {
    currentPageTitle = "New Customer";
  } else if (pathname === "/visiting-customers" || pathname.startsWith("/visiting-customers")) {
    currentPageTitle = "Visiting Customer";
  } else if (pathname === "/products") {
    currentPageTitle = "Product Catalog";
  }

  return (
    <div className="bg-slate-900 text-white border-b border-slate-800 shadow-xs print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-slate-400">
          <Link
            href="/"
            className="hover:text-white transition-colors flex items-center gap-1.5 font-medium"
            title="Go to Employee Portal"
          >
            <Home size={13} className="text-orange-400" />
            <span>Employee Portal</span>
          </Link>
          <ChevronRight size={12} className="text-slate-600" />
          <span className="text-orange-400 font-semibold">{currentPageTitle}</span>
        </nav>
      </div>
    </div>
  );
}
