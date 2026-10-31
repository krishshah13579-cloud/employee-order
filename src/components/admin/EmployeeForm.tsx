"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  UserCheck,
  Save,
  Upload,
  Image as ImageIcon,
  Phone,
  MapPin,
  FileCheck,
  Briefcase,
  Loader2,
  Trash2,
  Crown,
  Edit3,
  Boxes,
  Package,
  Plus,
  ListTodo,
  CheckSquare,
  Eye,
  EyeOff,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import type { EmployeeData } from "@/lib/types";
import { compressImageFile } from "@/lib/imageCompression";
import { isEmployeeTeamLeader } from "@/lib/time";

interface EmployeeFormProps {
  initialData?: EmployeeData;
  isEdit?: boolean;
  employeeId?: string | number;
}

export default function EmployeeForm({
  initialData,
  isEdit = false,
  employeeId,
}: EmployeeFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const initialRole = initialData?.designation || "Sales Representative";
  const isKnownRole =
    initialRole === "Sales Representative" ||
    initialRole === "Office Employee" ||
    initialRole === "Team Leader (T.L.)";

  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    email: initialData?.email || "",
    pin: initialData?.pin || "1234",
    mobileNumber: initialData?.mobileNumber || "",
    address: initialData?.address || "",
    proofUrl: initialData?.proofUrl || "",
    designation: initialRole,
    isTeamLeader: initialData?.isTeamLeader ?? isEmployeeTeamLeader(initialData),
    canEditOrders: initialData?.canEditOrders ?? false,
    canUpdateStock: initialData?.canUpdateStock ?? false,
    canViewOrderForm: initialData?.canViewOrderForm ?? true,
    isActive: initialData?.isActive ?? true,
  });

  const [isCustomDesignation, setIsCustomDesignation] = useState(!isKnownRole);
  const [customDesignationText, setCustomDesignationText] = useState(!isKnownRole ? initialRole : "");

  // Multiple tasks for Office Employee
  const [tasks, setTasks] = useState<string[]>(
    (initialData?.tasks || []).map((t: any) => (typeof t === "string" ? t : t.taskTitle || ""))
  );
  const [newTaskInput, setNewTaskInput] = useState("");

  const handleAddTask = () => {
    const trimmed = newTaskInput.trim();
    if (!trimmed) return;
    if (tasks.includes(trimmed)) {
      toast("Task already added", "error");
      return;
    }
    setTasks([...tasks, trimmed]);
    setNewTaskInput("");
  };

  const handleRemoveTask = (indexToRemove: number) => {
    setTasks(tasks.filter((_, idx) => idx !== indexToRemove));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const dataUrl = await compressImageFile(file, 1200, 1200, 0.78);
      setFormData((prev) => ({ ...prev, proofUrl: dataUrl }));
      toast("Employee proof document attached successfully!", "success");
    } catch (err: any) {
      console.error("Employee proof upload error:", err);
      toast("Error uploading file: " + (err.message || "Failed to process photo"), "error");
    } finally {
      setUploading(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const method = isEdit ? "PUT" : "POST";
      const endpoint = isEdit ? `/api/employees/${employeeId}` : "/api/employees";

      const finalDesignation = isCustomDesignation
        ? (customDesignationText.trim() || "Employee")
        : formData.designation;

      const payload = {
        ...formData,
        designation: finalDesignation,
        tasks,
      };

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast(
          isEdit ? "Employee record updated successfully!" : "New employee registered successfully!",
          "success"
        );
        router.push("/admin/employee/employees");
      } else {
        const err = await res.json();
        toast(err.error || "Failed to save employee", "error");
      }
    } catch (err: any) {
      toast("Error: " + err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl pb-16">
      {/* Top Breadcrumb & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <Link
            href="/admin/employee/employees"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-black transition-colors mb-1.5"
          >
            <ArrowLeft size={14} />
            <span>Back to Employees</span>
          </Link>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-gray-700" />
            <span>{isEdit ? `Edit Employee: ${formData.name}` : "Add New Employee"}</span>
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Register sales staff, upload KYC/ID proof, and configure active login status for taking wholesale orders.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/admin/employee/employees"
            className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors border border-gray-200"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2 bg-zinc-950 hover:bg-black text-white text-xs font-semibold rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{isEdit ? "Update Employee" : "Save Employee"}</span>
          </button>
        </div>
      </div>

      {/* 1. Identity & Role Details */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-5">
        <div className="border-b border-gray-100 pb-3">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-blue-600" />
            <span>Personal & Employment Details</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Full Employee Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Ramesh Patel"
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-zinc-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Staff Email Address
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="e.g. ramesh.patel@iqtrousers.com"
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-zinc-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Mobile Number (Contact) *
            </label>
            <input
              type="tel"
              required
              value={formData.mobileNumber}
              onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value })}
              placeholder="e.g. 9825012345"
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-zinc-900"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Designation / Role *
              </label>
              {isCustomDesignation ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomDesignation(false);
                    setFormData({ ...formData, designation: "Sales Representative" });
                  }}
                  className="text-[11px] text-blue-600 hover:text-blue-800 font-bold cursor-pointer"
                >
                  Choose Standard Role
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsCustomDesignation(true)}
                  className="text-[11px] text-orange-600 hover:text-orange-800 font-bold cursor-pointer"
                >
                  + Add Designation
                </button>
              )}
            </div>

            {!isCustomDesignation ? (
              <select
                value={formData.designation}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "__CUSTOM__") {
                    setIsCustomDesignation(true);
                  } else {
                    setFormData((prev) => ({
                      ...prev,
                      designation: val,
                      // If Office Employee, default order form view to false unless admin enables it; if Sales Rep default to true
                      canViewOrderForm: val === "Office Employee" ? false : prev.canViewOrderForm,
                    }));
                  }
                }}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-semibold text-gray-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-zinc-900 cursor-pointer"
              >
                <option value="Sales Representative">Sales Representative</option>
                <option value="Office Employee">Office Employee</option>
                <option value="Team Leader (T.L.)">Team Leader (T.L.)</option>
                <option value="__CUSTOM__">+ Add Custom Designation...</option>
              </select>
            ) : (
              <div className="space-y-1.5">
                <input
                  type="text"
                  required
                  value={customDesignationText}
                  onChange={(e) => setCustomDesignationText(e.target.value)}
                  placeholder="Enter custom designation (e.g. Factory Supervisor, Accountant)"
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-semibold text-gray-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-zinc-900"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Portal Security PIN (4 Digits) *
            </label>
            <input
              type="text"
              required
              maxLength={8}
              value={formData.pin}
              onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
              placeholder="e.g. 1234"
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-mono font-bold tracking-widest focus:outline-none focus:bg-white focus:ring-2 focus:ring-zinc-900"
            />
          </div>

          {/* Multiple Tasks Field (Office Employee or any custom assigned tasks) */}
          {(formData.designation === "Office Employee" || tasks.length > 0) && (
            <div className="sm:col-span-2 p-4 bg-purple-50/70 border border-purple-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-purple-700 text-white flex items-center justify-center shrink-0 shadow-2xs">
                    <ListTodo size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-purple-950 uppercase tracking-wider flex items-center gap-1.5">
                      <span>Assigned Tasks (Office Employee)</span>
                    </h3>
                    <p className="text-[11px] text-purple-700">
                      These task checkboxes appear in the employee&apos;s Tasks tab. When checked, the completion timestamp is recorded and alerted to Admin.
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-purple-200 text-purple-900 font-bold text-[11px] font-mono">
                  {tasks.length} {tasks.length === 1 ? "Task" : "Tasks"}
                </span>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTaskInput}
                  onChange={(e) => setNewTaskInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTask();
                    }
                  }}
                  placeholder="e.g. Verify courier dispatch slips, Check stock recount, Daily cash book"
                  className="flex-1 px-3.5 py-2 bg-white border border-purple-300 rounded-xl text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-600"
                />
                <button
                  type="button"
                  onClick={handleAddTask}
                  className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Plus size={14} />
                  <span>Add Task</span>
                </button>
              </div>

              {tasks.length > 0 ? (
                <div className="space-y-1.5 pt-1">
                  {tasks.map((task, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 bg-white border border-purple-100 rounded-xl shadow-2xs text-xs text-gray-800"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <CheckSquare size={14} className="text-purple-600 shrink-0" />
                        <span className="font-semibold truncate">{task}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveTask(idx)}
                        className="p-1 text-gray-400 hover:text-red-600 transition-colors cursor-pointer shrink-0"
                        title="Remove Task"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-purple-600/80 italic">
                  No tasks added yet. Type a task above and click &quot;Add Task&quot;.
                </p>
              )}
            </div>
          )}

          <div className="flex items-center pt-2 sm:col-span-2">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-5 h-5 text-zinc-950 rounded-lg focus:ring-zinc-900 border-gray-300"
              />
              <div>
                <span className="text-xs font-bold text-gray-900 block">Active Login &amp; Ordering Status</span>
                <span className="text-[11px] text-gray-500">
                  Allow employee to sign in with their PIN and collect wholesale client orders.
                </span>
              </div>
            </label>
          </div>

          {/* Team Leader (T.L.) 24*7 Access Toggle */}
          <div className="sm:col-span-2 p-4 bg-orange-50/70 border border-orange-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-orange-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <Crown size={16} />
                </div>
                <div>
                  <span className="text-xs font-black text-gray-900 flex items-center gap-1.5">
                    <span>Designate as Team Leader (T.L.)</span>
                    <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.2 rounded-full border border-amber-300">
                      24*7 Access
                    </span>
                  </span>
                  <span className="text-[11px] text-gray-600">
                    Team Leaders are permitted to access the employee panel <strong>24*7</strong> (bypasses standard 9:00 PM IST daily logout).
                  </span>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(formData.isTeamLeader)}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      isTeamLeader: e.target.checked,
                      designation:
                        e.target.checked && prev.designation === "Sales Representative"
                          ? "Team Leader (T.L.)"
                          : prev.designation,
                    }))
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
              </label>
            </div>

            {/* Order Form Editing Permission (Admin Approval) */}
            <div className="flex items-center justify-between p-4 bg-blue-50/50 rounded-xl border border-blue-200">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-blue-100 text-blue-800 shrink-0">
                  <Edit3 className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                    <span>Order Form Editing Access</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold uppercase">
                      Admin Approval
                    </span>
                  </h3>
                  <p className="text-[11px] text-gray-600 mt-0.5">
                    Grant this employee explicit permission to edit Pending order forms. If disabled, orders cannot be edited by this employee.
                  </p>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(formData.canEditOrders)}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      canEditOrders: e.target.checked,
                    }))
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* Stock Update Page Permission */}
            <div className="flex items-center justify-between p-4 bg-gray-50/60 rounded-xl border border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">
                    Stock Update Page Access
                  </h3>
                  <p className="text-xs text-gray-500">
                    Allow employee to update sets, ratios, and product photos on /update-stock.
                  </p>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(formData.canUpdateStock)}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      canUpdateStock: e.target.checked,
                    }))
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            {/* Order Form View Access Permission (Allow / Revoke) */}
            <div className="flex items-center justify-between p-4 bg-amber-50/50 rounded-xl border border-amber-200">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-amber-100 text-amber-800 shrink-0">
                  {formData.canViewOrderForm ? (
                    <Eye className="w-5 h-5 text-amber-700" />
                  ) : (
                    <EyeOff className="w-5 h-5 text-slate-500" />
                  )}
                </div>
                <div>
                  <h3 className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                    <span>Order Form View Access</span>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                        formData.canViewOrderForm
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {formData.canViewOrderForm ? "Allowed" : "Revoked"}
                    </span>
                  </h3>
                  <p className="text-[11px] text-gray-600 mt-0.5">
                    Allow or revoke order form access (/orders/new). If revoked, the Order Form is hidden and disabled for this employee.
                  </p>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(formData.canViewOrderForm)}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      canViewOrderForm: e.target.checked,
                    }))
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Address */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-5">
        <div className="border-b border-gray-100 pb-3">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-600" />
            <span>Residential Address</span>
          </h2>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
            Full Address (House/Flat No, Society/Area, City, State, PIN) *
          </label>
          <textarea
            rows={3}
            required
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            placeholder="e.g. B-204, Shivalik Residency, Khokhra, Maninagar, Ahmedabad - 380008"
            className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-zinc-900"
          />
        </div>
      </div>

      {/* 3. Proof Document */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-5">
        <div className="border-b border-gray-100 pb-3">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-blue-600" />
            <span>ID / Address Proof (Upload)</span>
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Aadhaar card, PAN card, driving licence, or address verification proof.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-6">
          {formData.proofUrl ? (
            <div className="relative w-48 h-32 rounded-xl overflow-hidden border border-gray-200 bg-gray-100 shadow-xs shrink-0 group">
              <img
                src={formData.proofUrl}
                alt="Proof Preview"
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, proofUrl: "" }))}
                className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remove photo"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ) : (
            <div className="w-48 h-32 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 bg-gray-50 shrink-0">
              <FileCheck size={28} />
              <span className="text-[11px] font-semibold mt-1">No Document Uploaded</span>
            </div>
          )}

          <div className="flex-1 space-y-3 w-full">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,image/jpeg,image/png,image/webp,image/heic,image/heif"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              <span>{uploading ? "Uploading Proof..." : "Upload Proof Document"}</span>
            </button>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">
                Or Paste Image URL:
              </label>
              <input
                type="text"
                value={formData.proofUrl}
                onChange={(e) => setFormData({ ...formData, proofUrl: e.target.value })}
                placeholder="https://example.com/employee-aadhaar.jpg"
                className="w-full px-3.5 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-zinc-900"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Sticky Action Bar */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
        <Link
          href="/admin/employee/employees"
          className="px-5 py-2.5 rounded-xl text-xs font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors border border-gray-200"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-zinc-950 hover:bg-black text-white text-xs font-semibold rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin text-white" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          <span>{isEdit ? "Update Employee" : "Save Employee"}</span>
        </button>
      </div>
    </form>
  );
}
