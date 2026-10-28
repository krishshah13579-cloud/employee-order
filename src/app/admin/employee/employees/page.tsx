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
  Pencil,
  ChevronDown,
  ChevronUp,
  MoreVertical,
  CheckSquare,
  Square,
  Smartphone,
  Copy,
  ExternalLink,
  Ban,
  Laptop,
  Send,
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
  canAddPreviousBills?: boolean;
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

interface AuthorizedDeviceItem {
  id: number;
  deviceId: string;
  name: string | null;
  role: string;
  employeeId: number | null;
  employeeName: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  isActive: boolean;
  lastUsedAt: string;
  createdAt: string;
}

interface DeviceInviteItem {
  id: number;
  inviteCode: string;
  employeeId: number | null;
  employeeName: string | null;
  role: string;
  isUsed: boolean;
  usedAt: string | null;
  usedDeviceId: string | null;
  expiresAt: string;
  createdBy: string;
  createdAt: string;
}

export default function EmployeesPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"access" | "directory" | "devices">("access");

  // Device Security & Blackout Gate state
  const [devices, setDevices] = useState<AuthorizedDeviceItem[]>([]);
  const [invites, setInvites] = useState<DeviceInviteItem[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [deviceModalOpen, setDeviceModalOpen] = useState(false);
  const [selectedDeviceEmpId, setSelectedDeviceEmpId] = useState<string>("");
  const [generatedInvite, setGeneratedInvite] = useState<{
    accessUrl: string;
    whatsappShareUrl: string;
    employeeName: string;
    expiresAt: string;
    inviteCode: string;
    directSent?: boolean;
    mobileNumber?: string;
  } | null>(null);
  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);
  const [isSendingDirect, setIsSendingDirect] = useState(false);
  const [revokingDeviceId, setRevokingDeviceId] = useState<string | null>(null);

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
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [isAllocatedOpen, setIsAllocatedOpen] = useState(false);
  const [isRecentOrdersOpen, setIsRecentOrdersOpen] = useState(false);

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

  // Fetch Authorized Devices and Invites
  const fetchDevices = async () => {
    setLoadingDevices(true);
    try {
      const res = await fetch("/api/admin/devices");
      if (res.ok) {
        const data = await res.json();
        setDevices(data.devices || []);
        setInvites(data.invites || []);
      }
    } catch (err) {
      console.error("Failed to load devices", err);
    } finally {
      setLoadingDevices(false);
    }
  };

  const handleGenerateInvite = async (empId?: number, empName?: string, phone?: string) => {
    setIsGeneratingInvite(true);
    try {
      const res = await fetch("/api/admin/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate_invite",
          employeeId: empId,
          employeeName: empName,
          mobileNumber: phone,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setGeneratedInvite({
          accessUrl: data.accessUrl,
          whatsappShareUrl: data.whatsappShareUrl,
          employeeName: empName || data.invite.employeeName || "Employee",
          expiresAt: data.invite.expiresAt,
          inviteCode: data.invite.inviteCode,
          directSent: data.directSent,
          mobileNumber: phone || data.mobileNumber,
        });
        setDeviceModalOpen(true);
        fetchDevices();
        if (data.directSent) {
          toast(data.message || "Sent directly via logged-in WhatsApp!", "success");
        } else {
          toast("Access link generated!", "success");
        }
      } else {
        toast(data.error || "Could not generate invite link", "error");
      }
    } catch (err: any) {
      toast("Error: " + err.message, "error");
    } finally {
      setIsGeneratingInvite(false);
    }
  };

  const handleSendInviteDirect = async (inviteCode: string, employeeName: string, mobileNumber?: string) => {
    setIsSendingDirect(true);
    try {
      const res = await fetch("/api/admin/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_invite_direct",
          inviteCode,
          employeeName,
          mobileNumber,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast(`Sent directly to ${employeeName} via logged-in WhatsApp!`, "success");
        if (generatedInvite) {
          setGeneratedInvite({ ...generatedInvite, directSent: true });
        }
      } else {
        toast(data.error || "Failed to dispatch via WhatsApp gateway", "error");
      }
    } catch (err: any) {
      toast("Error: " + err.message, "error");
    } finally {
      setIsSendingDirect(false);
    }
  };

  const handleRevokeDevice = async (deviceId: string, name: string) => {
    if (!confirm(`Are you sure you want to REVOKE access for ${name}? This device will immediately be locked out with a 403 Forbidden screen.`)) return;
    setRevokingDeviceId(deviceId);
    try {
      const res = await fetch("/api/admin/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke_device", deviceId }),
      });
      if (res.ok) {
        toast(`Access blocked for ${name}.`, "success");
        fetchDevices();
      }
    } catch (err: any) {
      toast("Error: " + err.message, "error");
    } finally {
      setRevokingDeviceId(null);
    }
  };

  const handleReactivateDevice = async (deviceId: string, name: string) => {
    try {
      const res = await fetch("/api/admin/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reactivate_device", deviceId }),
      });
      if (res.ok) {
        toast(`Access restored for ${name}.`, "success");
        fetchDevices();
      }
    } catch (err: any) {
      toast("Error: " + err.message, "error");
    }
  };

  const handleDeleteInvite = async (inviteId: number) => {
    try {
      const res = await fetch("/api/admin/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_invite", inviteId }),
      });
      if (res.ok) {
        toast("One-time invite cancelled.", "success");
        fetchDevices();
      }
    } catch (err: any) {
      toast("Error: " + err.message, "error");
    }
  };

  const handleDeleteDevice = async (deviceId: string, name: string) => {
    if (!confirm(`Are you sure you want to PERMANENTLY DELETE the device record for "${name}"?`)) return;
    try {
      const res = await fetch("/api/admin/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_device", deviceId }),
      });
      if (res.ok) {
        toast(`Device "${name}" deleted permanently.`, "success");
        fetchDevices();
      } else {
        const data = await res.json();
        toast(data.error || "Failed to delete device", "error");
      }
    } catch (err: any) {
      toast("Error: " + err.message, "error");
    }
  };

  const handleDeleteAllRevokedDevices = async () => {
    const revokedCount = devices.filter((d) => !d.isActive).length;
    if (revokedCount === 0) return;
    if (!confirm(`Are you sure you want to permanently delete ALL ${revokedCount} revoked device records? This cannot be undone.`)) return;
    try {
      const res = await fetch("/api/admin/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_all_revoked_devices" }),
      });
      if (res.ok) {
        toast(`Successfully deleted ${revokedCount} revoked device records.`, "success");
        fetchDevices();
      } else {
        const data = await res.json();
        toast(data.error || "Failed to delete revoked devices", "error");
      }
    } catch (err: any) {
      toast("Error: " + err.message, "error");
    }
  };

  useEffect(() => {
    fetchPerformanceData();
    fetchDevices();
  }, []);

  useEffect(() => {
    if (activeTab === "devices") {
      fetchDevices();
    }
  }, [activeTab]);

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
    // Optimistically update perfData so UI reflects immediately
    setPerfData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        employees: prev.employees.map((e) =>
          e.id === id ? { ...e, canEditOrders: allowEdit } : e
        ),
      };
    });

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

        // Broadcast permission change immediately to all open employee tabs & windows
        try {
          const ch = new BroadcastChannel("garmentpro_perm_channel");
          ch.postMessage({ type: "PERMISSIONS_UPDATED", employeeId: id, canEditOrders: allowEdit });
          ch.close();
        } catch {}
        try {
          localStorage.setItem("garmentpro_perm_sync", Date.now().toString());
        } catch {}

        fetchEmployees();
        fetchPerformanceData();
      } else {
        const err = await res.json();
        toast(err.error || "Failed to update order editing permissions", "error");
        fetchPerformanceData();
      }
    } catch (err: any) {
      toast("Error: " + err.message, "error");
      fetchPerformanceData();
    } finally {
      setTogglingId(null);
    }
  };

  // Handle Inventory Stock Update permission toggle
  const handleToggleStockUpdate = async (id: number, name: string, allowStock: boolean) => {
    // Optimistically update perfData so UI reflects immediately
    setPerfData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        employees: prev.employees.map((e) =>
          e.id === id ? { ...e, canUpdateStock: allowStock } : e
        ),
      };
    });

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

        // Broadcast permission change immediately to all open employee tabs & windows
        try {
          const ch = new BroadcastChannel("garmentpro_perm_channel");
          ch.postMessage({ type: "PERMISSIONS_UPDATED", employeeId: id, canUpdateStock: allowStock });
          ch.close();
        } catch {}
        try {
          localStorage.setItem("garmentpro_perm_sync", Date.now().toString());
        } catch {}

        fetchEmployees();
        fetchPerformanceData();
      } else {
        const err = await res.json();
        toast(err.error || "Failed to update stock update permissions", "error");
        fetchPerformanceData();
      }
    } catch (err: any) {
      toast("Error: " + err.message, "error");
      fetchPerformanceData();
    } finally {
      setTogglingId(null);
    }
  };

  // Handle Previous Bills (Without GST) permission toggle
  const handleTogglePreviousBills = async (id: number, name: string, allowPreviousBills: boolean) => {
    // Optimistically update perfData and employees
    setPerfData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        employees: prev.employees.map((e) =>
          e.id === id ? { ...e, canAddPreviousBills: allowPreviousBills } : e
        ),
      };
    });
    setEmployees((prev) =>
      prev.map((e) =>
        e.id === id ? { ...e, canAddPreviousBills: allowPreviousBills } : e
      )
    );

    try {
      setTogglingId(id);
      const res = await fetch(`/api/employees/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canAddPreviousBills: allowPreviousBills,
        }),
      });

      if (res.ok) {
        toast(
          allowPreviousBills
            ? `✅ Previous Bills (Without GST) permission APPROVED for "${name}"!`
            : `🔒 Previous Bills (Without GST) permission REVOKED for "${name}".`,
          "success"
        );

        // Broadcast permission change immediately to all open employee tabs & windows
        try {
          const ch = new BroadcastChannel("garmentpro_perm_channel");
          ch.postMessage({ type: "PERMISSIONS_UPDATED", employeeId: id, canAddPreviousBills: allowPreviousBills });
          ch.close();
        } catch {}
        try {
          localStorage.setItem("garmentpro_perm_sync", Date.now().toString());
        } catch {}

        fetchEmployees();
        fetchPerformanceData();
      } else {
        const err = await res.json();
        toast(err.error || "Failed to update previous bills permissions", "error");
        fetchPerformanceData();
      }
    } catch (err: any) {
      toast("Error: " + err.message, "error");
      fetchPerformanceData();
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
            href="/admin/employee/employees/new"
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

        <button
          type="button"
          onClick={() => setActiveTab("devices")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === "devices"
              ? "border-orange-600 text-orange-600 bg-orange-50/50 rounded-t-xl"
              : "border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300"
          }`}
        >
          <ShieldCheck size={14} className={activeTab === "devices" ? "text-orange-600" : "text-gray-400"} />
          <span>Device Security &amp; Gate</span>
          {devices.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-bold">
              {devices.filter((d) => d.isActive).length} Active
            </span>
          )}
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          TAB 1: ACCESS, ALLOCATION & PERFORMANCE
          ══════════════════════════════════════════════════════════════ */}
      {activeTab === "access" && (
        <div className="space-y-6">
          {/* Key KPI Stats Grid - Styled matching Photo 3 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Turnover */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <TrendingUp size={20} />
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                  TURNOVER
                </span>
              </div>
              <div className="mt-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Total Staff Turnover
                </span>
                <span className="text-2xl font-black text-slate-900 font-mono tracking-tight block mt-0.5">
                  {loadingPerf ? "..." : formatCurrency(perfData?.overview.totalCompanyTurnover || 0)}
                </span>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                <span>Generated across orders</span>
                <span className="text-emerald-600 font-bold">Live</span>
              </div>
            </div>

            {/* Active Sales Staff */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <UserCheck size={20} />
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200/60">
                  ACTIVE STAFF
                </span>
              </div>
              <div className="mt-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Sales Force Status
                </span>
                <div className="text-2xl font-black text-slate-900 font-mono flex items-baseline gap-2 mt-0.5">
                  <span>{loadingPerf ? "..." : perfData?.overview.activeEmployees || 0}</span>
                  <span className="text-xs font-semibold text-slate-400">
                    / {perfData?.overview.totalEmployees || 0} active
                  </span>
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                <span className="flex items-center gap-1 text-amber-700 font-bold">
                  <Crown size={12} /> {perfData?.overview.teamLeaders || 0} T.L.
                </span>
                <span className="text-slate-400">24*7 Access</span>
              </div>
            </div>

            {/* Allocated Customers */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center">
                  <Briefcase size={20} />
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200/60">
                  PORTFOLIOS
                </span>
              </div>
              <div className="mt-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Allocated Shops
                </span>
                <div className="text-2xl font-black text-slate-900 font-mono flex items-baseline gap-2 mt-0.5">
                  <span>{loadingPerf ? "..." : perfData?.overview.totalAllocatedCustomers || 0}</span>
                  <span className="text-xs font-semibold text-slate-400">assigned</span>
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                <span className="font-bold text-amber-700">
                  {perfData?.overview.totalUnallocatedCustomers || 0} unassigned
                </span>
                <span className="text-slate-400">Shops</span>
              </div>
            </div>

            {/* Allocated Customer Outstanding */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <IndianRupee size={20} />
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200/60">
                  OUTSTANDING
                </span>
              </div>
              <div className="mt-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Total Outstanding
                </span>
                <span className="text-2xl font-black text-rose-600 font-mono tracking-tight block mt-0.5">
                  {loadingPerf ? "..." : formatCurrency(perfData?.overview.totalAllocatedOutstanding || 0)}
                </span>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                <span>Credit balances</span>
                <span className="text-rose-600 font-bold">Due</span>
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

                      {/* Fast Access Action Controls - Explicit Ticked/Un-Ticked Checkboxes & Edit Button */}
                      <div className="flex flex-wrap items-center gap-2.5">
                        {/* 1. Approve Edit Access Checkbox */}
                        <button
                          type="button"
                          disabled={togglingId === selectedProfile.id}
                          onClick={() =>
                            handleToggleOrderEdit(selectedProfile.id, selectedProfile.name, !selectedProfile.canEditOrders)
                          }
                          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer select-none shadow-2xs ${
                            selectedProfile.canEditOrders
                              ? "bg-blue-50 border-blue-400 text-blue-900 shadow-xs"
                              : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                          } ${togglingId === selectedProfile.id ? "opacity-50 pointer-events-none" : ""}`}
                          title={selectedProfile.canEditOrders ? "Click to un-tick and revoke edit access" : "Click to tick and approve edit access"}
                        >
                          {selectedProfile.canEditOrders ? (
                            <CheckSquare size={16} className="text-blue-600 fill-blue-100 shrink-0" />
                          ) : (
                            <Square size={16} className="text-gray-400 shrink-0" />
                          )}
                          <span>Approve Edit Access</span>
                        </button>

                        {/* 2. Stock Update Access Checkbox */}
                        <button
                          type="button"
                          disabled={togglingId === selectedProfile.id}
                          onClick={() =>
                            handleToggleStockUpdate(selectedProfile.id, selectedProfile.name, !selectedProfile.canUpdateStock)
                          }
                          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer select-none shadow-2xs ${
                            selectedProfile.canUpdateStock
                              ? "bg-emerald-50 border-emerald-400 text-emerald-900 shadow-xs"
                              : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                          } ${togglingId === selectedProfile.id ? "opacity-50 pointer-events-none" : ""}`}
                          title={selectedProfile.canUpdateStock ? "Click to un-tick and revoke stock update access" : "Click to tick and grant stock update access"}
                        >
                          {selectedProfile.canUpdateStock ? (
                            <CheckSquare size={16} className="text-emerald-600 fill-emerald-100 shrink-0" />
                          ) : (
                            <Square size={16} className="text-gray-400 shrink-0" />
                          )}
                          <span>Stock Update Access</span>
                        </button>

                        {/* 3. Previous Bills (Without GST) Access Checkbox */}
                        <button
                          type="button"
                          disabled={togglingId === selectedProfile.id}
                          onClick={() =>
                            handleTogglePreviousBills(selectedProfile.id, selectedProfile.name, !selectedProfile.canAddPreviousBills)
                          }
                          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer select-none shadow-2xs ${
                            selectedProfile.canAddPreviousBills
                              ? "bg-purple-50 border-purple-400 text-purple-900 shadow-xs"
                              : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                          } ${togglingId === selectedProfile.id ? "opacity-50 pointer-events-none" : ""}`}
                          title={selectedProfile.canAddPreviousBills ? "Click to un-tick and revoke previous bills permission" : "Click to tick and grant permission to add previous bills (without GST)"}
                        >
                          {selectedProfile.canAddPreviousBills ? (
                            <CheckSquare size={16} className="text-purple-600 fill-purple-100 shrink-0" />
                          ) : (
                            <Square size={16} className="text-gray-400 shrink-0" />
                          )}
                          <span>Add Previous Bills (No GST)</span>
                        </button>

                        {/* 3. Edit Employee Button */}
                        <button
                          type="button"
                          onClick={() => handleGenerateInvite(selectedProfile.id, selectedProfile.name, selectedProfile.mobileNumber)}
                          disabled={isGeneratingInvite}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer disabled:opacity-50"
                          title="Generate single-use WhatsApp device access link"
                        >
                          <Smartphone size={13} className="text-emerald-600" />
                          <span>WhatsApp Device Link</span>
                        </button>

                        <Link
                          href={`/admin/employee/employees/${selectedProfile.id}/edit`}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl transition shadow-2xs cursor-pointer"
                          title="Edit employee details and permissions"
                        >
                          <Pencil size={12} />
                          <span>Edit</span>
                        </Link>
                      </div>
                    </div>

                    {/* Sales Metrics Cards - Styled subtly matching Photo 3 */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-1">
                      <div className="p-4 bg-white rounded-2xl border border-gray-200/80 shadow-2xs hover:shadow-xs transition">
                        <div className="flex items-center justify-between text-gray-400 mb-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Total Revenue
                          </span>
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200/50">
                            SALES
                          </span>
                        </div>
                        <span className="text-lg font-black text-slate-900 font-mono block mt-1">
                          {formatCurrency(selectedProfile.stats.totalRevenue)}
                        </span>
                      </div>

                      <div className="p-4 bg-white rounded-2xl border border-gray-200/80 shadow-2xs hover:shadow-xs transition">
                        <div className="flex items-center justify-between text-gray-400 mb-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Orders Booked
                          </span>
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/50">
                            ORDERS
                          </span>
                        </div>
                        <span className="text-lg font-black text-slate-900 font-mono block mt-1">
                          {selectedProfile.stats.totalOrders}
                        </span>
                      </div>

                      <div className="p-4 bg-white rounded-2xl border border-gray-200/80 shadow-2xs hover:shadow-xs transition">
                        <div className="flex items-center justify-between text-gray-400 mb-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Volume Sold
                          </span>
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200/50">
                            SETS/PCS
                          </span>
                        </div>
                        <span className="text-lg font-black text-slate-900 font-mono block mt-1">
                          {selectedProfile.stats.totalSets}s / {selectedProfile.stats.totalPcs}p
                        </span>
                      </div>

                      <div className="p-4 bg-white rounded-2xl border border-orange-200/80 shadow-2xs hover:shadow-xs transition">
                        <div className="flex items-center justify-between text-orange-400 mb-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-orange-700">
                            Customer Outstanding
                          </span>
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-orange-50 text-orange-700 border border-orange-200">
                            DUE
                          </span>
                        </div>
                        <span className="text-lg font-black text-orange-800 font-mono block mt-1">
                          {formatCurrency(selectedProfile.stats.allocatedOutstanding)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Customer Allocation Manager - Dropdown / Collapsible Form */}
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs overflow-hidden">
                    <div
                      className="p-4 sm:p-5 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50/50 cursor-pointer select-none hover:bg-gray-100/60 transition"
                      onClick={() => setIsAllocatedOpen(!isAllocatedOpen)}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center shrink-0">
                          <Briefcase size={16} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-sm text-gray-900">
                              Allocated Customers ({selectedProfile.allocatedCustomers.length})
                            </h3>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200 uppercase">
                              Dropdown Form
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            Click to {isAllocatedOpen ? "collapse" : "expand"} allocated retail/wholesale accounts ({selectedProfile.allocatedCustomers.length} assigned).
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-auto" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCustomerIdsToAllocate([]);
                            setModalCustomerFilter("");
                            setModalFilterType("unallocated");
                            setIsAllocateModalOpen(true);
                          }}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
                        >
                          <Plus size={14} />
                          <span>+ Allocate</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsAllocatedOpen(!isAllocatedOpen)}
                          className="p-1.5 rounded-xl border border-gray-200 hover:bg-white text-gray-600 transition"
                          title={isAllocatedOpen ? "Collapse section" : "Expand section"}
                        >
                          {isAllocatedOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </div>
                    </div>

                    {/* Allocated Customers Table (Collapsible) */}
                    {isAllocatedOpen && (
                      <div className="overflow-x-auto animate-in fade-in duration-200">
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
                                      Click <strong>"+ Allocate"</strong> to assign customer accounts.
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
                    )}
                  </div>

                  {/* Recent Orders Placed by Employee - Dropdown / Collapsible Form */}
                  {selectedProfile.recentOrders && selectedProfile.recentOrders.length > 0 && (
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs overflow-hidden">
                      <div
                        className="p-4 border-b border-gray-200 bg-gray-50/50 flex items-center justify-between cursor-pointer select-none hover:bg-gray-100/60 transition"
                        onClick={() => setIsRecentOrdersOpen(!isRecentOrdersOpen)}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                            <Layers size={16} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-sm text-gray-900">
                                Recent Orders Booked ({selectedProfile.recentOrders.length})
                              </h3>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 uppercase">
                                Dropdown Form
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-500 mt-0.5">
                              Click to {isRecentOrdersOpen ? "collapse" : "view"} recent wholesale bookings.
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setIsRecentOrdersOpen(!isRecentOrdersOpen)}
                          className="p-1.5 rounded-xl border border-gray-200 hover:bg-white text-gray-600 transition"
                          title={isRecentOrdersOpen ? "Collapse section" : "Expand section"}
                        >
                          {isRecentOrdersOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </div>

                      {isRecentOrdersOpen && (
                        <div className="overflow-x-auto animate-in fade-in duration-200">
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
                                    href={`/admin/employee/orders?search=${encodeURIComponent(ord.orderNumber)}`}
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
                      )}
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
                    <th className="py-3.5 px-6">Previous Bills (No GST)</th>
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
                          <label
                            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all cursor-pointer select-none shadow-2xs ${
                              emp.canUpdateStock
                                ? "bg-emerald-50 border-emerald-300 text-emerald-900 hover:bg-emerald-100"
                                : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100 hover:border-gray-300"
                            } ${togglingId === emp.id ? "opacity-50 pointer-events-none" : ""}`}
                            title={emp.canUpdateStock ? "Uncheck to revoke stock update access right away" : "Check to grant stock update access"}
                          >
                            <input
                              type="checkbox"
                              checked={Boolean(emp.canUpdateStock)}
                              disabled={togglingId === emp.id}
                              onChange={(e) => handleToggleStockUpdate(emp.id, emp.name, e.target.checked)}
                              className="w-4 h-4 text-emerald-600 bg-white border-gray-300 rounded focus:ring-emerald-500 cursor-pointer"
                            />
                            <span className="text-xs font-bold whitespace-nowrap">
                              {emp.canUpdateStock ? "Access Allowed" : "Allow Access"}
                            </span>
                          </label>
                        </td>
                        <td className="py-4 px-6">
                          <label
                            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all cursor-pointer select-none shadow-2xs ${
                              emp.canAddPreviousBills
                                ? "bg-purple-50 border-purple-300 text-purple-900 hover:bg-purple-100"
                                : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100 hover:border-gray-300"
                            } ${togglingId === emp.id ? "opacity-50 pointer-events-none" : ""}`}
                            title={emp.canAddPreviousBills ? "Uncheck to revoke previous bills permission" : "Check to grant permission to add previous bills (Without GST)"}
                          >
                            <input
                              type="checkbox"
                              checked={Boolean(emp.canAddPreviousBills)}
                              disabled={togglingId === emp.id}
                              onChange={(e) => handleTogglePreviousBills(emp.id, emp.name, e.target.checked)}
                              className="w-4 h-4 text-purple-600 bg-white border-gray-300 rounded focus:ring-purple-500 cursor-pointer"
                            />
                            <span className="text-xs font-bold whitespace-nowrap">
                              {emp.canAddPreviousBills ? "Access Allowed" : "Allow Access"}
                            </span>
                          </label>
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
                          <button
                            type="button"
                            onClick={() => handleGenerateInvite(emp.id, emp.name, emp.mobileNumber)}
                            disabled={isGeneratingInvite}
                            className="p-1.5 inline-flex text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                            title="Send WhatsApp Device Authorization Link"
                          >
                            <Smartphone size={15} />
                          </button>
                          <Link
                            href={`/admin/employee/employees/${emp.id}/edit`}
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
          TAB 3: DEVICE SECURITY & ACCESS GATE
          ══════════════════════════════════════════════════════════════ */}
      {activeTab === "devices" && (
        <div className="space-y-6">
          {/* Top Enterprise Security Banner */}
          <div className="bg-gradient-to-r from-zinc-900 via-slate-900 to-zinc-900 text-white rounded-3xl p-6 border border-zinc-800 shadow-lg relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-orange-500/20 border border-orange-500/40 text-orange-400 flex items-center justify-center shrink-0">
                  <ShieldCheck size={28} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      SUBDOMAIN LOCKDOWN ACTIVE
                    </span>
                    <span className="text-xs text-zinc-400 font-mono">employee.iqtrousers.in</span>
                  </div>
                  <h2 className="text-xl font-bold tracking-tight text-white">
                    Cryptographic Device Gatekeeper
                  </h2>
                  <p className="text-xs text-zinc-300 max-w-2xl mt-1 leading-relaxed">
                    Outside hackers, web crawlers, search engines, and unauthorized mobile/desktop terminals are blacked out with an immediate <strong>403 Forbidden</strong> response. Terminal access is restricted strictly to registered company devices with HMAC-SHA256 hardware tokens.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDeviceEmpId(employees[0]?.id ? String(employees[0].id) : "");
                    setDeviceModalOpen(true);
                  }}
                  className="px-4 py-2.5 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white text-xs font-bold rounded-xl transition shadow-md shadow-orange-600/30 flex items-center gap-2 cursor-pointer"
                >
                  <Smartphone size={15} />
                  <span>Generate WhatsApp Access Link</span>
                </button>
                <button
                  type="button"
                  onClick={fetchDevices}
                  disabled={loadingDevices}
                  className="p-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-xl transition cursor-pointer"
                  title="Refresh devices"
                >
                  <RefreshCw size={15} className={loadingDevices ? "animate-spin" : ""} />
                </button>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-zinc-800/80">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                  Active Approved Devices
                </span>
                <span className="text-2xl font-black text-emerald-400 font-mono mt-0.5 block">
                  {devices.filter((d) => d.isActive).length}
                </span>
                <span className="text-[10px] text-zinc-400">Total authorized terminals</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                  Revoked / Blocked
                </span>
                <span className="text-2xl font-black text-rose-400 font-mono mt-0.5 block">
                  {devices.filter((d) => !d.isActive).length}
                </span>
                <span className="text-[10px] text-zinc-400">Terminals locked out</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                  Pending Invites
                </span>
                <span className="text-2xl font-black text-amber-400 font-mono mt-0.5 block">
                  {invites.filter((i) => !i.isUsed && new Date(i.expiresAt) > new Date()).length}
                </span>
                <span className="text-[10px] text-zinc-400">Unused WhatsApp links</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                  Web Crawler Blockout
                </span>
                <span className="text-sm font-black text-emerald-400 font-mono mt-1.5 flex items-center gap-1.5">
                  <CheckCircle size={14} /> Robots + X-Robots 403
                </span>
                <span className="text-[10px] text-zinc-400">Zero search indexing</span>
              </div>
            </div>
          </div>

          {/* Super Admin Multi-Device Master Passkey Box */}
          <div className="bg-amber-50/60 border border-amber-200 rounded-3xl p-5 shadow-2xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                  <Crown size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-amber-950 flex items-center gap-2">
                    <span>Super Admin Master Access (Unlimited Devices)</span>
                    <span className="text-[10px] bg-amber-200 text-amber-900 font-bold px-2 py-0.5 rounded-full">
                      5+ Devices Ready
                    </span>
                  </h3>
                  <p className="text-xs text-amber-800/90 mt-1 max-w-3xl leading-relaxed">
                    Super Admin can authorize any device (Laptop, iPhone, iPad, Home PC, Office PC) instantly without limits. When opening <strong>employee.iqtrousers.in</strong> on an unknown device, simply click <strong>"Super Admin Master Unlock"</strong> on the 403 screen and enter the Master Passkey below.
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-amber-900 font-semibold">Master Passkey:</span>
                    <code className="bg-white px-2.5 py-1 rounded-lg border border-amber-300 font-mono text-xs font-bold text-amber-950">
                      IQ-SUPERADMIN-MASTER-PASS-2026
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText("IQ-SUPERADMIN-MASTER-PASS-2026");
                        toast("Master Passkey copied to clipboard!", "success");
                      }}
                      className="p-1 hover:bg-amber-100 text-amber-700 rounded-md transition cursor-pointer"
                      title="Copy Passkey"
                    >
                      <Copy size={13} />
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  const url = "https://employee.iqtrousers.in/auth/access?master_key=IQ-SUPERADMIN-MASTER-PASS-2026";
                  navigator.clipboard.writeText(url);
                  toast("Super Admin 1-Click Master Unlock Link copied!", "success");
                }}
                className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition shadow-2xs flex items-center gap-1.5 self-start md:self-center shrink-0 cursor-pointer"
              >
                <Copy size={13} />
                <span>Copy 1-Click Master Link</span>
              </button>
            </div>
          </div>

          {/* Section: Authorized Devices Table */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow-2xs overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Laptop size={16} className="text-orange-600" />
                  <span>Approved Company Terminals &amp; Mobile Devices</span>
                  <span className="text-xs font-mono text-gray-400 font-normal">({devices.length})</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Terminals verified with cryptographically signed 365-day HMAC tokens. Revoking a lost/stolen device takes effect immediately.
                </p>
              </div>
              {devices.some((d) => !d.isActive) && (
                <button
                  type="button"
                  onClick={handleDeleteAllRevokedDevices}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition cursor-pointer self-start sm:self-auto shrink-0 shadow-2xs"
                  title="Permanently remove all revoked device records from the database"
                >
                  <Trash2 size={13} />
                  <span>Clear All Revoked ({devices.filter((d) => !d.isActive).length})</span>
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-gray-50/75 border-b border-gray-100 text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3.5 px-6">Device Name &amp; Signature</th>
                    <th className="py-3.5 px-6">Role / Access Level</th>
                    <th className="py-3.5 px-6">Linked Personnel</th>
                    <th className="py-3.5 px-6">IP &amp; Last Active</th>
                    <th className="py-3.5 px-6">Status</th>
                    <th className="py-3.5 px-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loadingDevices ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-gray-400">
                        <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-orange-600" />
                        <span>Loading approved devices...</span>
                      </td>
                    </tr>
                  ) : devices.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-gray-400">
                        <Smartphone size={24} className="mx-auto mb-2 text-gray-300" />
                        <p className="font-semibold text-gray-600">No authorized devices yet.</p>
                        <p className="text-[11px] text-gray-400 mt-1">
                          Generate a WhatsApp access link to authorize employee phones, or use Master Unlock for Admin devices.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    devices.map((dev) => (
                      <tr key={dev.id} className="hover:bg-gray-50/60 transition">
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-gray-100 text-gray-700 flex items-center justify-center shrink-0">
                              {dev.role === "SUPER_ADMIN" ? <Crown size={16} className="text-amber-600" /> : <Smartphone size={16} />}
                            </div>
                            <div>
                              <span className="font-bold text-gray-900 block">
                                {dev.name || "Authorized Terminal"}
                              </span>
                              <span className="font-mono text-[10px] text-gray-400 block truncate max-w-[200px]">
                                {dev.deviceId}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              dev.role === "SUPER_ADMIN"
                                ? "bg-amber-100 text-amber-900 border border-amber-300"
                                : dev.role === "TEAM_LEADER"
                                ? "bg-purple-100 text-purple-900 border border-purple-300"
                                : "bg-blue-100 text-blue-900 border border-blue-200"
                            }`}
                          >
                            {dev.role}
                          </span>
                        </td>
                        <td className="py-4 px-6 font-medium text-gray-800">
                          {dev.employeeName || "Super Admin"}
                        </td>
                        <td className="py-4 px-6 text-gray-500 font-mono text-[11px]">
                          <div>{dev.ipAddress || "Unknown IP"}</div>
                          <div className="text-[10px] text-gray-400 mt-0.5">
                            Active: {dev.lastUsedAt ? new Date(dev.lastUsedAt).toLocaleDateString() : "Never"}
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          {dev.isActive ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <CheckCircle size={11} className="text-emerald-600" /> Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-800 border border-rose-200">
                              <Ban size={11} className="text-rose-600" /> Revoked
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-right">
                          {dev.isActive ? (
                            <button
                              type="button"
                              onClick={() => handleRevokeDevice(dev.deviceId, dev.name || "Terminal")}
                              disabled={revokingDeviceId === dev.deviceId}
                              className="px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition cursor-pointer disabled:opacity-50"
                              title="Immediately lock out this device"
                            >
                              Revoke Access
                            </button>
                          ) : (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleReactivateDevice(dev.deviceId, dev.name || "Terminal")}
                                className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition cursor-pointer"
                                title="Restore device authorization"
                              >
                                Re-activate
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteDevice(dev.deviceId, dev.name || "Terminal")}
                                className="px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition cursor-pointer inline-flex items-center gap-1"
                                title="Permanently delete this revoked device record"
                              >
                                <Trash2 size={12} />
                                <span>Delete</span>
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section: Pending & Recent Single-Use Invites */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow-2xs overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Send size={16} className="text-emerald-600" />
                  <span>Single-Use WhatsApp Authorization Invites</span>
                  <span className="text-xs font-mono text-gray-400 font-normal">({invites.length})</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Each link can only be used once from the employee's phone to enroll their hardware token.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-gray-50/75 border-b border-gray-100 text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3.5 px-6">Target Personnel</th>
                    <th className="py-3.5 px-6">Invite Code</th>
                    <th className="py-3.5 px-6">Created / Expires</th>
                    <th className="py-3.5 px-6">Status</th>
                    <th className="py-3.5 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {invites.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-400">
                        No invitations generated yet. Click "Generate WhatsApp Access Link" to invite a staff member.
                      </td>
                    </tr>
                  ) : (
                    invites.map((inv) => {
                      const isExpired = new Date(inv.expiresAt) < new Date();
                      const fullUrl = `https://employee.iqtrousers.in/auth/access?key=${inv.inviteCode}`;
                      return (
                        <tr key={inv.id} className="hover:bg-gray-50/60 transition">
                          <td className="py-4 px-6 font-bold text-gray-900">
                            {inv.employeeName || "Employee"}
                          </td>
                          <td className="py-4 px-6 font-mono text-gray-600">
                            <span className="bg-gray-100 px-2 py-0.5 rounded text-[11px]">
                              {inv.inviteCode}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-gray-500">
                            <div>{new Date(inv.createdAt).toLocaleDateString()}</div>
                            <div className="text-[10px] text-gray-400">
                              Expires: {new Date(inv.expiresAt).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            {inv.isUsed ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700">
                                <CheckCircle size={10} className="text-gray-500" /> Claimed &amp; Bound
                              </span>
                            ) : isExpired ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700">
                                Expired
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                Pending Claim
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-6 text-right space-x-2">
                            {!inv.isUsed && !isExpired && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const emp = employees.find((e) => e.id === inv.employeeId);
                                    handleSendInviteDirect(inv.inviteCode, inv.employeeName || "Employee", emp?.mobileNumber);
                                  }}
                                  disabled={isSendingDirect}
                                  className="p-1.5 inline-flex text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition"
                                  title="Send directly from logged-in WhatsApp (KRISH CLOTHING CO)"
                                >
                                  <Send size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(fullUrl);
                                    toast("Access link copied to clipboard!", "success");
                                  }}
                                  className="p-1.5 inline-flex text-gray-600 hover:text-black hover:bg-gray-100 rounded-lg transition"
                                  title="Copy Access Link"
                                >
                                  <Copy size={14} />
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteInvite(inv.id)}
                              className="p-1.5 inline-flex text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                              title="Delete Invite"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
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

      {/* Device WhatsApp Access Link Modal */}
      {deviceModalOpen && (
        <Modal
          isOpen={deviceModalOpen}
          onClose={() => {
            setDeviceModalOpen(false);
            setGeneratedInvite(null);
          }}
          title="Generate WhatsApp Device Access Link"
          size="md"
        >
          <div className="space-y-4">
            <p className="text-xs text-gray-600 leading-relaxed">
              Generate a single-use authorization link for an employee. When tapped on their phone, their device will be registered for 365 days.
            </p>

            {!generatedInvite ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Select Employee:
                  </label>
                  <select
                    value={selectedDeviceEmpId}
                    onChange={(e) => setSelectedDeviceEmpId(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-orange-500 focus:bg-white"
                  >
                    <option value="">-- Choose Employee --</option>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} ({e.mobileNumber}) - {e.designation}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const emp = employees.find((e) => String(e.id) === selectedDeviceEmpId);
                      handleGenerateInvite(emp?.id, emp?.name, emp?.mobileNumber);
                    }}
                    disabled={isGeneratingInvite || !selectedDeviceEmpId}
                    className="w-full py-2.5 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white font-bold text-xs rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Smartphone size={14} />
                    <span>{isGeneratingInvite ? "Generating Link..." : "Create Single-Use Invite Link"}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4">
                <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs">
                  <CheckCircle size={16} className="text-emerald-600" />
                  <span>Access Link Ready for {generatedInvite.employeeName}!</span>
                </div>

                {/* Direct WhatsApp Send Status */}
                {generatedInvite.directSent ? (
                  <div className="p-3 bg-emerald-100/90 border border-emerald-300 rounded-xl text-xs text-emerald-900 font-medium">
                    <p className="font-bold flex items-center gap-1.5 text-emerald-950">
                      <span>🚀 Delivered Directly via Logged-In WhatsApp!</span>
                    </p>
                    <p className="text-[11px] text-emerald-800 mt-1">
                      Sent to <strong>{generatedInvite.employeeName}</strong> {generatedInvite.mobileNumber ? `(+91 ${generatedInvite.mobileNumber})` : ""} from your connected business WhatsApp (KRISH CLOTHING CO).
                    </p>
                  </div>
                ) : (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                    <p className="font-bold">Dispatch to Employee Phone:</p>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      Click below to send directly from your logged-in WhatsApp terminal:
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-semibold text-emerald-800 mb-1">
                    Direct Authorization URL:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={generatedInvite.accessUrl}
                      className="w-full px-2.5 py-1.5 bg-white border border-emerald-300 rounded-lg text-xs font-mono text-gray-800"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(generatedInvite.accessUrl);
                        toast("Link copied to clipboard!", "success");
                      }}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition shrink-0 cursor-pointer"
                    >
                      Copy
                    </button>
                  </div>
                </div>

                <div className="pt-1 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      handleSendInviteDirect(
                        generatedInvite.inviteCode,
                        generatedInvite.employeeName,
                        generatedInvite.mobileNumber
                      )
                    }
                    disabled={isSendingDirect}
                    className="w-full py-2.5 bg-zinc-950 hover:bg-black text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Send size={14} className="text-emerald-400" />
                    <span>
                      {isSendingDirect
                        ? "Sending via Logged-In WhatsApp..."
                        : generatedInvite.directSent
                        ? "Re-Send via Logged-In WhatsApp"
                        : "Send via Logged-In WhatsApp"}
                    </span>
                  </button>

                  <a
                    href={generatedInvite.whatsappShareUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300 font-semibold text-[11px] rounded-xl transition flex items-center justify-center gap-2 text-center"
                  >
                    <span>Or open WhatsApp Web / App (Manual Fallback)</span>
                  </a>
                </div>

                <p className="text-[11px] text-emerald-700 text-center">
                  ⚠️ Note: Valid for 7 days. Can only be activated on 1 device.
                </p>
              </div>
            )}

            <div className="pt-2 border-t border-gray-100 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setDeviceModalOpen(false);
                  setGeneratedInvite(null);
                }}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
