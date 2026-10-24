"use client";

import { useEffect, useState, useMemo } from "react";
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
  Crown,
  Users,
  TrendingUp,
  IndianRupee,
  KeyRound,
  ShieldCheck,
  Briefcase,
  Layers,
  ArrowRight,
  UserMinus,
  Check,
  AlertCircle,
  Clock,
  Sparkles,
  Edit3,
  Lock,
  Boxes,
} from "lucide-react";
import type { EmployeeData } from "@/lib/types";
import { isEmployeeTeamLeader } from "@/lib/time";
import { formatCurrency, formatDate } from "@/lib/utils";

interface AllocatedCustomer {
  id: number;
  shopName: string;
  phoneNumber: string;
  city: string;
  businessType: string;
  creditDays?: number;
  outstanding: number;
  totalBilled?: number;
  totalPaid?: number;
}

interface EmployeePerformanceProfile {
  id: number;
  name: string;
  email?: string | null;
  mobileNumber: string;
  address: string;
  proofUrl?: string | null;
  designation: string;
  isTeamLeader: boolean;
  canEditOrders?: boolean;
  canUpdateStock?: boolean;
  isActive: boolean;
  createdAt?: string;
  stats: {
    totalOrders: number;
    totalRevenue: number;
    totalSets: number;
    totalPcs: number;
    allocatedCustomersCount: number;
    allocatedOutstanding: number;
  };
  allocatedCustomers: AllocatedCustomer[];
  recentOrders: any[];
}

interface PerformanceData {
  overview: {
    totalEmployees: number;
    activeEmployees: number;
    teamLeaders: number;
    totalCompanyTurnover: number;
    totalAllocatedCustomers: number;
    totalUnallocatedCustomers: number;
    totalAllocatedOutstanding: number;
  };
  employees: EmployeePerformanceProfile[];
  unallocatedCustomers: {
    id: number;
    shopName: string;
    phoneNumber: string;
    city: string;
    businessType: string;
    outstanding: number;
  }[];
  allCustomers: {
    id: number;
    shopName: string;
    phoneNumber: string;
    city: string;
    businessType: string;
    allocatedEmployeeId?: number | null;
    allocatedEmployeeName?: string | null;
    outstanding: number;
  }[];
}

