"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Printer,
  FileText,
  Building2,
  Calendar,
  CheckCircle,
  Percent,
  Loader2,
  MessageCircle,
  Bell,
  Clock,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getColorHex } from "@/lib/colors";
import type { OrderData, ColorSetEntry } from "@/lib/types";
import TaxInvoiceA4 from "@/components/orders/TaxInvoiceA4";
import { useToast } from "@/components/ui/Toast";

export default function OrderInvoicePage() {
  const params = useParams();
  const id = params?.id as string;
  const { toast } = useToast();
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);

  const handleSendWhatsApp = async (type: "ORDER_CONFIRMATION" | "PAYMENT_REMINDER" = "ORDER_CONFIRMATION") => {
    try {
      setSendingWhatsApp(true);
      const res = await fetch(`/api/orders/${id}/whatsapp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to process WhatsApp");

      if (data.automated) {
        toast("✅ WhatsApp message dispatched to customer automatically!", "success");
      } else {
        toast(
          type === "PAYMENT_REMINDER"
            ? "Opening WhatsApp with Payment Reminder..."
            : "Opening WhatsApp with Order Details...",
          "success"
        );
      }

      if (data.whatsappUrl) {
        window.open(data.whatsappUrl, "_blank", "noopener,noreferrer");
      }
    } catch (err: any) {
      toast(err.message || "Failed to send WhatsApp", "error");
    } finally {
      setSendingWhatsApp(false);
    }
  };

  useEffect(() => {
    if (!id) return;

    async function loadOrder() {
      try {
        setLoading(true);
        const res = await fetch(`/api/orders/${id}`);
        if (!res.ok) {
          throw new Error(`Failed to load order invoice (Status ${res.status})`);
        }
        const data = await res.json();
        setOrder(data);
      } catch (err: any) {
        setError(err.message || "Failed to load order.");
      } finally {
        setLoading(false);
      }
    }

    loadOrder();
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
        <p className="text-sm text-zinc-500">Loading invoice details...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
        {error || "Order not found."}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* Top Bar with Back, WhatsApp, and Print */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-gray-200 print:hidden">
        <Link
          href="/admin/orders"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-black transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Back to Orders</span>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {/* WhatsApp Order Update */}
          <button
            type="button"
            disabled={sendingWhatsApp}
            onClick={() => handleSendWhatsApp("ORDER_CONFIRMATION")}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
            title="Send Tax Invoice PDF link & order confirmation to customer on WhatsApp"
          >
            <MessageCircle size={14} />
            <span>{sendingWhatsApp ? "Sending..." : "Send on WhatsApp"}</span>
          </button>

          {/* Weekly Payment Reminder */}
          <button
            type="button"
            disabled={sendingWhatsApp}
            onClick={() => handleSendWhatsApp("PAYMENT_REMINDER")}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
            title="Send weekly payment due reminder to customer on WhatsApp"
          >
            <Bell size={14} />
            <span>Weekly Reminder</span>
          </button>

          {/* Print A4 Tax Invoice */}
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-950 hover:bg-black text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Printer size={14} />
            <span>Print A4 Invoice</span>
          </button>
        </div>
      </div>

      {/* Interactive Container (Hidden on Print) */}
      <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-xs space-y-6 print:hidden">
        {/* Invoice Header */}
        <div className="flex justify-between items-start border-b border-gray-200 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-zinc-950 p-1 flex items-center justify-center">
                <img
                  src="/images/iq-logo.jpg"
                  alt="IQ TROUSERS"
                  className="w-full h-full object-contain"
                />
              </div>
              <span className="font-black text-xl tracking-tight text-gray-900">
                KRISH CLOTHING CO.
              </span>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed max-w-sm">
              Q-8, Samet Business Park, Nr Parishkar-2,<br />
              Khokhra Circle, Maninagar, Ahmedabad - 380008, Gujarat<br />
              <strong>Phone:</strong> 8128756632 • <strong>Email:</strong> krishclothingco3@gmail.com
            </p>
            <div className="mt-2 text-xs font-mono font-bold text-gray-800">
              GSTIN: 24LAAPS9916E1ZD • PAN: LAAPS9916E
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs font-extrabold uppercase tracking-widest text-orange-600 block mb-1">
              Tax Invoice
            </span>
            <div className="text-2xl font-black font-mono text-gray-900">
              {order.orderNumber}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Date: <span className="font-semibold text-gray-900">{formatDate(order.orderDate)}</span>
            </div>
            <div className="mt-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                <CheckCircle size={12} /> {order.status}
              </span>
            </div>
          </div>
        </div>

        {/* Billed To / Client Retailer Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-zinc-50/80 p-4 rounded-xl border border-gray-200 text-xs">
          <div>
            <span className="font-bold text-gray-500 uppercase tracking-wider block mb-1 text-[11px]">
              Billed To (Customer Shop):
            </span>
            <div className="font-bold text-gray-900 text-sm">
              {order.customer?.shopName || "Walk-in Retailer"}
            </div>
            <div className="text-gray-600 mt-1 leading-relaxed">
              {order.customer?.address || "Address on record"}
            </div>
            <div className="text-gray-700 mt-1">
              <strong>Phone:</strong> {order.customer?.phoneNumber || "—"}
            </div>
          </div>

          <div className="sm:text-right">
            <span className="font-bold text-gray-500 uppercase tracking-wider block mb-1 text-[11px]">
              Client Tax & Order Reference:
            </span>
            <div className="font-mono font-bold text-gray-900 text-sm">
              GST/PAN: {order.customer?.gstPanNo || "UNREGISTERED"}
            </div>
            <div className="text-gray-600 mt-1">
              Placed By: <span className="font-semibold text-gray-800">{order.placedBy || "Admin"}</span>
            </div>
            {order.notes && (
              <div className="text-gray-500 mt-1 italic">
                Notes: {order.notes}
              </div>
            )}
          </div>
        </div>

        {/* Itemized Table */}
        <div className="overflow-x-auto border border-gray-200 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-100/80 text-[11px] font-bold uppercase tracking-wider text-gray-700 border-b border-gray-200">
                <th className="p-3 border-r border-gray-200 w-12 text-center">#</th>
                <th className="p-3 border-r border-gray-200">Garment Product & Color Sets</th>
                <th className="p-3 border-r border-gray-200">Size Ratio</th>
                <th className="p-3 border-r border-gray-200 text-center">Sets</th>
                <th className="p-3 border-r border-gray-200 text-center">PCS (Sets × Sizes)</th>
                <th className="p-3 border-r border-gray-200 text-right">Rate / Pc</th>
                <th className="p-3 text-right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {order.items?.map((it, idx) => {
                let colorSetsParsed: ColorSetEntry[] = [];
                try {
                  colorSetsParsed = typeof it.colorSets === "string" ? JSON.parse(it.colorSets) : it.colorSets;
                } catch {}

                return (
                  <tr key={idx} className="hover:bg-gray-50/50">
                    <td className="p-3 border-r border-gray-200 text-center font-mono">{idx + 1}</td>
                    <td className="p-3 border-r border-gray-200">
                      <div className="font-bold text-gray-900 text-sm">{it.productName}</div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        {colorSetsParsed
                          ?.filter((cs) => cs.sets > 0)
                          .map((cs, cIdx) => {
                            const colorInfo = getColorHex(cs.color);
                            return (
                              <span
                                key={cIdx}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 rounded text-[11px] font-medium text-gray-800 border border-gray-200"
                              >
                                <span
                                  className="w-2 h-2 rounded-full border border-black/15 shrink-0"
                                  style={{ backgroundColor: colorInfo.hex }}
                                />
                                <span>
                                  {cs.color}: <strong>{cs.sets} sets</strong>
                                </span>
                              </span>
                            );
                          })}
                      </div>
                    </td>
                    <td className="p-3 border-r border-gray-200">
                      <span className="font-semibold text-blue-900 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                        {it.sizeRatio}
                      </span>
                      <div className="text-[10px] text-gray-500 mt-1">({it.pcsPerSet} pcs/set)</div>
                    </td>
                    <td className="p-3 border-r border-gray-200 text-center font-bold font-mono">
                      {it.totalSets}
                    </td>
                    <td className="p-3 border-r border-gray-200 text-center font-bold font-mono text-blue-700">
                      {it.totalPcs}
                    </td>
                    <td className="p-3 border-r border-gray-200 text-right font-mono">
                      {formatCurrency(it.unitPrice)}
                    </td>
                    <td className="p-3 text-right font-bold font-mono">
                      {formatCurrency(it.itemSubtotal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Totals & Tax Calculation Breakdown */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pt-2">
          {/* Bank Details */}
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-xs space-y-1 w-full sm:w-80">
            <span className="font-bold text-gray-800 uppercase tracking-wider block mb-1 text-[11px]">
              Bank Account for RTGS / NEFT:
            </span>
            <div><strong>Bank:</strong> ICICI BANK</div>
            <div><strong>Account Number:</strong> 750705000692</div>
            <div><strong>IFSC Code:</strong> ICIC0007507</div>
            <div><strong>Branch:</strong> KHOKHRA BRANCH</div>
          </div>

          {/* Amount Calculation */}
          <div className="w-full sm:w-72 space-y-2 text-xs">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal:</span>
              <span className="font-mono font-semibold">{formatCurrency(order.subtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span className="flex items-center gap-1">
                <Percent size={12} /> CGST (2.5%):
              </span>
              <span className="font-mono font-semibold">
                +{formatCurrency(Math.round(order.gstAmount / 2))}
              </span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span className="flex items-center gap-1">
                <Percent size={12} /> SGST (2.5%):
              </span>
              <span className="font-mono font-semibold">
                +{formatCurrency(Math.round(order.gstAmount / 2))}
              </span>
            </div>
            <div className="flex justify-between text-base font-black text-gray-900 pt-2 border-t border-gray-200">
              <span>Total Payable:</span>
              <span className="font-mono text-emerald-700">{formatCurrency(order.grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* Terms & Conditions */}
        <div className="pt-4 border-t border-gray-200 text-[11px] text-gray-500 space-y-1">
          <div className="font-bold text-gray-700 uppercase tracking-wider">Terms &amp; Conditions:</div>
          <div>1. 5% GST applicable on wholesale garments.</div>
          <div>2. Goods once sold will not be taken back or exchanged.</div>
          <div>3. Payment due within agreed wholesale credit terms.</div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          EXACT A4 TAX INVOICE PRINT VIEW
          (Krish Clothing Co. format)
          ═══════════════════════════════════════════ */}
      <div className="hidden print:block py-2">
        <TaxInvoiceA4
          order={{
            orderNumber: order.orderNumber,
            orderDate: order.orderDate,
            status: order.status,
            customerName: order.customer?.shopName || order.customerName,
            customerGstPan: order.customer?.gstPanNo || order.customerGstPan,
            customerPhone: order.customer?.phoneNumber || order.customerPhone,
            customerAddress: order.customer?.address || order.customerAddress,
            customerCity: order.customer?.city,
            customerState: order.customer?.state,
            businessType: order.businessType || order.customer?.businessType,
            creditDays:
              order.creditDays !== undefined ? order.creditDays : order.customer?.creditDays || 45,
            subtotal: order.subtotal,
            gstRate: order.gstRate,
            gstAmount: order.gstAmount,
            grandTotal: order.grandTotal,
            totalPcs: order.totalPcs,
            totalSets: order.totalSets,
            placedBy: order.placedBy,
            notes: order.notes,
            items:
              order.items?.map((it) => ({
                id: it.id,
                productName: it.productName,
                colorSets: it.colorSets,
                sizeRatio: it.sizeRatio,
                pcsPerSet: it.pcsPerSet,
                totalSets: it.totalSets,
                totalPcs: it.totalPcs,
                unitPrice: it.unitPrice,
                itemSubtotal: it.itemSubtotal,
              })) || [],
          }}
        />
      </div>
    </div>
  );
}
