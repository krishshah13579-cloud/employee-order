"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import {
  UserCheck,
  Plus,
  Search,
  Phone,
  MapPin,
  FileCheck,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  Eye,
  RefreshCw,
  Mail,
} from "lucide-react";
import type { EmployeeData } from "@/lib/types";

export default function EmployeesPage() {
  const { toast } = useToast();
  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [previewProofUrl, setPreviewProofUrl] = useState<string | null>(null);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const url = search ? `/api/employees?search=${encodeURIComponent(search)}` : "/api/employees";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setEmployees(data);
      }
    } catch (err: any) {
      toast("Failed to load employees: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchEmployees();
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to delete employee "${name}"?`)) return;

    try {
      const res = await fetch(`/api/employees/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast("Employee record removed successfully", "success");
        fetchEmployees();
      } else {
        const err = await res.json();
        toast(err.error || "Failed to delete employee", "error");
      }
    } catch (err: any) {
      toast("Error: " + err.message, "error");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-orange-600 mb-1">
            <UserCheck size={14} /> Sales Representatives & Staff
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Employees</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Manage your sales agents, contact details, KYC proof verification, and ordering access permissions.
          </p>
        </div>

        <Link
          href="/admin/employees/new"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-zinc-950 hover:bg-black text-white font-semibold text-xs rounded-xl shadow-xs transition-colors cursor-pointer self-start md:self-auto"
        >
          <Plus size={16} />
          <span>Add Employee</span>
        </Link>
      </div>

      {/* Toolbar & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3.5 top-3 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by employee name, mobile, address..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-zinc-900 focus:outline-none shadow-2xs"
          />
        </div>

        <button
          onClick={fetchEmployees}
          className="p-2.5 bg-white border border-gray-300 rounded-xl text-gray-600 hover:bg-gray-50 shadow-2xs transition-colors self-end md:self-auto cursor-pointer"
          title="Refresh"
        >
          <RefreshCw size={16} className={loading ? "animate-spin text-zinc-900" : ""} />
        </button>
      </div>

      {/* Employees Table Card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                <th className="py-3.5 px-6">Employee Name</th>
                <th className="py-3.5 px-6">Designation</th>
                <th className="py-3.5 px-6">Email Address</th>
                <th className="py-3.5 px-6">Mobile Number</th>
                <th className="py-3.5 px-6">Residential Address</th>
                <th className="py-3.5 px-6">KYC / ID Proof</th>
                <th className="py-3.5 px-6">Status</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && employees.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400">
                    Loading employees...
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400">
                    No employees registered yet. Click "Add Employee" to create a staff record.
                  </td>
                </tr>
              ) : (
                employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-zinc-900 text-amber-400 flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs">
                          {emp.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-gray-900">{emp.name}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-gray-400 font-mono">
                              EMP-{String(emp.id).padStart(4, "0")}
                            </span>
                            <span className="text-[10px] bg-orange-50 text-orange-700 border border-orange-200 px-1.5 py-0.2 rounded font-mono font-bold">
                              PIN: {emp.pin || "1234"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-800">
                        {emp.designation}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-gray-700">
                      {emp.email ? (
                        <a
                          href={`mailto:${emp.email}`}
                          className="inline-flex items-center gap-1.5 hover:text-orange-600 font-medium transition-colors"
                        >
                          <Mail size={13} className="text-gray-400" />
                          <span className="truncate max-w-[160px]">{emp.email}</span>
                        </a>
                      ) : (
                        <span className="text-gray-400 italic text-[11px]">No email</span>
                      )}
                    </td>
                    <td className="py-4 px-6 font-mono font-medium text-gray-800">
                      <a
                        href={`tel:${emp.mobileNumber}`}
                        className="inline-flex items-center gap-1.5 hover:text-orange-600 transition-colors"
                      >
                        <Phone size={13} className="text-gray-400" />
                        {emp.mobileNumber}
                      </a>
                    </td>
                    <td className="py-4 px-6 max-w-xs text-gray-600">
                      <div className="flex items-start gap-1.5">
                        <MapPin size={13} className="text-gray-400 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{emp.address}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      {emp.proofUrl ? (
                        <button
                          onClick={() => setPreviewProofUrl(emp.proofUrl!)}
                          className="group relative inline-flex items-center gap-2 p-1 bg-gray-50 hover:bg-orange-50 border border-gray-200 hover:border-orange-300 rounded-xl transition-all cursor-pointer"
                          title="Click to view KYC document"
                        >
                          <img
                            src={emp.proofUrl}
                            alt="KYC Proof"
                            className="w-12 h-8 rounded-lg object-cover"
                          />
                          <span className="text-[11px] font-semibold text-gray-700 group-hover:text-orange-700 pr-1.5 flex items-center gap-1">
                            <Eye size={12} /> View Proof
                          </span>
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400 italic flex items-center gap-1">
                          <FileCheck size={13} /> No Proof
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      {emp.isActive ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold rounded-full">
                          <CheckCircle size={12} /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded-full">
                          <XCircle size={12} /> Inactive
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right space-x-2">
                      <Link
                        href={`/admin/employees/${emp.id}/edit`}
                        className="p-1.5 inline-flex text-gray-500 hover:text-black hover:bg-gray-100 rounded-lg transition-colors"
                        title="Edit Employee (Opens dedicated page)"
                      >
                        <Edit2 size={15} />
                      </Link>
                      <button
                        onClick={() => handleDelete(emp.id, emp.name)}
                        className="p-1.5 inline-flex text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete Employee"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Proof Preview Modal */}
      {previewProofUrl && (
        <Modal
          isOpen={!!previewProofUrl}
          onClose={() => setPreviewProofUrl(null)}
          title="Employee ID / Address Proof Document"
          size="md"
        >
          <div className="p-3 bg-gray-50 rounded-2xl border border-gray-200 flex flex-col items-center">
            <img
              src={previewProofUrl}
              alt="KYC Proof Document"
              className="max-h-[70vh] w-auto rounded-xl object-contain shadow-xs"
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