export default function EmployeesPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"access" | "directory">("access");

  // Directory state
  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  const [loadingDirectory, setLoadingDirectory] = useState(true);
  const [searchDirectory, setSearchDirectory] = useState("");
  const [previewProofUrl, setPreviewProofUrl] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  // Access & Performance Hub state
  const [perfData, setPerfData] = useState<PerformanceData | null>(null);
  const [loadingPerf, setLoadingPerf] = useState(true);
  const [selectedEmpId, setSelectedEmpId] = useState<number | null>(null);
  const [empSearch, setEmpSearch] = useState("");
  const [customerFilterSearch, setCustomerFilterSearch] = useState("");

  // Allocation Modal State
  const [isAllocateModalOpen, setIsAllocateModalOpen] = useState(false);
  const [modalCustomerFilter, setModalCustomerFilter] = useState("");
  const [modalFilterType, setModalFilterType] = useState<"unallocated" | "all">("unallocated");
  const [selectedCustomerIdsToAllocate, setSelectedCustomerIdsToAllocate] = useState<number[]>([]);
  const [isSubmittingAllocation, setIsSubmittingAllocation] = useState(false);

  // PIN Reset Modal State
  const [pinModalEmp, setPinModalEmp] = useState<{ id: number; name: string } | null>(null);
  const [newPin, setNewPin] = useState("1234");
  const [isSavingPin, setIsSavingPin] = useState(false);

  // 1. Fetch Staff Directory
  const fetchEmployees = async () => {
    setLoadingDirectory(true);
    try {
      const url = searchDirectory
        ? `/api/employees?search=${encodeURIComponent(searchDirectory)}`
        : "/api/employees";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setEmployees(data);
      }
    } catch (err: any) {
      toast("Failed to load staff directory: " + err.message, "error");
    } finally {
      setLoadingDirectory(false);
    }
  };

  // 2. Fetch Performance & Allocation Hub Data
  const fetchPerformanceData = async () => {
    setLoadingPerf(true);
    try {
      const res = await fetch("/api/admin/employees/performance");
      if (res.ok) {
        const data: PerformanceData = await res.json();
        setPerfData(data);
        if (!selectedEmpId && data.employees && data.employees.length > 0) {
          setSelectedEmpId(data.employees[0].id);
        }
      } else {
        const err = await res.json();
        toast(err.error || "Failed to load performance metrics", "error");
      }
    } catch (err: any) {
      toast("Error fetching employee performance: " + err.message, "error");
    } finally {
      setLoadingPerf(false);
    }
  };

  useEffect(() => {
    fetchPerformanceData();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchEmployees();
    }, 250);
    return () => clearTimeout(timer);
  }, [searchDirectory]);

  // Handle Team Leader toggle
  const handleToggleTL = async (id: number, name: string, makeTL: boolean) => {
    try {
      setTogglingId(id);
      const res = await fetch(`/api/employees/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isTeamLeader: makeTL,
          designation: makeTL ? "Team Leader (T.L.)" : "Sales Representative",
        }),
      });

      if (res.ok) {
        toast(
          makeTL
            ? `⭐ "${name}" promoted to Team Leader (T.L.) with 24*7 portal access!`
            : `Removed T.L. status from "${name}". Standard working hours apply.`,
          "success"
        );
        fetchEmployees();
        fetchPerformanceData();
      } else {
        const err = await res.json();
        toast(err.error || "Failed to update employee role", "error");
      }
    } catch (err: any) {
      toast("Error: " + err.message, "error");
    } finally {
      setTogglingId(null);
    }
  };

  // Handle Order Form Editing permission toggle (Admin Approval)
  const handleToggleOrderEdit = async (id: number, name: string, allowEdit: boolean) => {
    try {
      setTogglingId(id);
      const res = await fetch(`/api/employees/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canEditOrders: allowEdit,
        }),
      });

      if (res.ok) {
        toast(
          allowEdit
            ? `✅ Order Form Editing access APPROVED for "${name}"!`
            : `🔒 Order Form Editing access REVOKED for "${name}".`,
          "success"
        );
        fetchEmployees();
        fetchPerformanceData();
      } else {
        const err = await res.json();
        toast(err.error || "Failed to update order editing permissions", "error");
      }
    } catch (err: any) {
      toast("Error: " + err.message, "error");
    } finally {
      setTogglingId(null);
    }
  };

  // Handle Inventory Stock Update permission toggle
  const handleToggleStockUpdate = async (id: number, name: string, allowStock: boolean) => {
    try {
      setTogglingId(id);
      const res = await fetch(`/api/employees/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canUpdateStock: allowStock,
        }),
      });

      if (res.ok) {
        toast(
          allowStock
            ? `✅ Stock Update access APPROVED for "${name}"!`
            : `🔒 Stock Update access REVOKED for "${name}".`,
          "success"
        );
        fetchEmployees();
        fetchPerformanceData();
      } else {
        const err = await res.json();
        toast(err.error || "Failed to update stock update permissions", "error");
      }
    } catch (err: any) {
      toast("Error: " + err.message, "error");
    } finally {
      setTogglingId(null);
    }
  };

  // Handle Active/Inactive status toggle
  const handleToggleActive = async (id: number, name: string, currentActive: boolean) => {
    try {
      setTogglingId(id);
      const res = await fetch(`/api/employees/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isActive: !currentActive,
        }),
      });

      if (res.ok) {
        toast(
          !currentActive
            ? `Activated "${name}". Staff can now log in and take orders.`
            : `Deactivated "${name}". Staff access suspended.`,
          "success"
        );
        fetchEmployees();
        fetchPerformanceData();
      } else {
        const err = await res.json();
        toast(err.error || "Failed to update employee status", "error");
      }
    } catch (err: any) {
      toast("Error: " + err.message, "error");
    } finally {
      setTogglingId(null);
    }
  };

  // Handle PIN Reset
  const handleSavePin = async () => {
    if (!pinModalEmp) return;
    if (!newPin || newPin.trim().length < 4) {
      toast("Please enter a valid PIN (at least 4 digits)", "error");
      return;
    }

    setIsSavingPin(true);
    try {
      const res = await fetch(`/api/employees/${pinModalEmp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: newPin.trim() }),
      });

      if (res.ok) {
        toast(`PIN for "${pinModalEmp.name}" successfully updated!`, "success");
        setPinModalEmp(null);
        setNewPin("1234");
      } else {
        const err = await res.json();
        toast(err.error || "Failed to reset PIN", "error");
      }
    } catch (err: any) {
      toast("Error: " + err.message, "error");
    } finally {
      setIsSavingPin(false);
    }
  };

  // Handle Delete Employee
  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to delete employee "${name}"? This cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/employees/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast("Employee record removed successfully", "success");
        fetchEmployees();
        fetchPerformanceData();
      } else {
        const err = await res.json();
        toast(err.error || "Failed to delete employee", "error");
      }
    } catch (err: any) {
      toast("Error: " + err.message, "error");
    }
  };

  // Handle Unallocate single customer
  const handleUnallocateCustomer = async (customerId: number, shopName: string, empName: string) => {
    if (!confirm(`Unallocate customer "${shopName}" from "${empName}"?`)) return;

    try {
      const res = await fetch("/api/admin/employees/allocate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "unallocate",
          customerIds: [customerId],
        }),
      });

      if (res.ok) {
        toast(`Removed customer "${shopName}" from allocation`, "success");
        fetchPerformanceData();
      } else {
        const err = await res.json();
        toast(err.error || "Failed to unallocate customer", "error");
      }
    } catch (err: any) {
      toast("Error: " + err.message, "error");
    }
  };

  // Handle Batch Customer Allocation
  const handleConfirmAllocation = async () => {
    if (!selectedEmpId || selectedCustomerIdsToAllocate.length === 0) {
      toast("Please select at least 1 customer to allocate.", "error");
      return;
    }

    setIsSubmittingAllocation(true);
    try {
      const res = await fetch("/api/admin/employees/allocate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: selectedEmpId,
          customerIds: selectedCustomerIdsToAllocate,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast(data.message || "Customers allocated successfully!", "success");
        setIsAllocateModalOpen(false);
        setSelectedCustomerIdsToAllocate([]);
        fetchPerformanceData();
      } else {
        toast(data.error || "Failed to allocate customers", "error");
      }
    } catch (err: any) {
      toast("Error: " + err.message, "error");
    } finally {
      setIsSubmittingAllocation(false);
    }
  };

  // Currently selected employee profile for detailed breakdown
  const selectedProfile = useMemo(() => {
    if (!perfData?.employees) return null;
    return perfData.employees.find((e) => e.id === selectedEmpId) || perfData.employees[0] || null;
  }, [perfData, selectedEmpId]);

  // Filtered employees list for left selection panel
  const filteredEmployeeProfiles = useMemo(() => {
    if (!perfData?.employees) return [];
    if (!empSearch.trim()) return perfData.employees;
    const term = empSearch.toLowerCase().trim();
    return perfData.employees.filter(
      (e) =>
        e.name.toLowerCase().includes(term) ||
        e.mobileNumber.toLowerCase().includes(term) ||
        e.designation.toLowerCase().includes(term)
    );
  }, [perfData, empSearch]);

  // Filtered customer list inside the allocate modal
  const modalCustomersList = useMemo(() => {
    if (!perfData) return [];
    const source =
      modalFilterType === "unallocated"
        ? perfData.unallocatedCustomers
        : perfData.allCustomers;

    if (!modalCustomerFilter.trim()) return source;
    const term = modalCustomerFilter.toLowerCase().trim();
    return source.filter(
      (c: any) =>
        c.shopName.toLowerCase().includes(term) ||
        c.phoneNumber.toLowerCase().includes(term) ||
        (c.city && c.city.toLowerCase().includes(term))
    );
  }, [perfData, modalFilterType, modalCustomerFilter]);

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-orange-600 mb-1">
            <UserCheck size={14} /> Employee Management &amp; Customer Allocations
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Employee Control &amp; Allocation Hub
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Allocate customer portfolios to sales agents, inspect live salesperson performance, track customer outstanding, and configure 24*7 Team Leader access.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            type="button"
            onClick={() => {
              fetchPerformanceData();
              fetchEmployees();
            }}
            disabled={loadingPerf || loadingDirectory}
            className="p-2.5 bg-white border border-gray-300 rounded-xl text-gray-600 hover:bg-gray-50 shadow-2xs transition-colors cursor-pointer"
            title="Refresh all metrics"
          >
            <RefreshCw size={16} className={loadingPerf || loadingDirectory ? "animate-spin text-zinc-900" : ""} />
          </button>

          <Link
            href="/admin/employees/new"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-zinc-950 hover:bg-black text-white font-semibold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus size={16} />
            <span>Add New Employee</span>
          </Link>
        </div>
      </div>

      {/* Top Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setActiveTab("access")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === "access"
              ? "border-orange-600 text-orange-600 bg-orange-50/50 rounded-t-xl"
              : "border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300"
          }`}
        >
          <Sparkles size={14} className={activeTab === "access" ? "text-orange-600" : "text-gray-400"} />
          <span>Access, Allocation &amp; Performance</span>
          {perfData?.overview && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-orange-100 text-orange-800 font-bold">
              {perfData.overview.totalEmployees}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("directory")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === "directory"
              ? "border-orange-600 text-orange-600 bg-orange-50/50 rounded-t-xl"
              : "border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300"
          }`}
        >
          <Users size={14} className={activeTab === "directory" ? "text-orange-600" : "text-gray-400"} />
          <span>Staff Directory &amp; KYC</span>
          <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-gray-100 text-gray-700 font-bold">
            {employees.length}
          </span>
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          TAB 1: ACCESS, ALLOCATION & PERFORMANCE
          ══════════════════════════════════════════════════════════════ */}
      {activeTab === "access" && (
        <div className="space-y-6">
          {/* Key KPI Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Turnover */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200/90 shadow-2xs">
              <div className="flex items-center justify-between text-gray-500 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Total Staff Turnover
                </span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <TrendingUp size={16} />
                </div>
              </div>
              <div className="text-2xl font-black text-gray-900 font-mono">
                {loadingPerf ? "..." : formatCurrency(perfData?.overview.totalCompanyTurnover || 0)}
              </div>
              <div className="text-[11px] text-gray-500 mt-1">
                Generated across all active sales orders
              </div>
            </div>

            {/* Active Sales Staff */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200/90 shadow-2xs">
              <div className="flex items-center justify-between text-gray-500 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Sales Force Status
                </span>
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <UserCheck size={16} />
                </div>
              </div>
              <div className="text-2xl font-black text-gray-900 font-mono flex items-baseline gap-2">
                <span>{loadingPerf ? "..." : perfData?.overview.activeEmployees || 0}</span>
                <span className="text-xs font-semibold text-gray-400">
                  / {perfData?.overview.totalEmployees || 0} active
                </span>
              </div>
              <div className="text-[11px] text-amber-600 font-medium mt-1 flex items-center gap-1">
                <Crown size={12} />
                <span>{perfData?.overview.teamLeaders || 0} Team Leader(s) with 24*7 rights</span>
              </div>
            </div>

            {/* Allocated Customers */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200/90 shadow-2xs">
              <div className="flex items-center justify-between text-gray-500 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Customer Portfolios
                </span>
                <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
                  <Briefcase size={16} />
                </div>
              </div>
              <div className="text-2xl font-black text-gray-900 font-mono flex items-baseline gap-2">
                <span>{loadingPerf ? "..." : perfData?.overview.totalAllocatedCustomers || 0}</span>
                <span className="text-xs font-semibold text-gray-400">allocated</span>
              </div>
              <div className="text-[11px] text-gray-500 mt-1">
                <span className="font-bold text-amber-700">
                  {perfData?.overview.totalUnallocatedCustomers || 0} unallocated
                </span>{" "}
                shops pending assignment
              </div>
            </div>

            {/* Allocated Customer Outstanding */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200/90 shadow-2xs">
              <div className="flex items-center justify-between text-gray-500 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Allocated Outstanding
                </span>
                <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                  <IndianRupee size={16} />
                </div>
              </div>
              <div className="text-2xl font-black text-red-600 font-mono">
                {loadingPerf ? "..." : formatCurrency(perfData?.overview.totalAllocatedOutstanding || 0)}
              </div>
              <div className="text-[11px] text-gray-500 mt-1">
                Total credit balance across assigned customers
              </div>
            </div>
          </div>

          {/* Main 2-Column Command Workspace */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Employee Selection List (4 cols) */}
            <div className="lg:col-span-4 bg-white rounded-2xl border border-gray-200 shadow-2xs p-4 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                <div className="text-xs font-bold uppercase tracking-wider text-gray-600 flex items-center gap-1.5">
                  <Users size={14} className="text-orange-600" />
                  <span>Select Employee ({filteredEmployeeProfiles.length})</span>
                </div>
              </div>

              {/* Search Employee */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
                <input
                  type="text"
                  value={empSearch}
                  onChange={(e) => setEmpSearch(e.target.value)}
                  placeholder="Filter by agent name or phone..."
                  className="w-full pl-9 pr-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white"
                />
              </div>

              {/* Employee Cards List */}
              <div className="space-y-2 max-h-[680px] overflow-y-auto pr-1">
                {loadingPerf && !perfData ? (
                  <div className="p-6 text-center text-xs text-gray-400">Loading staff profiles...</div>
                ) : filteredEmployeeProfiles.length === 0 ? (
                  <div className="p-6 text-center text-xs text-gray-400">No matching employees found</div>
                ) : (
                  filteredEmployeeProfiles.map((emp) => {
                    const isSelected = selectedEmpId === emp.id;
                    return (
                      <div
                        key={emp.id}
                        onClick={() => setSelectedEmpId(emp.id)}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? "bg-orange-50/60 border-orange-300 ring-2 ring-orange-500/20 shadow-xs"
                            : "bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50/50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-zinc-900 text-amber-400 flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                              {emp.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-xs text-gray-900 flex items-center gap-1.5">
                                <span>{emp.name}</span>
                                {emp.isTeamLeader && (
                                  <span className="inline-flex items-center gap-0.5 bg-amber-100 text-amber-800 text-[8px] font-black px-1.5 py-0.2 rounded-full border border-amber-300">
                                    <Crown size={9} className="text-amber-600" /> T.L.
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-gray-400 font-mono">
                                {emp.mobileNumber}
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                emp.isActive
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-gray-100 text-gray-500"
                              }`}
                            >
                              {emp.isActive ? "Active" : "Inactive"}
                            </span>
                          </div>
                        </div>

                        {/* Metric Highlights */}
                        <div className="mt-3 pt-2.5 border-t border-gray-100 grid grid-cols-2 gap-2 text-[10px]">
                          <div>
                            <span className="text-gray-400 block">Orders Booked:</span>
                            <span className="font-bold text-gray-800 font-mono">
                              {emp.stats.totalOrders} ({formatCurrency(emp.stats.totalRevenue)})
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-gray-400 block">Customers / Due:</span>
                            <span className="font-bold text-orange-700 font-mono">
                              {emp.stats.allocatedCustomersCount} shops ({formatCurrency(emp.stats.allocatedOutstanding)})
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right: Selected Employee Workspace (8 cols) */}
            <div className="lg:col-span-8 space-y-6">
              {selectedProfile ? (
                <>
                  {/* Employee Control Card */}
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-zinc-950 text-amber-400 flex items-center justify-center font-bold text-lg shadow-xs">
                          {selectedProfile.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="text-lg font-black text-gray-900 tracking-tight">
                              {selectedProfile.name}
                            </h2>
                            {selectedProfile.isTeamLeader ? (
                              <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-300">
                                <Crown size={12} className="text-amber-600" /> 24*7 Team Leader
                              </span>
                            ) : (
                              <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                                Standard Staff (Working Hours Only)
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 flex items-center gap-3 mt-1 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Phone size={12} className="text-gray-400" /> {selectedProfile.mobileNumber}
                            </span>
                            {selectedProfile.email && (
                              <span className="flex items-center gap-1">
                                <Mail size={12} className="text-gray-400" /> {selectedProfile.email}
                              </span>
                            )}
                            <span className="flex items-center gap-1 font-mono text-[11px] text-gray-400">
                              EMP-{String(selectedProfile.id).padStart(4, "0")}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Fast Access Action Controls */}
                      <div className="flex flex-wrap items-center gap-2">
                        {/* PIN Reset Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setPinModalEmp({ id: selectedProfile.id, name: selectedProfile.name });
                            setNewPin("1234");
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition cursor-pointer"
                          title="Reset employee login PIN"
                        >
                          <KeyRound size={13} className="text-gray-500" />
                          <span>Reset PIN</span>
                        </button>

                        {/* T.L. Toggle */}
                        {selectedProfile.isTeamLeader ? (
                          <button
                            type="button"
                            onClick={() => handleToggleTL(selectedProfile.id, selectedProfile.name, false)}
                            disabled={togglingId === selectedProfile.id}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-50 hover:bg-red-50 text-amber-800 hover:text-red-700 border border-amber-300 hover:border-red-300 text-xs font-bold rounded-xl transition cursor-pointer disabled:opacity-50"
                            title="Remove Team Leader 24*7 rights"
                          >
                            <Crown size={13} />
                            <span>Remove T.L.</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleTL(selectedProfile.id, selectedProfile.name, true)}
                            disabled={togglingId === selectedProfile.id}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 hover:border-orange-300 text-xs font-bold rounded-xl transition cursor-pointer disabled:opacity-50"
                            title="Grant Team Leader status (24*7 portal access)"
                          >
                            <Crown size={13} className="text-orange-600" />
                            <span>Make T.L. (24*7)</span>
                          </button>
                        )}

                        {/* Active / Inactive Toggle */}
                        <button
                          type="button"
                          onClick={() =>
                            handleToggleActive(selectedProfile.id, selectedProfile.name, selectedProfile.isActive)
                          }
                          disabled={togglingId === selectedProfile.id}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border transition cursor-pointer disabled:opacity-50 ${
                            selectedProfile.isActive
                              ? "bg-emerald-50 hover:bg-red-50 text-emerald-800 hover:text-red-700 border-emerald-300 hover:border-red-300"
                              : "bg-gray-100 hover:bg-emerald-50 text-gray-700 hover:text-emerald-700 border-gray-300"
                          }`}
                        >
                          {selectedProfile.isActive ? (
                            <>
                              <CheckCircle size={13} className="text-emerald-600" />
                              <span>Active Access</span>
                            </>
                          ) : (
                            <>
                              <XCircle size={13} className="text-gray-400" />
                              <span>Inactive (Suspended)</span>
                            </>
                          )}
                        </button>

                        {/* Order Form Edit Permission (Admin Approval) */}
                        {selectedProfile.canEditOrders ? (
                          <button
                            type="button"
                            onClick={() => handleToggleOrderEdit(selectedProfile.id, selectedProfile.name, false)}
                            disabled={togglingId === selectedProfile.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-red-50 text-blue-800 hover:text-red-700 border border-blue-300 hover:border-red-300 text-xs font-bold rounded-xl transition cursor-pointer disabled:opacity-50"
                            title="Revoke Admin approval to edit pending orders"
                          >
                            <Edit3 size={13} className="text-blue-600" />
                            <span>Revoke Edit Access</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleOrderEdit(selectedProfile.id, selectedProfile.name, true)}
                            disabled={togglingId === selectedProfile.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-blue-50 text-gray-700 hover:text-blue-700 border border-gray-300 hover:border-blue-300 text-xs font-bold rounded-xl transition cursor-pointer disabled:opacity-50"
                            title="Grant Admin approval to edit pending order forms"
                          >
                            <Edit3 size={13} className="text-gray-500" />
                            <span>Approve Edit Access</span>
                          </button>
                        )}

                        {/* Inventory Stock Update Permission */}
                        {selectedProfile.canUpdateStock ? (
                          <button
                            type="button"
                            onClick={() => handleToggleStockUpdate(selectedProfile.id, selectedProfile.name, false)}
                            disabled={togglingId === selectedProfile.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-red-50 text-emerald-800 hover:text-red-700 border border-emerald-300 hover:border-red-300 text-xs font-bold rounded-xl transition cursor-pointer disabled:opacity-50"
                            title="Revoke Stock Update Access"
                          >
                            <Boxes size={13} className="text-emerald-600" />
                            <span>Revoke Stock Access</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleStockUpdate(selectedProfile.id, selectedProfile.name, true)}
                            disabled={togglingId === selectedProfile.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-emerald-50 text-gray-700 hover:text-emerald-700 border border-gray-300 hover:border-emerald-300 text-xs font-bold rounded-xl transition cursor-pointer disabled:opacity-50"
                            title="Grant Stock Update Access to this employee"
                          >
                            <Boxes size={13} className="text-gray-500" />
                            <span>Allow Stock Update</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Sales Metrics Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-1">
                      <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                          Total Revenue
                        </span>
                        <span className="text-base font-black text-gray-900 font-mono">
                          {formatCurrency(selectedProfile.stats.totalRevenue)}
                        </span>
                      </div>

                      <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                          Orders Booked
                        </span>
                        <span className="text-base font-black text-gray-900 font-mono">
                          {selectedProfile.stats.totalOrders}
                        </span>
                      </div>

                      <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                          Volume Sold
                        </span>
                        <span className="text-base font-black text-gray-900 font-mono">
                          {selectedProfile.stats.totalSets}s / {selectedProfile.stats.totalPcs}p
                        </span>
                      </div>

                      <div className="p-3 bg-orange-50/60 rounded-xl border border-orange-200/80">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-orange-700 block">
                          Customer Outstanding
                        </span>
                        <span className="text-base font-black text-orange-800 font-mono">
                          {formatCurrency(selectedProfile.stats.allocatedOutstanding)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Customer Allocation Manager */}
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs overflow-hidden">
                    <div className="p-4 sm:p-5 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50/50">
                      <div>
                        <div className="flex items-center gap-2">
                          <Briefcase size={16} className="text-orange-600" />
                          <h3 className="font-bold text-sm text-gray-900">
                            Allocated Customers ({selectedProfile.allocatedCustomers.length})
                          </h3>
                        </div>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          These customers will appear prominently on <strong>{selectedProfile.name}</strong>'s wholesale dashboard and order form.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCustomerIdsToAllocate([]);
                          setModalCustomerFilter("");
                          setModalFilterType("unallocated");
                          setIsAllocateModalOpen(true);
                        }}
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer self-start sm:self-auto"
                      >
                        <Plus size={14} />
                        <span>+ Allocate Customers</span>
                      </button>
                    </div>

                    {/* Allocated Customers Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-gray-50 text-[11px] font-bold uppercase tracking-wider text-gray-500 border-b border-gray-200">
                            <th className="py-3 px-4">Firm / Shop Name</th>
                            <th className="py-3 px-4">Phone Number</th>
                            <th className="py-3 px-4">City</th>
                            <th className="py-3 px-4">Business Type</th>
                            <th className="py-3 px-4 text-right">Outstanding (Due)</th>
                            <th className="py-3 px-4 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {selectedProfile.allocatedCustomers.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-10 text-center text-gray-400">
                                <div className="space-y-1">
                                  <Briefcase size={24} className="mx-auto text-gray-300 mb-1" />
                                  <p className="font-medium text-xs text-gray-500">
                                    No customers allocated to {selectedProfile.name} yet.
                                  </p>
                                  <p className="text-[11px] text-gray-400">
                                    Click <strong>"+ Allocate Customers"</strong> to assign customer accounts.
                                  </p>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            selectedProfile.allocatedCustomers.map((cust) => (
                              <tr key={cust.id} className="hover:bg-gray-50/60 transition">
                                <td className="py-3 px-4 font-bold text-gray-900 uppercase">
                                  {cust.shopName}
                                </td>
                                <td className="py-3 px-4 font-mono text-gray-700">
                                  {cust.phoneNumber}
                                </td>
                                <td className="py-3 px-4 text-gray-600">{cust.city}</td>
                                <td className="py-3 px-4">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-700">
                                    {cust.businessType}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right font-mono font-bold">
                                  {cust.outstanding > 0 ? (
                                    <span className="text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded text-xs">
                                      {formatCurrency(cust.outstanding)}
                                    </span>
                                  ) : (
                                    <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[10px]">
                                      ✓ Cleared
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleUnallocateCustomer(cust.id, cust.shopName, selectedProfile.name)
                                    }
                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 hover:text-red-800 hover:underline cursor-pointer"
                                    title="Unallocate customer from this employee"
                                  >
                                    <UserMinus size={12} />
                                    <span>Unallocate</span>
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Recent Orders Placed by Employee */}
                  {selectedProfile.recentOrders && selectedProfile.recentOrders.length > 0 && (
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs overflow-hidden">
                      <div className="p-4 border-b border-gray-200 bg-gray-50/50 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Layers size={16} className="text-orange-600" />
                          <h3 className="font-bold text-sm text-gray-900">
                            Recent Orders Booked by {selectedProfile.name}
                          </h3>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-gray-50 text-[11px] font-bold uppercase tracking-wider text-gray-500 border-b border-gray-200">
                              <th className="py-3 px-4">Order #</th>
                              <th className="py-3 px-4">Customer</th>
                              <th className="py-3 px-4">Volume</th>
                              <th className="py-3 px-4 text-right">Grand Total</th>
                              <th className="py-3 px-4">Status</th>
                              <th className="py-3 px-4 text-right">Date</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {selectedProfile.recentOrders.map((ord: any) => (
                              <tr key={ord.id} className="hover:bg-gray-50/60 transition">
                                <td className="py-3 px-4 font-mono font-bold text-gray-900">
                                  <Link
                                    href={`/admin/orders?search=${encodeURIComponent(ord.orderNumber)}`}
                                    className="hover:text-orange-600 hover:underline"
                                  >
                                    {ord.orderNumber}
                                  </Link>
                                </td>
                                <td className="py-3 px-4 font-semibold text-gray-800 uppercase">
                                  {ord.customerName}
                                </td>
                                <td className="py-3 px-4 font-mono text-gray-600">
                                  {ord.totalSets}s / {ord.totalPcs}p
                                </td>
                                <td className="py-3 px-4 text-right font-mono font-bold text-gray-900">
                                  {formatCurrency(ord.grandTotal || 0)}
                                </td>
                                <td className="py-3 px-4">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-800">
                                    {ord.status}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right text-gray-500">
                                  {formatDate(ord.orderDate || ord.createdAt)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-12 text-center text-gray-400 bg-white rounded-2xl border border-gray-200">
                  Select an employee from the left panel to inspect their performance &amp; customer allocations.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          TAB 2: STAFF DIRECTORY & KYC
          ══════════════════════════════════════════════════════════════ */}
      {activeTab === "directory" && (
        <div className="space-y-4">
          {/* Toolbar & Filters */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3.5 top-3 text-gray-400" />
              <input
                type="text"
                value={searchDirectory}
                onChange={(e) => setSearchDirectory(e.target.value)}
                placeholder="Search staff by name, mobile, address..."
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-zinc-900 focus:outline-none shadow-2xs"
              />
            </div>
          </div>

          {/* Directory Table Card */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-200 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                    <th className="py-3.5 px-6">Employee Name</th>
                    <th className="py-3.5 px-6">Designation</th>
                    <th className="py-3.5 px-6">T.L. Status (24*7 Access)</th>
                    <th className="py-3.5 px-6">Order Edit Access</th>
                    <th className="py-3.5 px-6">Stock Update Access</th>
                    <th className="py-3.5 px-6">Email Address</th>
                    <th className="py-3.5 px-6">Mobile Number</th>
                    <th className="py-3.5 px-6">Residential Address</th>
                    <th className="py-3.5 px-6">KYC / ID Proof</th>
                    <th className="py-3.5 px-6">Status</th>
                    <th className="py-3.5 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loadingDirectory && employees.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-gray-400">
                        Loading employees...
                      </td>
                    </tr>
                  ) : employees.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-gray-400">
                        No employees registered yet. Click "Add New Employee" to create a staff record.
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
                              <div className="font-bold text-gray-900 flex items-center gap-1.5">
                                <span>{emp.name}</span>
                                {isEmployeeTeamLeader(emp) && (
                                  <span className="inline-flex items-center gap-0.5 bg-amber-100 text-amber-800 text-[9px] font-black px-1.5 py-0.2 rounded-full border border-amber-300">
                                    <Crown size={10} className="text-amber-600" /> T.L.
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-gray-400 font-mono">
                                  EMP-{String(emp.id).padStart(4, "0")}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPinModalEmp({ id: emp.id, name: emp.name });
                                    setNewPin("1234");
                                  }}
                                  className="text-[10px] bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 px-1.5 py-0.2 rounded font-mono font-bold cursor-pointer"
                                  title="Click to reset PIN"
                                >
                                  PIN: {emp.pin || "••••"} ↺
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-800">
                            {emp.designation}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          {isEmployeeTeamLeader(emp) ? (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-900 border border-amber-300 rounded-full text-xs font-bold shadow-2xs">
                                <Crown size={12} className="text-amber-600 shrink-0" />
                                <span>T.L. (24*7)</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => handleToggleTL(emp.id, emp.name, false)}
                                disabled={togglingId === emp.id}
                                className="text-[11px] font-semibold text-gray-500 hover:text-red-600 hover:underline cursor-pointer disabled:opacity-50"
                                title="Remove T.L. status"
                              >
                                Remove
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500">
                                Staff
                              </span>
                              <button
                                type="button"
                                onClick={() => handleToggleTL(emp.id, emp.name, true)}
                                disabled={togglingId === emp.id}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 hover:border-orange-300 rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer disabled:opacity-50"
                                title="Promote to Team Leader (Grants 24*7 unlimited portal access)"
                              >
                                <Crown size={12} className="text-orange-600" />
                                <span>Make T.L.</span>
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-6">
                          {emp.canEditOrders ? (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-900 border border-blue-300 rounded-full text-xs font-bold shadow-2xs">
                                <CheckCircle size={12} className="text-blue-600 shrink-0" />
                                <span>Approved</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => handleToggleOrderEdit(emp.id, emp.name, false)}
                                disabled={togglingId === emp.id}
                                className="text-[11px] font-semibold text-gray-500 hover:text-red-600 hover:underline cursor-pointer disabled:opacity-50"
                                title="Revoke Order Form Edit Access"
                              >
                                Revoke
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500">
                                <Lock size={10} className="text-gray-400 shrink-0" />
                                <span>Locked</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => handleToggleOrderEdit(emp.id, emp.name, true)}
                                disabled={togglingId === emp.id}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 hover:border-blue-300 rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer disabled:opacity-50"
                                title="Approve employee to edit pending order forms"
                              >
                                <Edit3 size={12} className="text-blue-600" />
                                <span>Approve</span>
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-6">
                          {emp.canUpdateStock ? (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-900 border border-emerald-300 rounded-full text-xs font-bold shadow-2xs">
                                <CheckCircle size={12} className="text-emerald-600 shrink-0" />
                                <span>Allowed</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => handleToggleStockUpdate(emp.id, emp.name, false)}
                                disabled={togglingId === emp.id}
                                className="text-[11px] font-semibold text-gray-500 hover:text-red-600 hover:underline cursor-pointer disabled:opacity-50"
                                title="Revoke Stock Update Access"
                              >
                                Revoke
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500">
                                <Lock size={10} className="text-gray-400 shrink-0" />
                                <span>Locked</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => handleToggleStockUpdate(emp.id, emp.name, true)}
                                disabled={togglingId === emp.id}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 hover:border-emerald-300 rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer disabled:opacity-50"
                                title="Grant Stock Update Access to this employee"
                              >
                                <Boxes size={12} className="text-emerald-600" />
                                <span>Allow</span>
                              </button>
                            </div>
                          )}
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
                          <button
                            type="button"
                            onClick={() => handleToggleActive(emp.id, emp.name, emp.isActive)}
                            disabled={togglingId === emp.id}
                            className="cursor-pointer"
                            title="Click to toggle Active/Inactive"
                          >
                            {emp.isActive ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold rounded-full hover:bg-red-50 hover:text-red-800 hover:border-red-300 transition">
                                <CheckCircle size={12} /> Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded-full hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300 transition">
                                <XCircle size={12} /> Inactive
                              </span>
                            )}
                          </button>
                        </td>
                        <td className="py-4 px-6 text-right space-x-2">
                          <Link
                            href={`/admin/employees/${emp.id}/edit`}
                            className="p-1.5 inline-flex text-gray-500 hover:text-black hover:bg-gray-100 rounded-lg transition-colors"
                            title="Edit Employee profile"
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
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          MODAL: ALLOCATE CUSTOMERS TO SELECTED EMPLOYEE
          ══════════════════════════════════════════════════════════════ */}
      {isAllocateModalOpen && selectedProfile && (
        <Modal
          isOpen={isAllocateModalOpen}
          onClose={() => setIsAllocateModalOpen(false)}
          title={`Allocate Customers to "${selectedProfile.name}"`}
          size="lg"
        >
          <div className="space-y-4">
            <p className="text-xs text-gray-500">
              Select one or more retail/wholesale accounts to assign to <strong>{selectedProfile.name}</strong>. These accounts will be prioritized on their dashboard and new order forms.
            </p>

            {/* Filter Tabs & Search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setModalFilterType("unallocated")}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    modalFilterType === "unallocated"
                      ? "bg-white text-orange-600 shadow-2xs font-bold"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Unallocated Only ({perfData?.unallocatedCustomers.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setModalFilterType("all")}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    modalFilterType === "all"
                      ? "bg-white text-orange-600 shadow-2xs font-bold"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  All Customers ({perfData?.allCustomers.length || 0})
                </button>
              </div>

              <div className="relative flex-1 sm:max-w-xs">
                <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
                <input
                  type="text"
                  value={modalCustomerFilter}
                  onChange={(e) => setModalCustomerFilter(e.target.value)}
                  placeholder="Search shop, phone, city..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white uppercase placeholder:normal-case"
                />
              </div>
            </div>

            {/* Select All Toggle */}
            <div className="flex items-center justify-between px-1 text-xs">
              <label className="flex items-center gap-2 cursor-pointer font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={
                    modalCustomersList.length > 0 &&
                    modalCustomersList.every((c: any) => selectedCustomerIdsToAllocate.includes(c.id))
                  }
                  onChange={(e) => {
                    if (e.target.checked) {
                      const ids = modalCustomersList.map((c: any) => c.id);
                      setSelectedCustomerIdsToAllocate(Array.from(new Set([...selectedCustomerIdsToAllocate, ...ids])));
                    } else {
                      const idsToRemove = new Set(modalCustomersList.map((c: any) => c.id));
                      setSelectedCustomerIdsToAllocate(selectedCustomerIdsToAllocate.filter((id) => !idsToRemove.has(id)));
                    }
                  }}
                  className="rounded text-orange-600 focus:ring-orange-500"
                />
                <span>Select All Shown ({modalCustomersList.length})</span>
              </label>

              <span className="font-bold text-orange-600 font-mono">
                {selectedCustomerIdsToAllocate.length} selected
              </span>
            </div>

            {/* Customers Checkbox List */}
            <div className="max-h-80 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100">
              {modalCustomersList.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-400">
                  No customers found matching filter criteria.
                </div>
              ) : (
                modalCustomersList.map((cust: any) => {
                  const isChecked = selectedCustomerIdsToAllocate.includes(cust.id);
                  const isAlreadyAllocatedToSelected = cust.allocatedEmployeeId === selectedProfile.id;
                  const isAllocatedToOther = cust.allocatedEmployeeId && cust.allocatedEmployeeId !== selectedProfile.id;

                  return (
                    <label
                      key={cust.id}
                      className={`flex items-center justify-between p-3 cursor-pointer transition text-xs ${
                        isChecked ? "bg-orange-50/70" : "hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedCustomerIdsToAllocate([...selectedCustomerIdsToAllocate, cust.id]);
                            } else {
                              setSelectedCustomerIdsToAllocate(
                                selectedCustomerIdsToAllocate.filter((id) => id !== cust.id)
                              );
                            }
                          }}
                          className="rounded text-orange-600 focus:ring-orange-500"
                        />
                        <div>
                          <div className="font-bold text-gray-900 uppercase flex items-center gap-2">
                            <span>{cust.shopName}</span>
                            {isAlreadyAllocatedToSelected && (
                              <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.2 rounded font-semibold">
                                Currently Assigned
                              </span>
                            )}
                            {isAllocatedToOther && (
                              <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.2 rounded font-semibold">
                                Reassigns from {cust.allocatedEmployeeName || "Other"}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-gray-500 flex items-center gap-2 mt-0.5 font-mono">
                            <span>{cust.phoneNumber}</span>
                            <span>•</span>
                            <span>{cust.city || "—"}</span>
                            <span>•</span>
                            <span>{cust.businessType}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        {cust.outstanding > 0 ? (
                          <span className="text-red-600 font-mono font-bold text-xs">
                            {formatCurrency(cust.outstanding)}
                          </span>
                        ) : (
                          <span className="text-gray-400 font-mono text-[11px]">₹0</span>
                        )}
                      </div>
                    </label>
                  );
                })
              )}
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-gray-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsAllocateModalOpen(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmAllocation}
                disabled={isSubmittingAllocation || selectedCustomerIdsToAllocate.length === 0}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                {isSubmittingAllocation ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Allocating...</span>
                  </>
                ) : (
                  <>
                    <Check size={14} />
                    <span>Allocate {selectedCustomerIdsToAllocate.length} Customer(s)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ══════════════════════════════════════════════════════════════
          MODAL: RESET EMPLOYEE PIN
          ══════════════════════════════════════════════════════════════ */}
      {pinModalEmp && (
        <Modal
          isOpen={!!pinModalEmp}
          onClose={() => setPinModalEmp(null)}
          title={`Reset Login PIN for "${pinModalEmp.name}"`}
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-xs text-gray-500">
              Enter a new 4-digit security PIN for this staff member to use when logging in to the wholesale ordering portal.
            </p>

            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">
                New 4-Digit PIN
              </label>
              <input
                type="text"
                maxLength={6}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                placeholder="e.g. 1234"
                className="w-full px-3 py-2 text-center text-lg font-mono font-bold tracking-widest bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:bg-white"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setNewPin("1234")}
                className="text-[11px] font-bold text-orange-600 bg-orange-50 hover:bg-orange-100 border border-orange-200 px-2.5 py-1 rounded-lg transition cursor-pointer"
              >
                Set Default: 1234
              </button>
            </div>

            <div className="pt-3 border-t border-gray-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setPinModalEmp(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSavePin}
                disabled={isSavingPin || newPin.length < 4}
                className="px-5 py-2.5 bg-zinc-950 hover:bg-black text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                {isSavingPin ? "Saving PIN..." : "Update PIN"}
              </button>
            </div>
          </div>
        </Modal>
      )}

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
