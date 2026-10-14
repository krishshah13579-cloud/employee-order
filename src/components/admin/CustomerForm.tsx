"use client";

import { useState, useRef } from "react";
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
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import type { CustomerData } from "@/lib/types";

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

  const [formData, setFormData] = useState({
    shopName: initialData?.shopName || "",
    gstPanNo: initialData?.gstPanNo || "",
    address: initialData?.address || "",
    city: initialData?.city || "",
    state: initialData?.state || "",
    phoneNumber: initialData?.phoneNumber || "",
    visitingCardUrl: initialData?.visitingCardUrl || "",
    contactPerson: initialData?.contactPerson || "",
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
        setFormData((prev) => ({ ...prev, visitingCardUrl: data.url }));
        toast("Visiting card photo uploaded successfully!", "success");
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
