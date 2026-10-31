"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Loader2, RefreshCw, AlertCircle } from "lucide-react";
import EmployeeForm from "@/components/admin/EmployeeForm";
import type { EmployeeData } from "@/lib/types";

export default function EditEmployeePage() {
  const params = useParams();
  const id = params?.id as string;
  const [employee, setEmployee] = useState<EmployeeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEmployee = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/employees/${id}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Failed to load employee (Status ${res.status})`);
      }
      const data = await res.json();
      setEmployee(data);
    } catch (err: any) {
      setError(err.message || "Could not load employee details.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadEmployee();
  }, [loadEmployee]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[350px] gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-zinc-600" />
        <p className="text-sm font-medium text-zinc-600">Loading employee details...</p>
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 text-red-800 rounded-2xl max-w-2xl mx-auto my-8 space-y-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-bold text-red-900">Failed to Load Employee</h3>
            <p className="text-xs text-red-700 mt-1">{error || "Employee not found."}</p>
          </div>
        </div>
        <div className="pt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={() => loadEmployee()}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      </div>
    );
  }

  return <EmployeeForm initialData={employee} isEdit employeeId={id} />;
}
