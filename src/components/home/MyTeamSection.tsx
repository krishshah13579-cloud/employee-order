"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  ExternalLink,
  MessageCircle,
  Phone,
  Package,
  Calendar,
  RefreshCw,
  Send,
  User,
  TrendingUp,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { STATUS_COLORS } from "@/lib/types";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

interface TeamMemberOrder {
  id: number;
  orderNumber: string;
  customerName: string;
  customerPhone?: string;
  orderDate: string;
  createdAt: string;
  status: string;
  totalPcs: number;
  totalSets: number;
  subtotal: number;
  grandTotal: number;
}

interface TeamMemberCustomer {
  id: number;
  shopName: string;
  phoneNumber: string;
  city: string;
  businessType: string;
  creditDays: number;
  outstanding: number;
  paymentsThisWeek: boolean;
  lastPaymentDate: string | null;
}

interface TeamMember {
  id: number;
  name: string;
  email?: string;
  mobileNumber: string;
  designation: string;
  isTeamLeader: boolean;
  proofUrl?: string;
  totalOrdersCount: number;
  totalSalesAmount: number;
  totalPiecesCount: number;
  allocatedCustomersCount: number;
  totalAllocatedOutstanding: number;
  weeklyPaymentStatus: "PAYMENT_RECEIVED" | "PENDING_PAYMENT" | "NO_OUTSTANDING";
  paymentsReceivedThisWeekCount: number;
  totalPaidThisWeek: number;
  mostRecentPaymentDate: string | null;
  orders: TeamMemberOrder[];
  customers: TeamMemberCustomer[];
}

interface TeamData {
  teamLeader: {
    name: string;
    isTeamLeader: boolean;
  };
  teamMembers: TeamMember[];
  summary: {
    totalMembers: number;
    totalTeamOrders: number;
    totalTeamSales: number;
    totalTeamOutstanding: number;
    membersWithPendingPayments: number;
  };
}

