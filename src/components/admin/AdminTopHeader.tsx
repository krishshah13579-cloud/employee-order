"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Menu,
  X,
  ChevronRight,
  LogOut,
  Download,
  Smartphone,
  Share,
} from "lucide-react";

interface AdminTopHeaderProps {
  onToggleMobileMenu?: () => void;
  mobileMenuOpen?: boolean;
}

export default function AdminTopHeader({
  onToggleMobileMenu,
  mobileMenuOpen,
}: AdminTopHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();

  // PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true
      ) {
        setIsStandalone(true);
      }

      const ua = window.navigator.userAgent.toLowerCase();
      const isIosDevice = /iphone|ipad|ipod/.test(ua);
      setIsIOS(isIosDevice);

      const handleBeforeInstall = (e: any) => {
        e.preventDefault();
        setDeferredPrompt(e);
        setIsInstallable(true);
      };

      window.addEventListener("beforeinstallprompt", handleBeforeInstall);
      return () => {
        window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      };
    }
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice && choice.outcome === "accepted") {
        setIsInstallable(false);
        setDeferredPrompt(null);
      }
    } else if (isIOS) {
      setShowIOSModal(true);
    } else {
      alert("To install OBEXA ADMIN on your device: open browser options (⋮ or share menu) and tap 'Add to Home Screen' or 'Install App'.");
    }
  };

  const getPageTitle = () => {
    if (pathname === "/admin" || pathname === "/admin/employee") return "Wholesale Overview Dashboard";
    if (pathname === "/admin/online") return "Online Store Dashboard";
    if (pathname.startsWith("/admin/online/products")) return "Online Products Catalog";
    if (pathname.startsWith("/admin/online/categories")) return "Online Categories";
    if (pathname.startsWith("/admin/online/orders")) return "Online Store Orders";
    if (pathname.startsWith("/admin/online/discounts")) return "Online Discounts & Coupons";
    if (pathname.startsWith("/admin/online/users")) return "Online Registered Shoppers";
    if (pathname === "/admin/stock") return "Shared Inventory Control";
    if (pathname.includes("/profile")) return "Company & Admin Details";
    if (pathname.includes("/products/new")) return "Add New Wholesale Garment";
    if (pathname.includes("/products/") && pathname.endsWith("/edit")) return "Edit Wholesale Garment";
    if (pathname.includes("/products")) return "Product Catalog Management";
    if (pathname.includes("/categories")) return "Garment Categories";
    if (pathname.includes("/customers/new")) return "Add Customer Shop";
    if (pathname.includes("/customers/") && pathname.endsWith("/edit")) return "Edit Customer Shop";
    if (pathname.includes("/customers")) return "Customer Shops & Retailers";
    if (pathname.includes("/visited-customers")) return "Visited Retail Customers";
    if (pathname.includes("/employees/new")) return "Add New Employee";
    if (pathname.includes("/employees/") && pathname.endsWith("/edit")) return "Edit Employee";
    if (pathname.includes("/employees")) return "Employee Management";
    if (pathname.includes("/orders/new")) return "Book New Wholesale Order";
    if (pathname.includes("/orders/")) return "Wholesale Order Form & Invoice";
    if (pathname.includes("/invoices")) return "Final Tax Invoices (GST 5%)";
    if (pathname.includes("/bills")) return "Wholesale Bills (Without GST)";
    if (pathname.includes("/orders")) return "Wholesale Order Forms";
    if (pathname.includes("/sales")) return "Sales Register & Invoices";
    if (pathname.includes("/outstanding")) return "Customer Outstanding & Bills";
    if (pathname.includes("/ledger")) return "Print Ledger & Customer Statement";
    if (pathname.includes("/returns")) return "Sales Returns & Credits";
    if (pathname.includes("/profit")) return "Wholesale Gross Profit Breakdown";
    if (pathname.includes("/reports")) return "Sales & Financial Reports";
    if (pathname.includes("/invoice-settings")) return "Invoice & Company Configuration";
    if (pathname.includes("/security")) return "Security & WhatsApp Center";
    if (pathname.includes("/whatsapp")) return "WhatsApp Business Gateway";
    if (pathname.includes("/audit")) return "System Audit Logs";
    return "Control Center";
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/admin/login");
    } catch {
      router.push("/admin/login");
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200/90 shadow-2xs">
      <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
        {/* Left: Breadcrumbs & Page Title (Toggle button removed for cleaner mobile layout) */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider shrink-0">
            <span>Admin Panel</span>
            <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
          </span>
          <h1 className="text-sm sm:text-base font-bold text-gray-900 tracking-tight truncate">
            {getPageTitle()}
          </h1>
        </div>

        {/* Right: Install App, Security Badge, Admin User Pill, Sign Out */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Install OBEXA ADMIN Web App Button */}
          {!isStandalone && (
            <button
              type="button"
              onClick={handleInstallClick}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-xs transition cursor-pointer shrink-0"
              title="Install OBEXA ADMIN app on your phone or PC"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Install OBEXA ADMIN</span>
              <span className="sm:hidden">Install App</span>
            </button>
          )}

          {/* Security Status Badge */}
          <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200/80">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-semibold text-emerald-800">
              2FA Secured
            </span>
          </div>

          {/* Admin User Info Pill */}
          <div className="hidden sm:flex items-center gap-2.5 pl-2 pr-3 py-1 bg-zinc-900 text-white rounded-full shadow-2xs">
            <div className="w-6 h-6 rounded-full bg-amber-400 text-zinc-950 flex items-center justify-center font-bold text-xs uppercase">
              K
            </div>
            <div className="text-left">
              <span className="block text-xs font-semibold leading-tight max-w-[140px] truncate">
                Krish Sandip Shah
              </span>
              <span className="block text-[9px] font-bold text-amber-300 uppercase tracking-wider leading-none">
                Super Admin
              </span>
            </div>
          </div>

          {/* Direct Sign Out Button */}
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 transition-colors border border-rose-200/80 cursor-pointer"
            title="Sign out of Admin Session"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </div>

      {/* iOS Safari PWA Installation Instructions Modal */}
      {showIOSModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setShowIOSModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-orange-600" />
                <h3 className="text-sm font-bold text-gray-900">Install OBEXA ADMIN</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSModal(false)}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-gray-600">
              <p>Install the OBEXA ADMIN Web App on your iPhone or iPad for quick 1-tap full-screen access:</p>
              <ol className="list-decimal pl-5 space-y-2 font-medium">
                <li>
                  Tap the <span className="font-bold text-gray-900 inline-flex items-center gap-1"><Share className="w-3.5 h-3.5 text-blue-600 inline" /> Share</span> icon in Safari&apos;s bottom toolbar.
                </li>
                <li>
                  Scroll down the menu and tap <span className="font-bold text-gray-900">&quot;Add to Home Screen&quot;</span>.
                </li>
                <li>
                  Tap <span className="font-bold text-orange-600">&quot;Add&quot;</span> in the top-right corner.
                </li>
              </ol>
            </div>

            <button
              type="button"
              onClick={() => setShowIOSModal(false)}
              className="w-full py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
