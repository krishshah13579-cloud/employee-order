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
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import type { EmployeeData } from "@/lib/types";

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

  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    pin: initialData?.pin || "1234",
    mobileNumber: initialData?.mobileNumber || "",
    address: initialData?.address || "",
    proofUrl: initialData?.proofUrl || "",
    designation: initialData?.designation || "Sales Representative",
    isActive: initialData?.isActive ?? true,
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const uploadFormData = new FormData();
    uploadFormData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: uploadFormData,
      });

      if (res.ok) {
        const data = await res.json();
        setFormData((prev) => ({ ...prev, proofUrl: data.url }));
        toast("Employee proof document uploaded successfully!", "success");
      } else {
        const err = await res.json();
        toast(err.error || "Upload failed", "error");
      }
    } catch (err: any) {
      toast("Error uploading file: " + err.message, "error");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const method = isEdit ? "PUT" : "POST";
      const endpoint = isEdit ? `/api/employees/${employeeId}` : "/api/employees";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        toast(
          isEdit ? "Employee record updated successfully!" : "New employee registered successfully!",
          "success"
        );
        router.push("/admin/employees");
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
            href="/admin/employees"
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
            href="/admin/employees"
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
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Designation / Role *
            </label>
            <input
              type="text"
              required
              value={formData.designation}
              onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
              placeholder="e.g. Field Sales Representative"
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-zinc-900"
            />
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
              accept="image/*"
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
          href="/admin/employees"
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
