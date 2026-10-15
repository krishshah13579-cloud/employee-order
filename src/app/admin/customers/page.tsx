"use client";

import { useEffect, useState } from "react";
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
} from "lucide-react";
import type { CustomerData } from "@/lib/types";

export default function CustomersPage() {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [previewCardUrl, setPreviewCardUrl] = useState<string | null>(null);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-orange-600 mb-1">
            <Store size={14} /> Retail Client Accounts
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Customer Shops</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Manage garment retailers, GSTIN/PAN credentials, visiting card proofs, and shop addresses.
          </p>
        </div>

        {isSuperAdmin && (
          <Link
            href="/admin/customers/new"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-zinc-950 hover:bg-black text-white font-semibold text-xs rounded-xl shadow-xs transition-colors cursor-pointer self-start md:self-auto"
          >
            <Plus size={16} />
            <span>Add Customer</span>
          </Link>
        )}
      </div>

      {/* Toolbar & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3.5 top-3 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by shop name, GSTIN, PAN, or phone..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-zinc-900 focus:outline-none shadow-2xs"
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

      {/* Customers Table Card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                <th className="py-3.5 px-6">Shop & Contact Person</th>
                <th className="py-3.5 px-6">GSTIN / PAN</th>
                <th className="py-3.5 px-6">Phone Number</th>
                <th className="py-3.5 px-6">Store Address</th>
                <th className="py-3.5 px-6">Visiting Card</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && customers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400">
                    Loading customer shops...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400">
                    No customer shops found. Click "Add Customer" to register a shop.
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200 text-orange-700 flex items-center justify-center font-bold text-sm shrink-0">
                          {c.shopName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-gray-900">{c.shopName}</div>
                          {c.contactPerson ? (
                            <div className="text-[11px] text-gray-500 mt-0.5">
                              Contact: {c.contactPerson}
                            </div>
                          ) : (
                            <span className="text-[10px] text-gray-400 italic">No contact specified</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-lg font-mono text-[11px] font-bold text-gray-800">
                        <CreditCard size={12} className="text-gray-400" />
                        {c.gstPanNo}
                      </span>
                    </td>
                    <td className="py-4 px-6 font-mono font-medium text-gray-800">
                      <a
                        href={`tel:${c.phoneNumber}`}
                        className="inline-flex items-center gap-1.5 hover:text-orange-600 transition-colors"
                      >
                        <Phone size={13} className="text-gray-400" />
                        {c.phoneNumber}
                      </a>
                    </td>
                    <td className="py-4 px-6 max-w-xs text-gray-600">
                      <div className="flex items-start gap-1.5">
                        <MapPin size={13} className="text-gray-400 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{c.address}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      {c.visitingCardUrl ? (
                        <button
                          onClick={() => setPreviewCardUrl(c.visitingCardUrl!)}
                          className="group relative inline-flex items-center gap-2 p-1 bg-gray-50 hover:bg-orange-50 border border-gray-200 hover:border-orange-300 rounded-xl transition-all cursor-pointer"
                          title="Click to view full card"
                        >
                          <img
                            src={c.visitingCardUrl}
                            alt="Visiting Card"
                            className="w-12 h-8 rounded-lg object-cover"
                          />
                          <span className="text-[11px] font-semibold text-gray-700 group-hover:text-orange-700 pr-1.5 flex items-center gap-1">
                            <Eye size={12} /> View Card
                          </span>
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400 italic flex items-center gap-1">
                          <ImageIcon size={13} /> No Card
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right space-x-2">
                      <Link
                        href={`/admin/customers/${c.id}/edit`}
                        className="p-1.5 inline-flex text-gray-500 hover:text-black hover:bg-gray-100 rounded-lg transition-colors"
                        title="Edit Customer (Opens dedicated page)"
                      >
                        <Edit2 size={15} />
                      </Link>
                      <button
                        onClick={() => handleDelete(c.id, c.shopName)}
                        className="p-1.5 inline-flex text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete Customer"
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