export default function MyTeamSection() {
  const router = useRouter();
  const { toast } = useToast();

  const [teamData, setTeamData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [activeTab, setActiveTab] = useState<"orders" | "customers">("orders");
  const [sendingReminderCustId, setSendingReminderCustId] = useState<number | null>(null);

  const fetchTeamData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/employee/team");
      if (!res.ok) {
        if (res.status === 403) {
          // Not authorized, don't show error
          setTeamData(null);
          return;
        }
        throw new Error(`Failed to load team data (${res.status})`);
      }
      const data: TeamData = await res.json();
      setTeamData(data);
    } catch (err: any) {
      console.error("Team fetch error:", err);
      setError(err.message || "Failed to load team activities");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeamData();
  }, []);

  // Send weekly payment reminder for a specific customer
  const handleSendCustomerReminder = async (customer: TeamMemberCustomer) => {
    if (!customer.phoneNumber) {
      toast("Customer has no phone number on file", "error");
      return;
    }

    try {
      setSendingReminderCustId(customer.id);
      const res = await fetch(`/api/admin/outstanding/${customer.id}/whatsapp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send weekly payment reminder");
      }

      if (data.automated) {
        toast(
          `✅ Weekly Payment Reminder sent to ${customer.shopName} (${customer.phoneNumber}) via WhatsApp!`,
          "success"
        );
      } else if (data.directUrl) {
        window.open(data.directUrl, "_blank");
        toast(`Opening WhatsApp link for ${customer.shopName}`, "info");
      } else {
        toast("Reminder sent successfully", "success");
      }
    } catch (err: any) {
      toast(err.message || "Failed to dispatch reminder", "error");
    } finally {
      setSendingReminderCustId(null);
    }
  };

  if (loading) {
    return (
      <section className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 text-white shadow-md animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white/10" />
          <div className="space-y-2">
            <div className="w-32 h-4 bg-white/20 rounded" />
            <div className="w-64 h-3 bg-white/10 rounded" />
          </div>
        </div>
      </section>
    );
  }

  // If not authorized or no data, do not render
  if (!teamData || !teamData.teamMembers) {
    return null;
  }

  const { teamMembers, summary } = teamData;

  return (
    <section className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-7 text-white shadow-xl border border-indigo-900/50 space-y-6">
      {/* 1. Header with Badge & Overview */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-indigo-800/40">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-orange-500/20 shrink-0">
            <ShieldCheck size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl sm:text-2xl font-black tracking-tight uppercase">
                MY TEAM
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/30">
                Team Leader Supervision
              </span>
            </div>
            <p className="text-xs text-indigo-200/80 mt-0.5">
              Live activities, order performance, and weekly payment tracking of your team members.
            </p>
          </div>
        </div>

        {/* Team Summary Pills */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs">
            <span className="text-indigo-300 block text-[10px] uppercase font-bold">Total Members</span>
            <span className="font-black text-sm">{summary.totalMembers} Staff</span>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs">
            <span className="text-indigo-300 block text-[10px] uppercase font-bold">Team Sales</span>
            <span className="font-black text-sm text-emerald-400">{formatCurrency(summary.totalTeamSales)}</span>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs">
            <span className="text-indigo-300 block text-[10px] uppercase font-bold">Team Outstanding</span>
            <span className="font-black text-sm text-amber-400">{formatCurrency(summary.totalTeamOutstanding)}</span>
          </div>

          <button
            type="button"
            onClick={fetchTeamData}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition cursor-pointer text-indigo-200"
            title="Refresh Team Activity"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* 2. Team Members Cards Grid */}
      {teamMembers.length === 0 ? (
        <div className="p-8 text-center text-indigo-300/80 bg-white/5 rounded-2xl border border-white/10">
          <Users size={32} className="mx-auto mb-2 opacity-50" />
          <p className="font-bold text-sm">No team members registered yet.</p>
          <p className="text-xs mt-1 opacity-70">Staff accounts assigned under your team will show their live activity here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teamMembers.map((member) => {
            const hasPendingWeekly = member.weeklyPaymentStatus === "PENDING_PAYMENT";
            const hasReceived = member.weeklyPaymentStatus === "PAYMENT_RECEIVED";

            return (
              <div
                key={member.id}
                onClick={() => {
                  setSelectedMember(member);
                  setActiveTab("orders");
                }}
                className="bg-white/8 hover:bg-white/12 border border-white/15 hover:border-amber-400/50 rounded-2xl p-4.5 transition-all cursor-pointer group shadow-xs hover:shadow-lg hover:-translate-y-0.5 flex flex-col justify-between"
              >
                <div>
                  {/* Top: Avatar, Name, Designation */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-600/60 border border-indigo-400/30 flex items-center justify-center text-sm font-black text-white shrink-0 group-hover:bg-amber-500 group-hover:text-slate-950 transition-colors">
                        {member.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-black text-sm text-white group-hover:text-amber-300 transition-colors flex items-center gap-1.5">
                          <span>{member.name}</span>
                          <ArrowRight size={13} className="opacity-0 group-hover:opacity-100 transition-opacity text-amber-400" />
                        </div>
                        <div className="text-[11px] text-indigo-200/70 font-medium">
                          {member.designation || "Sales Representative"}
                        </div>
                      </div>
                    </div>

                    {/* Weekly Status Indicator */}
                    {hasReceived ? (
                      <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        <CheckCircle2 size={11} />
                        <span>Paid This Week</span>
                      </span>
                    ) : hasPendingWeekly ? (
                      <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                        <AlertCircle size={11} />
                        <span>Payment Pending</span>
                      </span>
                    ) : (
                      <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/20 text-slate-300 border border-slate-500/30">
                        <span>No Dues</span>
                      </span>
                    )}
                  </div>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-white/10 text-xs">
                    <div className="bg-black/20 p-2.5 rounded-xl">
                      <span className="text-[10px] text-indigo-300 block font-bold uppercase">Orders Placed</span>
                      <span className="font-black text-white text-sm">
                        {member.totalOrdersCount}{" "}
                        <span className="text-[10px] text-indigo-200 font-normal">({member.totalPiecesCount} Pcs)</span>
                      </span>
                    </div>

                    <div className="bg-black/20 p-2.5 rounded-xl">
                      <span className="text-[10px] text-indigo-300 block font-bold uppercase">Total Booked</span>
                      <span className="font-black text-emerald-400 text-sm">
                        {formatCurrency(member.totalSalesAmount)}
                      </span>
                    </div>

                    <div className="bg-black/20 p-2.5 rounded-xl">
                      <span className="text-[10px] text-indigo-300 block font-bold uppercase">Allocated Cust.</span>
                      <span className="font-black text-white text-sm">
                        {member.allocatedCustomersCount} Accounts
                      </span>
                    </div>

                    <div className="bg-black/20 p-2.5 rounded-xl">
                      <span className="text-[10px] text-indigo-300 block font-bold uppercase">Outstanding</span>
                      <span className={`font-black text-sm ${member.totalAllocatedOutstanding > 0 ? "text-amber-400" : "text-slate-400"}`}>
                        {formatCurrency(member.totalAllocatedOutstanding)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Footer / Call to action */}
                <div className="mt-3 pt-2 flex items-center justify-between text-[11px] text-indigo-300/80 group-hover:text-amber-300 transition-colors">
                  <span className="font-semibold">Click to view all orders &amp; reminders</span>
                  <ArrowRight size={13} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══════════════════════════════════════════
          DETAIL MODAL: MEMBER ORDERS, OUTSTANDING & WEEKLY REMINDERS
          ═══════════════════════════════════════════ */}
      {selectedMember && (
        <Modal
          isOpen={!!selectedMember}
          onClose={() => setSelectedMember(null)}
          title={`Team Member Activity: ${selectedMember.name.toUpperCase()}`}
          size="xl"
        >
          <div className="space-y-5 p-1 text-slate-900">
            {/* 1. Member Profile & Weekly Payment Banner */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black text-base shadow-sm">
                    {selectedMember.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-base font-black tracking-tight">{selectedMember.name}</h3>
                    <div className="text-xs text-indigo-200/80 flex items-center gap-2">
                      <span>{selectedMember.designation || "Sales Representative"}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1 font-mono">
                        <Phone size={11} /> {selectedMember.mobileNumber}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {selectedMember.weeklyPaymentStatus === "PAYMENT_RECEIVED" ? (
                    <div className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5">
                      <CheckCircle2 size={14} />
                      <span>Weekly Payment Received (₹{selectedMember.totalPaidThisWeek.toLocaleString("en-IN")})</span>
                    </div>
                  ) : selectedMember.weeklyPaymentStatus === "PENDING_PAYMENT" ? (
                    <div className="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 animate-pulse">
                      <AlertCircle size={14} />
                      <span>Weekly Payment Reminder Needed</span>
                    </div>
                  ) : (
                    <div className="px-3 py-1.5 rounded-xl bg-slate-500/20 text-slate-300 border border-slate-500/30 text-xs font-bold">
                      <span>No Outstanding Payment Due</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 4 Summary Stat Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 text-xs">
                <div className="bg-white/10 rounded-xl p-3 border border-white/10">
                  <span className="text-[10px] text-indigo-200 block font-bold uppercase">All Orders</span>
                  <span className="text-base font-black text-white">{selectedMember.totalOrdersCount}</span>
                </div>
                <div className="bg-white/10 rounded-xl p-3 border border-white/10">
                  <span className="text-[10px] text-indigo-200 block font-bold uppercase">Total Booked</span>
                  <span className="text-base font-black text-emerald-400">{formatCurrency(selectedMember.totalSalesAmount)}</span>
                </div>
                <div className="bg-white/10 rounded-xl p-3 border border-white/10">
                  <span className="text-[10px] text-indigo-200 block font-bold uppercase">Allocated Accounts</span>
                  <span className="text-base font-black text-white">{selectedMember.allocatedCustomersCount}</span>
                </div>
                <div className="bg-white/10 rounded-xl p-3 border border-white/10">
                  <span className="text-[10px] text-indigo-200 block font-bold uppercase">Total Outstanding</span>
                  <span className={`text-base font-black ${selectedMember.totalAllocatedOutstanding > 0 ? "text-amber-400" : "text-white"}`}>
                    {formatCurrency(selectedMember.totalAllocatedOutstanding)}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Navigation Tabs: All Orders vs. Allocated Customers */}
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
              <button
                type="button"
                onClick={() => setActiveTab("orders")}
                className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "orders"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Package size={14} />
                <span>All Orders Placed ({selectedMember.orders.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("customers")}
                className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "customers"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Users size={14} />
                <span>Allocated Customers &amp; Outstanding ({selectedMember.customers.length})</span>
              </button>
            </div>

            {/* 3. Tab Content */}
            {activeTab === "orders" ? (
              <div className="space-y-3">
                {selectedMember.orders.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-2xl border border-slate-200">
                    <Package size={28} className="mx-auto mb-2 opacity-40" />
                    <p className="font-bold text-xs">No orders recorded for this employee yet.</p>
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                          <th className="py-2.5 px-3.5">Order #</th>
                          <th className="py-2.5 px-3.5">Customer / Firm Name</th>
                          <th className="py-2.5 px-3.5 text-center">PCS (Sets)</th>
                          <th className="py-2.5 px-3.5 text-right">Amount (₹)</th>
                          <th className="py-2.5 px-3.5 text-center">Status</th>
                          <th className="py-2.5 px-3.5">Date</th>
                          <th className="py-2.5 px-3.5 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedMember.orders.map((ord) => {
                          const statusStyle =
                            STATUS_COLORS[ord.status] ||
                            "bg-neutral-100 text-neutral-700 border-neutral-200";

                          return (
                            <tr
                              key={ord.id}
                              onClick={() => router.push(`/orders/${ord.id}`)}
                              className="hover:bg-orange-50/50 cursor-pointer transition"
                            >
                              <td className="py-2.5 px-3.5 font-mono font-bold text-slate-900">
                                {ord.orderNumber.startsWith("#") ? ord.orderNumber : `#${ord.orderNumber}`}
                              </td>
                              <td className="py-2.5 px-3.5 font-bold text-slate-900 uppercase">
                                {ord.customerName}
                              </td>
                              <td className="py-2.5 px-3.5 text-center font-semibold text-slate-800">
                                {ord.totalPcs} Pcs ({ord.totalSets} Sets)
                              </td>
                              <td className="py-2.5 px-3.5 text-right font-black text-slate-900">
                                {formatCurrency(ord.grandTotal)}
                              </td>
                              <td className="py-2.5 px-3.5 text-center">
                                <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusStyle}`}>
                                  {ord.status}
                                </span>
                              </td>
                              <td className="py-2.5 px-3.5 text-slate-500 whitespace-nowrap">
                                {formatDate(ord.orderDate || ord.createdAt)}
                              </td>
                              <td className="py-2.5 px-3.5 text-center">
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-600 bg-orange-100/60 px-2 py-0.5 rounded-md">
                                  <span>View Form</span>
                                  <ArrowRight size={11} />
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {selectedMember.customers.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-2xl border border-slate-200">
                    <Users size={28} className="mx-auto mb-2 opacity-40" />
                    <p className="font-bold text-xs">No customer accounts allocated to this employee yet.</p>
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                          <th className="py-2.5 px-3.5">Firm Name</th>
                          <th className="py-2.5 px-3.5">Phone / City</th>
                          <th className="py-2.5 px-3.5 text-center">Credit Terms</th>
                          <th className="py-2.5 px-3.5 text-right">Outstanding (₹)</th>
                          <th className="py-2.5 px-3.5 text-center">Weekly Payment</th>
                          <th className="py-2.5 px-3.5 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedMember.customers.map((cust) => {
                          const isPending = cust.outstanding > 0 && !cust.paymentsThisWeek;
                          const isPaidThisWeek = cust.paymentsThisWeek;

                          return (
                            <tr key={cust.id} className="hover:bg-slate-50 transition">
                              <td className="py-2.5 px-3.5 font-bold text-slate-900 uppercase">
                                {cust.shopName}
                              </td>
                              <td className="py-2.5 px-3.5 font-mono text-[11px] text-slate-600">
                                <div>{cust.phoneNumber}</div>
                                <div className="text-[10px] text-slate-400 uppercase">{cust.city}</div>
                              </td>
                              <td className="py-2.5 px-3.5 text-center font-bold text-slate-700">
                                {cust.creditDays ? `${cust.creditDays} Days` : "Immediate"}
                              </td>
                              <td className="py-2.5 px-3.5 text-right font-black text-slate-900">
                                <span className={cust.outstanding > 0 ? "text-amber-600" : "text-slate-400"}>
                                  {formatCurrency(cust.outstanding)}
                                </span>
                              </td>
                              <td className="py-2.5 px-3.5 text-center">
                                {isPaidThisWeek ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/70 border border-emerald-300 px-2 py-0.5 rounded-full">
                                    <CheckCircle2 size={11} />
                                    <span>Received</span>
                                  </span>
                                ) : isPending ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full">
                                    <AlertCircle size={11} />
                                    <span>Pending</span>
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-400">Clear</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3.5 text-center">
                                {cust.outstanding > 0 ? (
                                  <button
                                    type="button"
                                    onClick={() => handleSendCustomerReminder(cust)}
                                    disabled={sendingReminderCustId === cust.id}
                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1 rounded-lg transition shadow-xs cursor-pointer disabled:opacity-50"
                                    title="Send Weekly Payment Reminder via WhatsApp"
                                  >
                                    <Send size={11} />
                                    <span>{sendingReminderCustId === cust.id ? "Sending..." : "Reminder"}</span>
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-slate-400 font-semibold">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}
    </section>
  );
}
