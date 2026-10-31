"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { MessageCircle, ShieldAlert, ShieldCheck } from "lucide-react";
import WhatsAppGatewayView from "@/components/admin/WhatsAppGatewayView";
import SecurityAuditView from "@/components/admin/SecurityAuditView";

function SecurityPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tabParam = searchParams.get("tab");

  const [activeTab, setActiveTab] = useState<"WHATSAPP" | "AUDIT">(
    tabParam?.toLowerCase() === "audit" ? "AUDIT" : "WHATSAPP"
  );

  useEffect(() => {
    if (tabParam?.toLowerCase() === "audit") {
      setActiveTab("AUDIT");
    } else if (tabParam?.toLowerCase() === "whatsapp") {
      setActiveTab("WHATSAPP");
    }
  }, [tabParam]);

  const handleTabChange = (tab: "WHATSAPP" | "AUDIT") => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "AUDIT") {
      params.set("tab", "audit");
    } else {
      params.set("tab", "whatsapp");
    }
    const query = params.toString() ? `?${params.toString()}` : "";
    router.replace(`${pathname}${query}`, { scroll: false });
  };

  return (
    <div className="space-y-6">
      {/* Top Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-gray-200">
        <button
          type="button"
          onClick={() => handleTabChange("WHATSAPP")}
          className={`px-5 py-3 text-xs sm:text-sm font-bold transition-all flex items-center gap-2 border-b-2 cursor-pointer ${
            activeTab === "WHATSAPP"
              ? "border-emerald-600 text-emerald-700 bg-emerald-50/70 rounded-t-xl"
              : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
          }`}
        >
          <MessageCircle size={16} className={activeTab === "WHATSAPP" ? "text-emerald-600" : "text-gray-400"} />
          <span>WhatsApp Gateway</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange("AUDIT")}
          className={`px-5 py-3 text-xs sm:text-sm font-bold transition-all flex items-center gap-2 border-b-2 cursor-pointer ${
            activeTab === "AUDIT"
              ? "border-emerald-600 text-emerald-700 bg-emerald-50/70 rounded-t-xl"
              : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
          }`}
        >
          <ShieldAlert size={16} className={activeTab === "AUDIT" ? "text-emerald-600" : "text-gray-400"} />
          <span>Security Audit</span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "WHATSAPP" ? (
        <WhatsAppGatewayView />
      ) : (
        <SecurityAuditView />
      )}
    </div>
  );
}

export default function SecurityPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-gray-500">Loading security center...</div>}>
      <SecurityPageContent />
    </Suspense>
  );
}
