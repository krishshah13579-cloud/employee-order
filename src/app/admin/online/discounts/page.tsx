"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  Trash2,
  Edit2,
  Tag,
  Loader2,
  Calendar,
  Percent,
  CheckCircle,
  XCircle,
  X,
  IndianRupee,
  Mail,
  Send,
  Users,
  Sparkles,
  RefreshCw,
  Clock,
  ShieldCheck,
  Check,
} from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { Discount } from "@/types";

interface CampaignCandidate {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  orderCount: number;
  lastCampaignSentAt: string | null;
  expiredCouponCode: string;
  expiredAt: string | null;
  isEligible: boolean;
}

export default function AdminDiscountsPage() {
  const [activeTab, setActiveTab] = useState<"discounts" | "campaign">("discounts");

  // Discounts state
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<Discount | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    code: "",
    type: "PERCENTAGE",
    value: "",
    minOrder: "",
    maxDiscount: "",
    maxUses: "",
    expiresAt: "",
    targetAudience: "ALL",
    minOrders: "",
    maxOrders: "",
    minSpend: "",
    description: "",
  });

  // Campaign state
  const [campaignLoading, setCampaignLoading] = useState(false);
  const [campaignSending, setCampaignSending] = useState(false);
  const [singleSendingId, setSingleSendingId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<CampaignCandidate[]>([]);
  const [campaignMsg, setCampaignMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [campaignParams, setCampaignParams] = useState({
    discountValue: "10",
    discountType: "PERCENTAGE",
    minOrder: "999",
    maxDiscount: "350",
    validDays: "7",
  });

  const loadDiscounts = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/online/discounts");
      if (!res.ok) throw new Error("Failed to load discounts");
      const data = await res.json();
      const unusedDiscounts = Array.isArray(data)
        ? data.filter((d: any) => (d.usedCount || 0) === 0)
        : [];
      setDiscounts(unusedDiscounts);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error fetching discounts");
    } finally {
      setLoading(false);
    }
  };

  const loadCampaignCandidates = async () => {
    try {
      setCampaignLoading(true);
      const res = await fetch("/api/admin/campaigns/expired-discounts");
      if (!res.ok) throw new Error("Failed to load campaign candidates");
      const data = await res.json();
      if (data.candidates) {
        setCandidates(data.candidates);
      }
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setCampaignLoading(false);
    }
  };

  useEffect(() => {
    loadDiscounts();
    loadCampaignCandidates();
  }, []);

  const openCreateModal = () => {
    setEditingDiscount(null);
    setFormData({
      code: "",
      type: "PERCENTAGE",
      value: "",
      minOrder: "",
      maxDiscount: "",
      maxUses: "",
      expiresAt: "",
      targetAudience: "ALL",
      minOrders: "",
      maxOrders: "",
      minSpend: "",
      description: "",
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (discount: Discount) => {
    setEditingDiscount(discount);
    setFormData({
      code: discount.code,
      type: discount.type,
      value: String(discount.value),
      minOrder: discount.minOrder > 0 ? String(discount.minOrder) : "",
      maxDiscount: discount.maxDiscount && discount.maxDiscount > 0 ? String(discount.maxDiscount) : "",
      maxUses: discount.maxUses ? String(discount.maxUses) : "",
      expiresAt: discount.expiresAt
        ? new Date(discount.expiresAt).toISOString().split("T")[0]
        : "",
      targetAudience: discount.targetAudience || "ALL",
      minOrders: discount.minOrders !== null && discount.minOrders !== undefined ? String(discount.minOrders) : "",
      maxOrders: discount.maxOrders !== null && discount.maxOrders !== undefined ? String(discount.maxOrders) : "",
      minSpend: discount.minSpend !== null && discount.minSpend !== undefined ? String(discount.minSpend) : "",
      description: discount.description || "",
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleToggleActive = async (discount: Discount) => {
    try {
      const res = await fetch("/api/online/discounts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: discount.id,
          active: !discount.active,
        }),
      });

      if (!res.ok) throw new Error("Failed to toggle discount");
      const updated = await res.json();
      setDiscounts((prev) =>
        prev.map((d) => (d.id === discount.id ? updated : d))
      );
    } catch (err) {
      console.error(err);
      alert("Could not update discount status");
    }
  };

  const handleDelete = async (id: string, code: string) => {
    if (!confirm(`Are you sure you want to delete coupon code "${code}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/online/discounts?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete discount");
      setDiscounts((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      console.error(err);
      alert("Could not delete discount code");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      if (!formData.code.trim()) throw new Error("Code is required");
      if (formData.value === "" || Number(formData.value) <= 0) {
        throw new Error("Value must be greater than 0");
      }

      const payload = {
        code: formData.code.trim().toUpperCase(),
        type: formData.type,
        value: formData.value,
        minOrder: formData.minOrder || "0",
        maxDiscount: formData.maxDiscount || null,
        maxUses: formData.maxUses || null,
        expiresAt: formData.expiresAt || null,
        targetAudience: formData.targetAudience,
        minOrders: formData.minOrders || null,
        maxOrders: formData.maxOrders || null,
        minSpend: formData.minSpend || null,
        description: formData.description || null,
      };

      if (editingDiscount) {
        // Update existing discount
        const res = await fetch("/api/online/discounts", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingDiscount.id,
            ...payload,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to update discount");
        }

        setDiscounts((prev) =>
          prev.map((d) => (d.id === editingDiscount.id ? data : d))
        );
      } else {
        // Create new discount
        const res = await fetch("/api/online/discounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to create discount");
        }

        setDiscounts((prev) => [data, ...prev]);
      }

      setIsModalOpen(false);
      setEditingDiscount(null);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Error saving discount");
    } finally {
      setSubmitting(false);
    }
  };

  // Run campaign for all candidates
  const handleRunAllCampaign = async () => {
    if (candidates.length === 0) return;
    if (
      !confirm(
        `Are you sure you want to run the Re-Engagement Email Campaign for all ${candidates.length} registered customer(s) with expired coupons?`
      )
    ) {
      return;
    }

    setCampaignSending(true);
    setCampaignMsg(null);

    try {
      const res = await fetch("/api/admin/campaigns/expired-discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discountValue: Number(campaignParams.discountValue),
          discountType: campaignParams.discountType,
          minOrder: Number(campaignParams.minOrder),
          maxDiscount: campaignParams.maxDiscount ? Number(campaignParams.maxDiscount) : null,
          validDays: Number(campaignParams.validDays),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to run campaign");

      setCampaignMsg({
        type: "success",
        text: `Campaign executed successfully! Generated new renewal coupons and dispatched emails to ${data.processedCount} registered customer(s).`,
      });

      // Reload candidates and discounts
      await loadCampaignCandidates();
      await loadDiscounts();
    } catch (err: any) {
      setCampaignMsg({
        type: "error",
        text: err.message || "Failed to dispatch campaign emails",
      });
    } finally {
      setCampaignSending(false);
    }
  };

  // Run campaign for a single user
  const handleSendSingle = async (candidate: CampaignCandidate) => {
    setSingleSendingId(candidate.id);
    setCampaignMsg(null);

    try {
      const res = await fetch("/api/admin/campaigns/expired-discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: candidate.id,
          discountValue: Number(campaignParams.discountValue),
          discountType: campaignParams.discountType,
          minOrder: Number(campaignParams.minOrder),
          maxDiscount: campaignParams.maxDiscount ? Number(campaignParams.maxDiscount) : null,
          validDays: Number(campaignParams.validDays),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send coupon email");

      setCampaignMsg({
        type: "success",
        text: `Renewal coupon and re-engagement email successfully sent to ${candidate.email}!`,
      });

      await loadCampaignCandidates();
      await loadDiscounts();
    } catch (err: any) {
      setCampaignMsg({
        type: "error",
        text: err.message || "Failed to send coupon email",
      });
    } finally {
      setSingleSendingId(null);
    }
  };

  const renderAudienceBadge = (discount: Discount) => {
    if (discount.userId || discount.userPhone) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
          Personal Account
        </span>
      );
    }

    const aud = discount.targetAudience || "ALL";
    switch (aud) {
      case "FIRST_PURCHASE":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">
            First-Time Buyers (0 Orders)
          </span>
        );
      case "REPEAT_BUYER":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
            Repeat Buyers (1+ Orders)
          </span>
        );
      case "LOYAL_VIP":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
            VIP Patrons (3+ Orders / ₹4K+)
          </span>
        );
      case "RETURNING_VISITOR":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full">
            Returning Visitors (2+ Visits)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-600 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">
            All Shoppers
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Discounts &amp; Email Campaigns
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Segmented promotional discounts, audience targeting, and automated re-engagement campaigns.
          </p>
        </div>

        {activeTab === "discounts" && (
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-black hover:bg-gray-800 transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Discount</span>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("discounts")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition-colors cursor-pointer ${
            activeTab === "discounts"
              ? "border-black text-black"
              : "border-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
          <Tag className="w-4 h-4" />
          <span>Discounts &amp; Promos ({discounts.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("campaign")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition-colors cursor-pointer ${
            activeTab === "campaign"
              ? "border-rose-600 text-rose-600"
              : "border-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
          <Mail className="w-4 h-4" />
          <span>Expired Coupon Email Campaign</span>
          {candidates.length > 0 && (
            <span className="ml-1 px-2 py-0.5 text-xs font-black bg-rose-100 text-rose-700 rounded-full animate-pulse">
              {candidates.length} Ready
            </span>
          )}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* TAB 1: DISCOUNTS TABLE */}
      {activeTab === "discounts" && (
        <>
          <div className="bg-amber-50/70 border border-amber-200 p-3.5 rounded-lg text-xs text-amber-900 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Audience Targeting Active: </span>
              Users do not see all discounts at once. Each customer is presented only the discounts relevant to their purchases, usage history, or browsing visits.
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center min-h-[300px] gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
              <p className="text-sm text-gray-500">Loading discount codes...</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                {discounts.length === 0 ? (
                  <div className="p-12 text-center text-sm text-gray-500">
                    No discounts found. Create your first promotion above!
                  </div>
                ) : (
                  <table className="w-full text-left text-sm text-gray-600">
                    <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-700 border-b border-gray-200">
                      <tr>
                        <th scope="col" className="px-5 py-3">Code</th>
                        <th scope="col" className="px-5 py-3">Type</th>
                        <th scope="col" className="px-5 py-3">Discount Value</th>
                        <th scope="col" className="px-5 py-3">Target Audience</th>
                        <th scope="col" className="px-5 py-3">Min Order</th>
                        <th scope="col" className="px-5 py-3">Max Cap</th>
                        <th scope="col" className="px-5 py-3">Uses</th>
                        <th scope="col" className="px-5 py-3">Expires</th>
                        <th scope="col" className="px-5 py-3">Status</th>
                        <th scope="col" className="px-5 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {discounts.map((discount) => {
                        const isExpired =
                          discount.expiresAt &&
                          new Date(discount.expiresAt) < new Date();

                        return (
                          <tr
                            key={discount.id}
                            className="hover:bg-gray-50/80 transition-colors"
                          >
                            <td className="px-5 py-3.5">
                              <span className="font-mono text-xs font-bold text-gray-900 bg-gray-100 px-2.5 py-1 rounded-md border border-gray-200">
                                {discount.code}
                              </span>
                            </td>
                            <td className="px-5 py-3.5">
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-700">
                                {discount.type === "PERCENTAGE" ? (
                                  <>
                                    <Percent className="w-3.5 h-3.5 text-blue-600" />
                                    Percentage
                                  </>
                                ) : (
                                  <>
                                    <IndianRupee className="w-3.5 h-3.5 text-emerald-600" />
                                    Fixed
                                  </>
                                )}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 font-semibold text-gray-900">
                              {discount.type === "PERCENTAGE"
                                ? `${discount.value}% OFF`
                                : `${formatPrice(discount.value)} OFF`}
                            </td>
                            <td className="px-5 py-3.5">
                              {renderAudienceBadge(discount)}
                            </td>
                            <td className="px-5 py-3.5 text-gray-700">
                              {discount.minOrder > 0
                                ? formatPrice(discount.minOrder)
                                : "No min"}
                            </td>
                            <td className="px-5 py-3.5 text-gray-700">
                              {discount.maxDiscount && discount.maxDiscount > 0 ? (
                                <span className="inline-flex items-center gap-1 font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-xs">
                                  Up to {formatPrice(discount.maxDiscount)}
                                </span>
                              ) : (
                                <span className="text-gray-400 text-xs italic">No cap</span>
                              )}
                            </td>
                            <td className="px-5 py-3.5 text-gray-600">
                              {discount.usedCount}
                              {discount.maxUses ? ` / ${discount.maxUses}` : " uses"}
                            </td>
                            <td className="px-5 py-3.5 text-xs text-gray-500">
                              {discount.expiresAt ? (
                                <span
                                  className={isExpired ? "text-red-600 font-medium" : ""}
                                >
                                  {new Date(discount.expiresAt).toLocaleDateString(
                                    "en-IN",
                                    {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                    }
                                  )}
                                  {isExpired ? " (Expired)" : ""}
                                </span>
                              ) : (
                                "Never"
                              )}
                            </td>
                            <td className="px-5 py-3.5">
                              <button
                                type="button"
                                onClick={() => handleToggleActive(discount)}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                                  discount.active
                                    ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                }`}
                              >
                                {discount.active ? (
                                  <>
                                    <CheckCircle className="w-3 h-3" /> Active
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="w-3 h-3" /> Inactive
                                  </>
                                )}
                              </button>
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openEditModal(discount)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer"
                                  title="Edit Discount Code"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                  <span>Edit</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(discount.id, discount.code)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg text-red-700 bg-red-50 hover:bg-red-100 transition-colors cursor-pointer"
                                  title="Delete Discount Code"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Delete</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* TAB 2: EXPIRED COUPON RE-ENGAGEMENT EMAIL CAMPAIGN */}
      {activeTab === "campaign" && (
        <div className="space-y-6">
          {/* Banner */}
          <div className="bg-gradient-to-r from-rose-950 via-zinc-900 to-black text-white p-6 rounded-2xl border border-rose-900/40 shadow-lg relative overflow-hidden">
            <div className="relative z-10 max-w-2xl">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30 mb-3">
                <Sparkles className="w-3.5 h-3.5 text-rose-400" />
                <span>Automated Sales Recovery Engine</span>
              </span>
              <h2 className="text-xl font-black tracking-tight">
                Re-Engage Customers with Expired Coupons
              </h2>
              <p className="text-xs sm:text-sm text-neutral-300 mt-2 leading-relaxed">
                When a registered customer&apos;s initial welcome discount expires without being used, they are primed for recovery. This campaign issues an exclusive, account-bound renewal discount code and sends a luxury branded invitation email directly to their inbox to drive immediate checkout conversions.
              </p>
              <p className="text-xs text-rose-300 italic mt-2">
                &ldquo;PREMIUM DESIGN SHOULDN&apos;T REQUIRE A PREMIUM MARKUP.&rdquo;
              </p>
            </div>
          </div>

          {campaignMsg && (
            <div
              className={`p-4 rounded-xl text-sm border flex items-center justify-between ${
                campaignMsg.type === "success"
                  ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                  : "bg-red-50 text-red-900 border-red-200"
              }`}
            >
              <span>{campaignMsg.text}</span>
              <button
                type="button"
                onClick={() => setCampaignMsg(null)}
                className="text-xs font-bold underline ml-3"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Quick Stats & Campaign Settings */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-gray-500">Ready for Campaign</span>
                <Users className="w-4 h-4 text-rose-600" />
              </div>
              <div className="mt-2 text-2xl font-black text-gray-900">
                {candidates.length}
              </div>
              <span className="text-[11px] text-gray-400">Registered users with expired coupons</span>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-gray-500">Renewal Value</span>
                <Percent className="w-4 h-4 text-blue-600" />
              </div>
              <div className="mt-2 text-2xl font-black text-gray-900">
                {campaignParams.discountValue}% OFF
              </div>
              <span className="text-[11px] text-gray-400">Min order ₹{campaignParams.minOrder}</span>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-gray-500">Validity Window</span>
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div className="mt-2 text-2xl font-black text-gray-900">
                {campaignParams.validDays} Days
              </div>
              <span className="text-[11px] text-gray-400">Fresh expiration set on dispatch</span>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold uppercase text-gray-500">One-Click Dispatch</span>
              </div>
              <button
                type="button"
                onClick={handleRunAllCampaign}
                disabled={campaignSending || candidates.length === 0}
                className="mt-2 w-full py-2.5 px-4 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                {campaignSending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Dispatching...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Run Campaign ({candidates.length})</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Candidates Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-700" />
                <h3 className="text-sm font-bold text-gray-900">
                  Registered Customers with Expired Discounts ({candidates.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={loadCampaignCandidates}
                disabled={campaignLoading}
                className="text-xs text-gray-600 hover:text-black flex items-center gap-1 font-semibold cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${campaignLoading ? "animate-spin" : ""}`} />
                <span>Refresh Candidates</span>
              </button>
            </div>

            {campaignLoading ? (
              <div className="flex items-center justify-center min-h-[200px] gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
                <p className="text-sm text-gray-500">Scanning registered accounts...</p>
              </div>
            ) : candidates.length === 0 ? (
              <div className="p-12 text-center text-sm text-gray-500">
                🎉 Excellent! All registered customers currently have active coupons or completed orders. No expired coupons waiting.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-700 border-b border-gray-200">
                    <tr>
                      <th scope="col" className="px-5 py-3">Customer</th>
                      <th scope="col" className="px-5 py-3">Phone</th>
                      <th scope="col" className="px-5 py-3">Expired Code</th>
                      <th scope="col" className="px-5 py-3">Expired On</th>
                      <th scope="col" className="px-5 py-3">Orders</th>
                      <th scope="col" className="px-5 py-3">Last Campaign Sent</th>
                      <th scope="col" className="px-5 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {candidates.map((c) => {
                      const isSingleBusy = singleSendingId === c.id;

                      return (
                        <tr key={c.id} className="hover:bg-gray-50/80 transition-colors">
                          <td className="px-5 py-3.5">
                            <div className="font-semibold text-gray-900">{c.name}</div>
                            <div className="text-xs text-gray-400">{c.email}</div>
                          </td>
                          <td className="px-5 py-3.5 text-xs text-gray-600">
                            {c.phone || "Not provided"}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="font-mono text-xs font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded">
                              {c.expiredCouponCode}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-xs text-gray-500">
                            {c.expiredAt
                              ? new Date(c.expiredAt).toLocaleDateString("en-IN", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })
                              : "Expired"}
                          </td>
                          <td className="px-5 py-3.5 text-xs font-semibold text-gray-700">
                            {c.orderCount} orders
                          </td>
                          <td className="px-5 py-3.5 text-xs text-gray-500">
                            {c.lastCampaignSentAt ? (
                              <span className="text-emerald-700 font-medium">
                                Sent on {new Date(c.lastCampaignSentAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                              </span>
                            ) : (
                              <span className="text-amber-700 font-medium">Never Sent</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <button
                              type="button"
                              onClick={() => handleSendSingle(c)}
                              disabled={isSingleBusy || campaignSending}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors disabled:opacity-50 cursor-pointer"
                            >
                              {isSingleBusy ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Send className="w-3.5 h-3.5" />
                              )}
                              <span>Send Renewal Mail</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add / Edit Discount Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-gray-200 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-gray-900" />
                <h3 className="text-lg font-bold text-gray-900">
                  {editingDiscount ? "Edit Discount Code" : "Create Discount Code"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingDiscount(null);
                }}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Coupon Code *
                </label>
                <input
                  type="text"
                  placeholder="e.g. SUMMER25"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value.toUpperCase() })
                  }
                  required
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm uppercase font-mono focus:outline-hidden focus:ring-2 focus:ring-black"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Discount Type *
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) =>
                      setFormData({ ...formData, type: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white focus:outline-hidden focus:ring-2 focus:ring-black"
                  >
                    <option value="PERCENTAGE">Percentage (%)</option>
                    <option value="FIXED">Fixed Amount (₹)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Discount Value *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={formData.type === "PERCENTAGE" ? "20" : "500"}
                    value={formData.value}
                    onChange={(e) =>
                      setFormData({ ...formData, value: e.target.value })
                    }
                    required
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-black"
                  />
                </div>
              </div>

              {/* Target Audience Selector */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Target Audience / Eligibility *
                </label>
                <select
                  value={formData.targetAudience}
                  onChange={(e) =>
                    setFormData({ ...formData, targetAudience: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white focus:outline-hidden focus:ring-2 focus:ring-black"
                >
                  <option value="ALL">All Shoppers (Public)</option>
                  <option value="FIRST_PURCHASE">First-Time Buyers Only (0 completed orders)</option>
                  <option value="REPEAT_BUYER">Repeat Buyers (1+ completed orders)</option>
                  <option value="LOYAL_VIP">Loyal Patrons / VIP (2+ orders or ₹4,000+ spend)</option>
                  <option value="RETURNING_VISITOR">Returning Visitors (2+ site visits, no order)</option>
                </select>
                <span className="text-[10px] text-gray-400 mt-1 block">
                  Ensures only qualifying customers see this discount, preventing coupon clutter.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Minimum Order (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0 (No minimum)"
                    value={formData.minOrder}
                    onChange={(e) =>
                      setFormData({ ...formData, minOrder: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-black"
                  />
                  <span className="text-[10px] text-gray-400 mt-0.5 block">
                    Min cart subtotal required
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Max Discount Limit (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="No cap (e.g. 500)"
                    value={formData.maxDiscount}
                    onChange={(e) =>
                      setFormData({ ...formData, maxDiscount: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-black"
                  />
                  <span className="text-[10px] text-gray-400 mt-0.5 block">
                    Max ₹ off cap (e.g. up to ₹500)
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Maximum Uses
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Unlimited"
                    value={formData.maxUses}
                    onChange={(e) =>
                      setFormData({ ...formData, maxUses: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-black"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Expiration Date
                  </label>
                  <input
                    type="date"
                    value={formData.expiresAt}
                    onChange={(e) =>
                      setFormData({ ...formData, expiresAt: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-black"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Description / Marketing Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. Exclusive festive discount on trousers"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-black"
                />
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-gray-100">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingDiscount(null);
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium text-white bg-black hover:bg-gray-800 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{editingDiscount ? "Update Discount" : "Save Discount"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
