"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, Home, ChevronRight, User, Award } from "lucide-react";
import { useEmployee } from "@/components/providers/EmployeeProvider";

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

  // Pick a consistent daily motivational quote based on current date
  const motivationalMessage = useMemo(() => {
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    return MOTIVATIONAL_MESSAGES[dayOfYear % MOTIVATIONAL_MESSAGES.length];
  }, []);

  if (!employee) return null;

  // Compute current page name for breadcrumb
  let currentPageTitle = "Dashboard";
  if (pathname === "/orders/new") {
    currentPageTitle = "New Order Form";
  } else if (pathname === "/orders") {
    currentPageTitle = "Customer Wholesale Orders";
  } else if (pathname.startsWith("/orders/")) {
    currentPageTitle = "Order Details & Dispatch";
  }

  return (
    <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white border-b border-slate-700/60 shadow-xs print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Left: Breadcrumb Navigation & Welcome Greeting */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            {/* Breadcrumb Path */}
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-400">
              <Link
                href="/"
                className="hover:text-white transition-colors flex items-center gap-1"
                title="Go to Dashboard"
              >
                <Home size={13} className="text-orange-400" />
                <span>Employee Portal</span>
              </Link>
              <ChevronRight size={12} className="text-slate-500" />
              <span className="text-orange-400 font-semibold">{currentPageTitle}</span>
            </nav>

            <span className="hidden sm:inline-block text-slate-600">•</span>

            {/* Personalized Welcome */}
            <div className="inline-flex items-center gap-1.5 text-xs">
              <span className="text-slate-300">Welcome,</span>
              <span className="font-extrabold text-white bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700 text-orange-400">
                {employee.name}
              </span>
              <span className="text-[10px] text-slate-400">
                ({employee.designation || "Staff"})
              </span>
            </div>
          </div>

          {/* Right: Good Motivation Message */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-500/10 border border-orange-500/25 rounded-xl text-xs text-orange-200">
            <Sparkles size={14} className="text-orange-400 shrink-0" />
            <span className="italic font-medium text-[11px] sm:text-xs tracking-tight">
              {motivationalMessage}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
