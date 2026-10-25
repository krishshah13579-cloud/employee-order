"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import EmployeeForm from "@/components/admin/EmployeeForm";
import type { EmployeeData } from "@/lib/types";

export default function EditEmployeePage() {
  const params = useParams();
  const id = params?.id as string;
  const [employee, setEmployee] = useState<EmployeeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    async function loadEmployee() {
      try {
        setLoading(true);
        const res = await fetch(`/api/employees/${id}`);
        if (!res.ok) {
          throw new Error(`Failed to load employee (Status ${res.status})`);
        }
        const data = await res.json();
        setEmployee(data);
      } catch (err: any) {
        setError(err.message || "Could not load employee details.");
      } finally {
        setLoading(false);
      }
    }

    loadEmployee();
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
        <p className="text-sm text-zinc-500">Loading employee information...</p>
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
        {error || "Employee not found."}
      </div>
    );
  }

  return <EmployeeForm initialData={employee} isEdit employeeId={id} />;
}
