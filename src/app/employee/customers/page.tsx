"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import {
  Store,
  Plus,
  Search,
  Phone,
  MapPin,
  CreditCard,
  Image as ImageIcon,
  Edit2,
  Trash2,
  Eye,
  RefreshCw,
  Clock,
  Lock,
  CheckCircle2,
  ShieldCheck,
  Building,
  Save,
  Loader2,
} from "lucide-react";
import type { CustomerData } from "@/lib/types";

export default function CustomersPage() {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [previewCardUrl, setPreviewCardUrl] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // Tab filter: all | credit | 45days | advance | specialDiscount | wholesaleNoGst
  const [activeCreditTab, setActiveCreditTab] = useState<
    "all" | "credit" | "45days" | "advance" | "specialDiscount" | "wholesaleNoGst"
  >("all");

  // Super Admin Credit Days Quick-Edit Modal state
  const [editingCreditCustomer, setEditingCreditCustomer] = useState<CustomerData | null>(null);
  const [newCreditDays, setNewCreditDays] = useState<number>(0);
  const [savingCredit, setSavingCredit] = useState(false);

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

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const url = search ? `/api/customers?search=${encodeURIComponent(search)}` : "/api/customers";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setCustomers(data);
      }
    } catch (err: any) {
      toast("Failed to load customers: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCustomers();
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to delete customer "${name}"?`)) return;

    try {
      const res = await fetch(`/api/customers/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast("Customer removed successfully", "success");
        fetchCustomers();
      } else {
        const err = await res.json();
        toast(err.error || "Failed to delete customer", "error");
      }
    } catch (err: any) {
      toast("Error: " + err.message, "error");
    }
  };

  // Super Admin: Update Credit Days
  const handleSaveCreditDays = async () => {
    if (!editingCreditCustomer) return;
    if (!isSuperAdmin) {
      toast("Unauthorized: Only Super Admin can edit Credit Days", "error");
      return;
    }

    setSavingCredit(true);
    try {
      const res = await fetch(`/api/customers/${editingCreditCustomer.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editingCreditCustomer,
          creditDays: newCreditDays,
        }),
      });

      if (res.ok) {
        toast(`Credit terms updated to ${newCreditDays} days for "${editingCreditCustomer.shopName}"`, "success");
        setEditingCreditCustomer(null);
        fetchCustomers();
      } else {
        const err = await res.json();
        toast(err.error || "Failed to update credit days", "error");
      }
    } catch (err: any) {
      toast("Error updating credit terms: " + err.message, "error");
    } finally {
      setSavingCredit(false);
    }
  };

  // Filter customers by active Credit Days / Business Type tab
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      if (activeCreditTab === "specialDiscount") {
        return (c.specialDiscount && c.specialDiscount > 0) || c.businessType === "RETAILER WITH SPECIAL DISCOUNT";
      }
      if (activeCreditTab === "wholesaleNoGst") {
        return (
          c.businessType === "WHOLESALER WITHOUT GST" ||
          c.businessType === "WHOLESALE WITHOUT GST" ||
          c.businessType === "RETAILER WITHOUT GST" ||
          c.businessType === "RETAILER (WITHOUT GST)" ||
          (c.businessType || "").toUpperCase().includes("WITHOUT GST") ||
          ((c.businessType === "WHOLESALER" || c.businessType === "WHOLESALE") &&
            (!c.gstPanNo || c.gstPanNo === "URP" || c.gstPanNo === "N/A" || c.gstPanNo === "NOT APPLICABLE"))
        );
      }
      const days = c.creditDays || 0;
      if (activeCreditTab === "credit") return days > 0;
      if (activeCreditTab === "45days") return days === 45;
      if (activeCreditTab === "advance") return days === 0;
      return true;
    });
  }, [customers, activeCreditTab]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-orange-600 mb-1">
            <Store size={14} /> Retail & Wholesale Client Accounts
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Customer Shops & Credit Terms</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Manage garment retailers, GSTIN/PAN credentials, Business Types (Retailer/Wholesaler), and Credit Days limits.
          </p>
        </div>

        {isSuperAdmin && (
          <Link
            href="/employee/customers/new"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-zinc-950 hover:bg-black text-white font-semibold text-xs rounded-xl shadow-xs transition-colors cursor-pointer self-start md:self-auto"
          >
            <Plus size={16} />
            <span>Add Customer</span>
          </Link>
        )}
      </div>

      {/* Toolbar & Filters (Search in Capitals Only) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3.5 top-3 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value.toUpperCase())}
            placeholder="SEARCH IN CAPITALS BY SHOP NAME..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-xl text-xs uppercase font-semibold focus:ring-2 focus:ring-zinc-900 focus:outline-none shadow-2xs"
          />
        </div>

        <button
          onClick={fetchCustomers}
          className="p-2.5 bg-white border border-gray-300 rounded-xl text-gray-600 hover:bg-gray-50 shadow-2xs transition-colors self-end md:self-auto cursor-pointer"
          title="Refresh"
        >
          <RefreshCw size={16} className={loading ? "animate-spin text-zinc-900" : ""} />
        </button>
      </div>

      {/* Customers Table Card (Clean 5 Columns: Shop Name, Type, Credit Days, City, Action) */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                <th className="py-3.5 px-6">Shop Name</th>
                <th className="py-3.5 px-6">Type</th>
                <th className="py-3.5 px-6">Credit Days</th>
                <th className="py-3.5 px-6">City</th>
                <th className="py-3.5 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && customers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-400">
                    Loading customer shops...
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-400">
                    No customer shops found matching &quot;{search}&quot;.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((c) => {
                  const days = c.creditDays || 0;
                  const isWholesaler = c.businessType === "WHOLESALER";

                  return (
                    <tr key={c.id} className="hover:bg-gray-50/60 transition-colors">
                      {/* 1. Shop Name */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200 text-orange-700 flex items-center justify-center font-bold text-sm shrink-0">
                            {c.shopName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 uppercase text-sm">{c.shopName}</div>
                            {c.contactPerson ? (
                              <div className="text-[11px] text-gray-500 mt-0.5">
                                Contact: {c.contactPerson}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </td>

                      {/* 2. Business Type */}
                      <td className="py-4 px-6">
                        {c.businessType === "WHOLESALER WITHOUT GST" || c.businessType === "WHOLESALE WITHOUT GST" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-fuchsia-50 text-fuchsia-800 border border-fuchsia-200">
                            WHOLESALE (NO GST)
                          </span>
                        ) : isWholesaler ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                            WHOLESALE
                          </span>
                        ) : c.businessType === "RETAILER WITHOUT GST" || c.businessType === "RETAILER (WITHOUT GST)" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                            RETAILER (NO GST)
                          </span>
                        ) : c.businessType === "RETAILER WITH SPECIAL DISCOUNT" || (c.specialDiscount && c.specialDiscount > 0) ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                            RETAILER (SPL DISCOUNT)
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            RETAILER
                          </span>
                        )}
                      </td>

                      {/* 3. Credit Days */}
                      <td className="py-4 px-6">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-mono font-bold border ${
                            days === 45
                              ? "bg-purple-50 text-purple-800 border-purple-200"
                              : days > 0
                              ? "bg-amber-50 text-amber-800 border-amber-200"
                              : "bg-emerald-50 text-emerald-800 border-emerald-200"
                          }`}
                        >
                          <Clock size={12} className={days > 0 ? "text-amber-600" : "text-emerald-600"} />
                          <span>{days > 0 ? `${days} Days` : "Advance (0d)"}</span>
                        </span>
                      </td>

                      {/* 4. City */}
                      <td className="py-4 px-6 font-semibold text-gray-800 uppercase">
                        {c.city || "—"}
                      </td>

                      {/* 5. Actions (Edit / View Details) */}
                      <td className="py-4 px-6 text-right space-x-2">
                        <Link
                          href={`/employee/customers/${c.id}/edit`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl transition shadow-2xs"
                          title="Edit and view customer details"
                        >
                          <Eye size={13} />
                          <span>Edit / View</span>
                        </Link>
                        <button
                          onClick={() => handleDelete(c.id, c.shopName)}
                          className="p-1.5 inline-flex text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                          title="Delete Customer"
                        >
                          <Trash2 size={15} />
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

      {/* Super Admin Quick Credit Days Modal */}
      {editingCreditCustomer && (
        <Modal
          isOpen={!!editingCreditCustomer}
          onClose={() => setEditingCreditCustomer(null)}
          title={`Edit Credit Terms: ${editingCreditCustomer.shopName}`}
          size="sm"
        >
          <div className="p-4 space-y-4">
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Super Admin Privilege:</strong> You are modifying the allowed payment credit window for this customer account.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Credit Days Approved
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={newCreditDays}
                  onChange={(e) => setNewCreditDays(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 font-mono font-bold text-base focus:ring-2 focus:ring-zinc-900 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {[0, 15, 30, 45, 60].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setNewCreditDays(d)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    newCreditDays === d
                      ? "bg-zinc-900 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {d === 0 ? "Advance" : `${d} Days`}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setEditingCreditCustomer(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingCredit}
                onClick={handleSaveCreditDays}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-zinc-950 hover:bg-black text-white text-xs font-bold rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
              >
                {savingCredit ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                <span>Save Credit Terms</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Visiting Card Full Preview Modal */}
      {previewCardUrl && (
        <Modal
          isOpen={!!previewCardUrl}
          onClose={() => setPreviewCardUrl(null)}
          title="Visiting Card Document"
          size="md"
        >
          <div className="p-3 bg-gray-50 rounded-2xl border border-gray-200 flex flex-col items-center">
            <img
              src={previewCardUrl}
              alt="Visiting Card Proof"
              className="max-h-[70vh] w-auto rounded-xl object-contain shadow-xs"
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
