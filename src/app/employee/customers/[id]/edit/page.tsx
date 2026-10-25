"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import CustomerForm from "@/components/admin/CustomerForm";
import type { CustomerData } from "@/lib/types";

export default function EditCustomerPage() {
  const params = useParams();
  const id = params?.id as string;
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    async function loadCustomer() {
      try {
        setLoading(true);
        const res = await fetch(`/api/customers/${id}`);
        if (!res.ok) {
          throw new Error(`Failed to load customer shop (Status ${res.status})`);
        }
        const data = await res.json();
        setCustomer(data);
      } catch (err: any) {
        setError(err.message || "Could not load customer shop details.");
      } finally {
        setLoading(false);
      }
    }

    loadCustomer();
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
        <p className="text-sm text-zinc-500">Loading customer information...</p>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
        {error || "Customer not found."}
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center min-h-[300px] gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
          <p className="text-sm text-zinc-500">Loading customer information...</p>
        </div>
      }
    >
      <CustomerForm initialData={customer} isEdit customerId={id} />
    </Suspense>
  );
}
