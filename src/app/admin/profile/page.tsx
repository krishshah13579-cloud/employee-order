"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import {
  ShieldCheck,
  Building2,
  Mail,
  Phone,
  MapPin,
  Landmark,
  CreditCard,
  FileText,
  Save,
  CheckCircle,
  RefreshCw,
} from "lucide-react";
import type { AdminProfileData } from "@/lib/types";

export default function AdminProfilePage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState<AdminProfileData>({
    fullName: "",
    email: "",
    phone: "",
    companyName: "",
    gstNo: "",
    panNo: "",
    address: "",
    bankName: "",
    accountNo: "",
    ifscCode: "",
    notes: "",
  });

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/profile");
      if (res.ok) {
        const data = await res.json();
        setFormData(data);
      }
    } catch (err: any) {
      toast("Failed to load admin profile: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        const updated = await res.json();
        setFormData(updated);
        toast("Admin profile and business details updated successfully!", "success");
      } else {
        const err = await res.json();
        toast(err.error || "Failed to update profile", "error");
      }
    } catch (err: any) {
      toast("Error saving profile: " + err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 mb-8 border-b border-gray-200">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600 mb-1">
              <ShieldCheck size={16} /> Admin Management
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Admin & Company Details</h1>
            <p className="text-sm text-gray-500 mt-1">
              Configure master admin profile, wholesale business registration, GST details, and billing accounts.
            </p>
          </div>
          <button
            onClick={fetchProfile}
            disabled={loading}
            className="mt-4 md:mt-0 flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-sm transition-all"
          >
            <RefreshCw size={16} className={loading ? "animate-spin text-blue-600" : ""} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl p-12 border border-gray-100 shadow-sm text-center">
            <RefreshCw size={32} className="animate-spin text-blue-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Loading admin details...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left 2 Columns: Editable Form */}
            <div className="lg:col-span-2">
              <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
                {/* 1. Personal & Company Identity */}
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-100 flex items-center gap-2">
                    <Building2 size={18} className="text-blue-600" /> Business Identity & Owner Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                        Company / Firm Name *
                      </label>
                      <input
                        type="text"
                        name="companyName"
                        value={formData.companyName}
                        onChange={handleChange}
                        required
                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                        placeholder="e.g. GarmentPro Texfab Wholesalers"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                        Admin / Owner Full Name *
                      </label>
                      <input
                        type="text"
                        name="fullName"
                        value={formData.fullName}
                        onChange={handleChange}
                        required
                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                        placeholder="e.g. Rajesh Shah"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                        Email Address
                      </label>
                      <div className="relative">
                        <Mail size={16} className="absolute left-3.5 top-3 text-gray-400" />
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          className="w-full pl-10 pr-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                          placeholder="admin@example.com"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                        Contact Number / Mobile *
                      </label>
                      <div className="relative">
                        <Phone size={16} className="absolute left-3.5 top-3 text-gray-400" />
                        <input
                          type="text"
                          name="phone"
                          value={formData.phone}
                          onChange={handleChange}
                          required
                          className="w-full pl-10 pr-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                          placeholder="+91 98765 43210"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Tax Identification */}
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-100 flex items-center gap-2">
                    <FileText size={18} className="text-blue-600" /> Tax & Legal Registrations
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                        GSTIN Number *
                      </label>
                      <input
                        type="text"
                        name="gstNo"
                        value={formData.gstNo}
                        onChange={handleChange}
                        required
                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-mono uppercase focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                        placeholder="24AAAAA0000A1Z5"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                        PAN Number *
                      </label>
                      <input
                        type="text"
                        name="panNo"
                        value={formData.panNo}
                        onChange={handleChange}
                        required
                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-mono uppercase focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                        placeholder="AAAAA0000A"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Address */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <MapPin size={15} className="text-blue-600" /> Registered Business / Warehouse Address *
                  </label>
                  <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    required
                    rows={3}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    placeholder="Shop/Plot No, Market name, Ring road, City, State, PIN"
                  />
                </div>

                {/* 4. Bank Account Details */}
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-100 flex items-center gap-2">
                    <Landmark size={18} className="text-blue-600" /> Commercial Bank Details (For Invoices)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                        Bank Name
                      </label>
                      <input
                        type="text"
                        name="bankName"
                        value={formData.bankName}
                        onChange={handleChange}
                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                        placeholder="State Bank of India"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                        Account Number
                      </label>
                      <div className="relative">
                        <CreditCard size={16} className="absolute left-3.5 top-3 text-gray-400" />
                        <input
                          type="text"
                          name="accountNo"
                          value={formData.accountNo}
                          onChange={handleChange}
                          className="w-full pl-10 pr-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-mono focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                          placeholder="302948571029"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                        IFSC Code
                      </label>
                      <input
                        type="text"
                        name="ifscCode"
                        value={formData.ifscCode}
                        onChange={handleChange}
                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-mono uppercase focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                        placeholder="SBIN0004050"
                      />
                    </div>
                  </div>
                </div>

                {/* 5. Notes */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                    Invoice Terms / Company Tagline
                  </label>
                  <textarea
                    name="notes"
                    value={formData.notes || ""}
                    onChange={handleChange}
                    rows={2}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    placeholder="e.g. 5% GST applicable on all wholesale garment consignments. Transport charges extra."
                  />
                </div>

                {/* Submit button */}
                <div className="pt-4 border-t border-gray-100 flex items-center justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-600/20 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    <Save size={18} />
                    {saving ? "Saving Changes..." : "Save Admin Details"}
                  </button>
                </div>
              </form>
            </div>

            {/* Right 1 Column: Live Business Profile Preview */}
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-6 shadow-xl border border-slate-700">
                <div className="flex items-center justify-between pb-4 border-b border-slate-700/80 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🧵</span>
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
                      Wholesale Letterhead
                    </span>
                  </div>
                  <span className="px-2 py-0.5 text-[10px] bg-green-500/20 text-green-400 border border-green-500/30 rounded-full font-bold flex items-center gap-1">
                    <CheckCircle size={10} /> Active
                  </span>
                </div>

                <h2 className="text-xl font-bold tracking-tight text-white mb-1">
                  {formData.companyName || "Your Wholesale Business"}
                </h2>
                <p className="text-xs text-slate-400 mb-4">
                  Proprietor: <span className="text-slate-200 font-semibold">{formData.fullName || "Admin"}</span>
                </p>

                <div className="space-y-2.5 text-xs text-slate-300 pt-2 border-t border-slate-700/60">
                  <div className="flex items-start gap-2">
                    <MapPin size={14} className="text-blue-400 shrink-0 mt-0.5" />
                    <span>{formData.address || "Add your business address"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone size={14} className="text-blue-400 shrink-0" />
                    <span>{formData.phone || "No phone added"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail size={14} className="text-blue-400 shrink-0" />
                    <span>{formData.email || "No email added"}</span>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-700/80 grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
                    <span className="text-[10px] uppercase text-slate-400 font-bold block">GSTIN</span>
                    <span className="font-mono text-blue-300 font-bold text-xs">{formData.gstNo || "N/A"}</span>
                  </div>
                  <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
                    <span className="text-[10px] uppercase text-slate-400 font-bold block">PAN</span>
                    <span className="font-mono text-blue-300 font-bold text-xs">{formData.panNo || "N/A"}</span>
                  </div>
                </div>

                {formData.bankName && (
                  <div className="mt-4 p-3 bg-blue-950/40 rounded-xl border border-blue-900/50 text-[11px] text-slate-300">
                    <span className="text-[10px] uppercase text-blue-400 font-bold block mb-1">
                      Bank Clearance Account
                    </span>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Bank:</span>
                      <span className="font-semibold text-white">{formData.bankName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">A/C:</span>
                      <span className="font-mono text-white">{formData.accountNo || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">IFSC:</span>
                      <span className="font-mono text-white">{formData.ifscCode || "—"}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
