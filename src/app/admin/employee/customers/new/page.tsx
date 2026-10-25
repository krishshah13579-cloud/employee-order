"use client";

import { Suspense } from "react";
import CustomerForm from "@/components/admin/CustomerForm";
import { Loader2 } from "lucide-react";

export default function NewCustomerPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 flex items-center justify-center text-slate-400 gap-2">
          <Loader2 size={24} className="animate-spin text-orange-500" />
          <span className="text-xs font-semibold">Loading Customer Form...</span>
        </div>
      }
    >
      <CustomerForm />
    </Suspense>
  );
}
