"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  Tag,
  CheckCircle2,
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

  const searchParams = useSearchParams();

  const initialBase: "RETAILER" | "WHOLESALER" =
    initialData?.businessType?.toUpperCase().includes("WHOLESAL") ? "WHOLESALER" : "RETAILER";
  const initialNoGst = Boolean(
    initialData?.businessType?.toUpperCase().includes("WITHOUT GST") ||
    initialData?.businessType?.toUpperCase().includes("NO GST")
  );
  const initialHasSplDisc = Boolean(
    (initialData?.specialDiscount !== undefined && initialData?.specialDiscount !== null && initialData.specialDiscount > 0) ||
    initialData?.businessType === "RETAILER WITH SPECIAL DISCOUNT"
  );

  const [baseBusinessType, setBaseBusinessType] = useState<"RETAILER" | "WHOLESALER">(initialBase);
  const [isWithoutGst, setIsWithoutGst] = useState(initialNoGst);
  const [hasSpecialDiscount, setHasSpecialDiscount] = useState(initialHasSplDisc);

  const [formData, setFormData] = useState({
    shopName: initialData?.shopName || searchParams?.get("shopName") || "",
    gstPanNo: initialData?.gstPanNo || "",
    address: initialData?.address || "",
    city: initialData?.city || searchParams?.get("city") || "",
    state: initialData?.state || "",
    phoneNumber: initialData?.phoneNumber || searchParams?.get("phone") || "",
    visitingCardUrl: initialData?.visitingCardUrl || searchParams?.get("visitingCardUrl") || "",
    contactPerson: initialData?.contactPerson || "",
    businessType: initialData?.businessType || "RETAILER",
    specialDiscount: initialData?.specialDiscount !== undefined && initialData?.specialDiscount !== null ? initialData.specialDiscount : 50,
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

      const finalBusinessType =
        baseBusinessType === "WHOLESALER"
          ? (isWithoutGst ? "WHOLESALER WITHOUT GST" : "WHOLESALER")
          : (isWithoutGst ? "RETAILER WITHOUT GST" : "RETAILER");

      const isCashCustomer = formData.shopName.trim().toUpperCase().includes("CASH");

      const finalGst =
        (isWithoutGst || isCashCustomer) && (!formData.gstPanNo.trim() || formData.gstPanNo.trim().toUpperCase() === "N/A")
          ? "URP"
          : formData.gstPanNo.trim().toUpperCase();

      const submitData = {
        ...formData,
        shopName: formData.shopName.trim().toUpperCase(),
        gstPanNo: finalGst,
        businessType: finalBusinessType,
        specialDiscount: hasSpecialDiscount ? (Number(formData.specialDiscount) || 0) : 0,
      };

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitData),
      });

      if (res.ok) {
        toast(
          isEdit ? "Customer shop updated successfully!" : "New customer shop added!",
          "success"
        );
        router.push("/admin/employee/customers");
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
            href="/admin/employee/customers"
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
            href="/admin/employee/customers"
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
            {(() => {
              const isCash = formData.shopName.trim().toUpperCase().includes("CASH");
              const noGstReq = isWithoutGst || isCash;
              return (
                <>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span>GST No. / PAN No. {noGstReq ? "(Optional - No GST Needed)" : "*"}</span>
                    {noGstReq && (
                      <span className="text-[10px] text-teal-700 font-bold bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                        {isCash ? "No GST Needed (Cash Customer)" : "No GST Needed"}
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    required={!noGstReq}
                    value={formData.gstPanNo}
                    onChange={(e) => setFormData({ ...formData, gstPanNo: e.target.value.toUpperCase() })}
                    placeholder={noGstReq ? "Optional (Cash Customer / URP)" : "e.g. 24ABCDE1234F1Z5 or ABCDE1234F"}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-mono uppercase focus:outline-none focus:bg-white focus:ring-2 focus:ring-zinc-900"
                  />
                </>
              );
            })()}
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
          <div className="col-span-1 sm:col-span-2 space-y-3">
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
              Type of Business *
            </label>

            {/* 2 Main Options: Retailer & Wholesaler */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setBaseBusinessType("RETAILER")}
                className={`p-3.5 rounded-xl border-2 text-left flex items-center justify-between transition-all cursor-pointer ${
                  baseBusinessType === "RETAILER"
                    ? "border-blue-600 bg-blue-50/90 text-blue-950 shadow-xs ring-1 ring-blue-500"
                    : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                }`}
              >
                <div>
                  <div className="font-bold text-sm text-blue-900">Retailer</div>
                  <div className="text-[11px] text-blue-700 font-medium">Standard Retail Customer</div>
                </div>
                {baseBusinessType === "RETAILER" && (
                  <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setBaseBusinessType("WHOLESALER")}
                className={`p-3.5 rounded-xl border-2 text-left flex items-center justify-between transition-all cursor-pointer ${
                  baseBusinessType === "WHOLESALER"
                    ? "border-purple-600 bg-purple-50/90 text-purple-950 shadow-xs ring-1 ring-purple-500"
                    : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                }`}
              >
                <div>
                  <div className="font-bold text-sm text-purple-900">Wholesaler</div>
                  <div className="text-[11px] text-purple-700 font-medium">Standard Wholesale Customer</div>
                </div>
                {baseBusinessType === "WHOLESALER" && (
                  <CheckCircle2 className="w-5 h-5 text-purple-600 shrink-0" />
                )}
              </button>
            </div>

            {/* 2 Options Checkboxes: Without GST & Special Discount - SHOWN ONLY TO ADMIN / T.L. */}
            <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl space-y-2.5">
              <div className="text-[10px] font-black uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                <Lock size={12} className="text-gray-400" />
                <span>Admin & T.L. Options ({baseBusinessType === "WHOLESALER" ? "Wholesaler" : "Retailer"})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300 cursor-pointer transition select-none">
                  <input
                    type="checkbox"
                    checked={isWithoutGst}
                    onChange={(e) => setIsWithoutGst(e.target.checked)}
                    className="w-4 h-4 text-orange-600 rounded border-gray-300 focus:ring-orange-500 cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-black text-gray-900 block">Without GST</span>
                    <span className="text-[10px] text-gray-500 font-medium">GST/PAN optional • 0% GST on bills</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300 cursor-pointer transition select-none">
                  <input
                    type="checkbox"
                    checked={hasSpecialDiscount}
                    onChange={(e) => setHasSpecialDiscount(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500 cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-black text-gray-900 block">Special Discount</span>
                    <span className="text-[10px] text-gray-500 font-medium">Apply custom ₹ discount per piece</span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Special Discount Field for Retailer / Wholesaler with Special Discount */}
          {hasSpecialDiscount && (
            <div className="col-span-1 sm:col-span-2 p-4 bg-emerald-50/80 border-2 border-emerald-300 rounded-xl space-y-2 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <label className="text-xs font-black text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                  <Tag size={14} className="text-emerald-700" />
                  <span>What special discount would you like to give? *</span>
                </label>
                <span className="text-[11px] font-bold text-emerald-700">
                  {baseBusinessType === "RETAILER"
                    ? "Formula: (MRP / 2) - Special Discount"
                    : "Formula: Wholesale Price - Special Discount"}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="relative w-full sm:w-48">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-800 font-black text-sm">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={formData.specialDiscount}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        specialDiscount: parseFloat(e.target.value) || 0,
                      })
                    }
                    placeholder="e.g. 50"
                    className="w-full pl-8 pr-3 py-2 bg-white border border-emerald-400 rounded-lg text-emerald-950 font-mono font-bold text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <span className="text-xs text-emerald-800 font-medium">
                  {baseBusinessType === "RETAILER"
                    ? "Enter discount per PC (e.g. Special Discount 50 will deduct ₹50 per piece from MRP/2)."
                    : "Enter discount per PC (e.g. Special Discount 50 will deduct ₹50 per piece from Wholesale Price)."}
                </span>
              </div>
            </div>
          )}

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
          href="/admin/employee/customers"
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
