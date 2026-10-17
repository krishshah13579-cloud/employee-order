"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Store,
  Save,
  Upload,
  Image as ImageIcon,
  CreditCard,
  Phone,
  MapPin,
  User,
  Loader2,
  Trash2,
  Lock,
  ShieldCheck,
  Clock,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import type { CustomerData } from "@/lib/types";
import { compressImageFile } from "@/lib/imageCompression";

interface CustomerFormProps {
  initialData?: CustomerData;
  isEdit?: boolean;
  customerId?: string | number;
}

export default function CustomerForm({
  initialData,
  isEdit = false,
  customerId,
}: CustomerFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    fetch("/api/auth/check")
      .then((r) => r.json())
      .then((data) => {
        if (data?.authenticated && data?.user?.isSuperAdmin) {
          setIsSuperAdmin(true);
        }
      })
      .catch(() => {});
  }, []);

  const [formData, setFormData] = useState({
    shopName: initialData?.shopName || "",
    gstPanNo: initialData?.gstPanNo || "",
    address: initialData?.address || "",
    city: initialData?.city || "",
    state: initialData?.state || "",
    phoneNumber: initialData?.phoneNumber || "",
    visitingCardUrl: initialData?.visitingCardUrl || "",
    contactPerson: initialData?.contactPerson || "",
    businessType: initialData?.businessType || "RETAILER",
    creditDays: initialData?.creditDays || 0,
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const dataUrl = await compressImageFile(file, 1200, 1200, 0.78);
      setFormData((prev) => ({ ...prev, visitingCardUrl: dataUrl }));
      toast("Visiting card photo attached successfully!", "success");
    } catch (err: any) {
      console.error("Visiting card upload error:", err);
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
      const endpoint = isEdit ? `/api/customers/${customerId}` : "/api/customers";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        toast(
          isEdit ? "Customer shop updated successfully!" : "New customer shop added!",
          "success"
        );
        router.push("/admin/customers");
      } else {
        const err = await res.json();
        toast(err.error || "Failed to save customer shop", "error");
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
            href="/admin/customers"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-black transition-colors mb-1.5"
          >
            <ArrowLeft size={14} />
            <span>Back to Customers</span>
          </Link>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Store className="w-5 h-5 text-gray-700" />
            <span>{isEdit ? `Edit Customer: ${formData.shopName}` : "Add New Customer Shop"}</span>
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Configure shop credentials, tax identifiers (GST/PAN), contact details, and visiting card proof.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/admin/customers"
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
            <span>{isEdit ? "Update Customer" : "Save Customer"}</span>
          </button>
        </div>
      </div>

      {/* 1. Shop & Tax Details */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-5">
        <div className="border-b border-gray-100 pb-3">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-blue-600" />
            <span>Shop Identification & Tax Details</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Customer / Shop Name *
            </label>
            <input
              type="text"
              required
              value={formData.shopName}
              onChange={(e) => setFormData({ ...formData, shopName: e.target.value })}
              placeholder="e.g. Royal Menswear Boutique"
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-zinc-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              GST No. / PAN No. *
            </label>
            <input
              type="text"
              required
              value={formData.gstPanNo}
              onChange={(e) => setFormData({ ...formData, gstPanNo: e.target.value.toUpperCase() })}
              placeholder="e.g. 24ABCDE1234F1Z5 or ABCDE1234F"
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-mono uppercase focus:outline-none focus:bg-white focus:ring-2 focus:ring-zinc-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Owner / Contact Person
            </label>
            <input
              type="text"
              value={formData.contactPerson}
              onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
              placeholder="e.g. Rajeshbhai Patel"
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-zinc-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Phone / Mobile Number *
            </label>
            <input
              type="tel"
              required
              value={formData.phoneNumber}
              onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
              placeholder="e.g. 9876543210"
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-zinc-900"
            />
          </div>

          {/* Business Type & Credit Terms */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Type of Business *
            </label>
            <select
              value={formData.businessType}
              onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-semibold focus:outline-none focus:bg-white focus:ring-2 focus:ring-zinc-900 cursor-pointer"
            >
              <option value="RETAILER">Retailer</option>
              <option value="WHOLESALER">Wholesaler</option>
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <Clock size={13} className="text-gray-500" />
                <span>Credit Days (Payment Terms)</span>
              </label>
              {!isSuperAdmin && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                  <Lock size={10} /> Super Admin Only
                </span>
              )}
            </div>

            <div className="relative">
              <input
                type="number"
                min="0"
                step="1"
                disabled={!isSuperAdmin}
                value={formData.creditDays}
                onChange={(e) => setFormData({ ...formData, creditDays: parseInt(e.target.value, 10) || 0 })}
                placeholder="0"
                className={`w-full px-3.5 py-2.5 border rounded-xl text-sm font-mono font-bold focus:outline-none ${
                  !isSuperAdmin
                    ? "bg-gray-100 text-gray-500 border-gray-200 cursor-not-allowed"
                    : "bg-gray-50 border-gray-300 text-gray-900 focus:bg-white focus:ring-2 focus:ring-zinc-900"
                }`}
              />
            </div>

            {isSuperAdmin ? (
              <div className="flex items-center gap-1.5 mt-2">
                {[0, 15, 30, 45, 60].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setFormData({ ...formData, creditDays: days })}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition cursor-pointer ${
                      formData.creditDays === days
                        ? "bg-zinc-900 text-white border-zinc-900"
                        : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {days === 0 ? "Advance (0d)" : `${days} Days`}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-amber-700 mt-1.5 flex items-center gap-1">
                <Lock size={12} /> Only Super Admin is authorized to modify Credit Days.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 2. Address */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-5">
        <div className="border-b border-gray-100 pb-3">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-600" />
            <span>Store & Delivery Address</span>
          </h2>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
            Shop Address (Shop No, Market/Complex, Road/Street) *
          </label>
          <textarea
            rows={2}
            required
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            placeholder="e.g. Shop 42, Textile Market, Ring Road"
            className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-zinc-900"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              City
            </label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              placeholder="e.g. Surat"
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-zinc-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              State
            </label>
            <input
              type="text"
              value={formData.state}
              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              placeholder="e.g. Gujarat"
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-zinc-900"
            />
          </div>
        </div>
      </div>

      {/* 3. Visiting Card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-5">
        <div className="border-b border-gray-100 pb-3">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-blue-600" />
            <span>Visiting Card (Photo / Proof)</span>
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Upload the visiting card image collected by sales employees from the client's shop.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-6">
          {formData.visitingCardUrl ? (
            <div className="relative w-48 h-32 rounded-xl overflow-hidden border border-gray-200 bg-gray-100 shadow-xs shrink-0 group">
              <img
                src={formData.visitingCardUrl}
                alt="Visiting Card Preview"
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, visitingCardUrl: "" }))}
                className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remove photo"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ) : (
            <div className="w-48 h-32 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 bg-gray-50 shrink-0">
              <ImageIcon size={28} />
              <span className="text-[11px] font-semibold mt-1">No Card Uploaded</span>
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
              <span>{uploading ? "Uploading Card..." : "Upload Visiting Card Photo"}</span>
            </button>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">
                Or Paste Image URL:
              </label>
              <input
                type="text"
                value={formData.visitingCardUrl}
                onChange={(e) => setFormData({ ...formData, visitingCardUrl: e.target.value })}
                placeholder="https://example.com/visiting-card.jpg"
                className="w-full px-3.5 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-zinc-900"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Sticky Action Bar */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
        <Link
          href="/admin/customers"
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
          <span>{isEdit ? "Update Customer Shop" : "Save Customer Shop"}</span>
        </button>
      </div>
    </form>
  );
}
