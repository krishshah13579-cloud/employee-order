"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import {
  FileEdit,
  Building,
  Landmark,
  FileText,
  Save,
  RotateCcw,
  CheckCircle2,
  Sparkles,
  Eye,
  SlidersHorizontal,
} from "lucide-react";
import {
  DEFAULT_INVOICE_TEMPLATE,
  type InvoiceTemplateSettings,
} from "@/lib/invoice-template-types";

export default function InvoiceSettingsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<InvoiceTemplateSettings>(DEFAULT_INVOICE_TEMPLATE);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/employee/invoice-settings");
      if (res.ok) {
        const data = await res.json();
        setFormData({ ...DEFAULT_INVOICE_TEMPLATE, ...data });
      }
    } catch (err: any) {
      toast("Failed to load invoice settings: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await fetch("/api/employee/invoice-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save settings");
      toast("Invoice & Order Form template defaults saved successfully!", "success");
    } catch (err: any) {
      toast(err.message || "Failed to save settings", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = () => {
    if (confirm("Reset all template settings back to original defaults?")) {
      setFormData(DEFAULT_INVOICE_TEMPLATE);
      toast("Reset fields to system defaults. Click 'Save' to persist.", "info");
    }
  };

  return (
    <div className="max-w-5xl mx-auto pb-16 space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="p-2 bg-orange-100 text-orange-700 rounded-xl">
                <SlidersHorizontal size={22} />
              </span>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Invoice &amp; Order Form Template Settings
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Configure permanent company headers, bank accounts, terms &amp; conditions, and notes for all printable invoices and order forms.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <RotateCcw size={14} />
              <span>Reset Defaults</span>
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loading}
              className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
            >
              <Save size={14} />
              <span>{saving ? "Saving..." : "Save Settings"}</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500 bg-white rounded-2xl border border-slate-200">
            <div className="animate-spin w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-sm font-semibold">Loading template settings...</p>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            {/* 1. COMPANY HEADER & FIRM DETAILS */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-6 py-4 bg-slate-900 text-white flex items-center gap-2">
                <Building size={18} className="text-orange-400" />
                <h2 className="text-sm font-bold tracking-wide uppercase">
                  1. Company Header &amp; Contact Details
                </h2>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
                <div className="md:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">
                    Company / Firm Name (Top Title)
                  </label>
                  <input
                    type="text"
                    name="companyName"
                    value={formData.companyName}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-orange-500 outline-hidden"
                    placeholder="e.g. KRISH CLOTHING CO."
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">
                    Address Line 1
                  </label>
                  <input
                    type="text"
                    name="addressLine1"
                    value={formData.addressLine1}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-slate-800 focus:ring-2 focus:ring-orange-500 outline-hidden"
                    placeholder="2ND FLOOR, SAMET BUSINESS PARK..."
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    City, Pincode &amp; Contact Line (Address Line 2)
                  </label>
                  <input
                    type="text"
                    name="addressLine2"
                    value={formData.addressLine2}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-slate-800 focus:ring-2 focus:ring-orange-500 outline-hidden"
                    placeholder="AHMEDABAD - 380008 (M) : 8128756632"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Phone / Mobile Number
                  </label>
                  <input
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-slate-800 focus:ring-2 focus:ring-orange-500 outline-hidden"
                    placeholder="+91 8128756632"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-slate-800 focus:ring-2 focus:ring-orange-500 outline-hidden"
                    placeholder="krishclothingco3@gmail.com"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    GSTIN Number
                  </label>
                  <input
                    type="text"
                    name="gstNo"
                    value={formData.gstNo}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl font-mono text-slate-900 uppercase focus:ring-2 focus:ring-orange-500 outline-hidden"
                    placeholder="24LAAPS9916E1ZD"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    PAN Number
                  </label>
                  <input
                    type="text"
                    name="panNo"
                    value={formData.panNo}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl font-mono text-slate-900 uppercase focus:ring-2 focus:ring-orange-500 outline-hidden"
                    placeholder="LAAPS9916E"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Place of Supply (State)
                  </label>
                  <input
                    type="text"
                    name="placeOfSupply"
                    value={formData.placeOfSupply}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-slate-800 focus:ring-2 focus:ring-orange-500 outline-hidden"
                    placeholder="24-Gujarat"
                  />
                </div>
              </div>
            </div>

            {/* 2. BANK ACCOUNT DETAILS */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-6 py-4 bg-slate-900 text-white flex items-center gap-2">
                <Landmark size={18} className="text-emerald-400" />
                <h2 className="text-sm font-bold tracking-wide uppercase">
                  2. Bank Account Details (For RTGS / NEFT / IMPS)
                </h2>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Bank Name
                  </label>
                  <input
                    type="text"
                    name="bankName"
                    value={formData.bankName}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-slate-800 font-semibold focus:ring-2 focus:ring-emerald-500 outline-hidden"
                    placeholder="ICICI BANK"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Bank Account Number
                  </label>
                  <input
                    type="text"
                    name="accountNo"
                    value={formData.accountNo}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-hidden"
                    placeholder="750705000692"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    RTGS / IFSC Code
                  </label>
                  <input
                    type="text"
                    name="ifscCode"
                    value={formData.ifscCode}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 uppercase focus:ring-2 focus:ring-emerald-500 outline-hidden"
                    placeholder="ICIC0007507"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Beneficiary Name
                  </label>
                  <input
                    type="text"
                    name="beneficiaryName"
                    value={formData.beneficiaryName}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-hidden"
                    placeholder="KRISH CLOTHING CO."
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">
                    Bank Branch &amp; City
                  </label>
                  <input
                    type="text"
                    name="branch"
                    value={formData.branch}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-hidden"
                    placeholder="Khokhra Maninagar, Ahmedabad"
                  />
                </div>
              </div>
            </div>

            {/* 3. TERMS & CONDITIONS */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-6 py-4 bg-slate-900 text-white flex items-center gap-2">
                <FileText size={18} className="text-amber-400" />
                <h2 className="text-sm font-bold tracking-wide uppercase">
                  3. Terms &amp; Conditions (Printed on Invoice Footer)
                </h2>
              </div>
              <div className="p-6 space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Term 1
                  </label>
                  <input
                    type="text"
                    name="terms1"
                    value={formData.terms1}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-slate-800 focus:ring-2 focus:ring-amber-500 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Term 2
                  </label>
                  <input
                    type="text"
                    name="terms2"
                    value={formData.terms2}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-slate-800 focus:ring-2 focus:ring-amber-500 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Term 3
                  </label>
                  <input
                    type="text"
                    name="terms3"
                    value={formData.terms3}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-slate-800 focus:ring-2 focus:ring-amber-500 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Term 4
                  </label>
                  <input
                    type="text"
                    name="terms4"
                    value={formData.terms4}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-slate-800 focus:ring-2 focus:ring-amber-500 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Term 5
                  </label>
                  <input
                    type="text"
                    name="terms5"
                    value={formData.terms5}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-slate-800 focus:ring-2 focus:ring-amber-500 outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* 4. NOTES & SIGNATORY */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-6 py-4 bg-slate-900 text-white flex items-center gap-2">
                <FileEdit size={18} className="text-blue-400" />
                <h2 className="text-sm font-bold tracking-wide uppercase">
                  4. Signatory, Payment Note &amp; Defaults
                </h2>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Signatory Heading
                  </label>
                  <input
                    type="text"
                    name="signatoryLabel"
                    value={formData.signatoryLabel}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-slate-800 font-bold focus:ring-2 focus:ring-blue-500 outline-hidden"
                    placeholder="For, KRISH CLOTHING CO."
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Signatory Sub-label
                  </label>
                  <input
                    type="text"
                    name="signatoryTitle"
                    value={formData.signatoryTitle}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-slate-800 focus:ring-2 focus:ring-blue-500 outline-hidden"
                    placeholder="(Authorised Signatory)"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Default Transport Name
                  </label>
                  <input
                    type="text"
                    name="defaultTransport"
                    value={formData.defaultTransport}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-slate-800 focus:ring-2 focus:ring-blue-500 outline-hidden"
                    placeholder="Patel Transport Co."
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Default HSN Code
                  </label>
                  <input
                    type="text"
                    name="defaultHsn"
                    value={formData.defaultHsn}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl font-mono text-slate-800 focus:ring-2 focus:ring-blue-500 outline-hidden"
                    placeholder="6203"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">
                    Payment Note Prefix
                  </label>
                  <input
                    type="text"
                    name="creditNotePrefix"
                    value={formData.creditNotePrefix}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-slate-800 focus:ring-2 focus:ring-blue-500 outline-hidden"
                    placeholder="PAYMENT EVERY WEEK AND SHOULD BE COMPLETED WITHIN"
                  />
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={handleResetDefaults}
                className="px-5 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition shadow-xs cursor-pointer"
              >
                Reset to Defaults
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-8 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl transition shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Save size={16} />
                <span>{saving ? "Saving Changes..." : "Save Template Settings"}</span>
              </button>
            </div>
          </form>
        )}
    </div>
  );
}
