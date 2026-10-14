"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CheckoutRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/orders/new");
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-sm font-bold text-slate-700">Redirecting to Order Form...</p>
    </div>
  );
}
