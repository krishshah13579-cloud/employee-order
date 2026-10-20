"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { formatCurrency } from "@/lib/utils";
import {
  Trash2,
  PackageCheck,
  FileText,
  AlertTriangle,
  Loader2,
  X,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  CheckCircle2,
} from "lucide-react";

export interface DeleteOrderTarget {
  id: number;
  orderNumber: string;
  customerName: string;
  totalSets?: number;
  totalPcs?: number;
  grandTotal?: number;
  taxInvoiceNumber?: string | null;
}

interface DeleteOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: DeleteOrderTarget | null;
  onDeleted: (stockRestored: boolean, orderNumber: string) => void;
}

export default function DeleteOrderModal({
  isOpen,
  onClose,
  order,
  onDeleted,
}: DeleteOrderModalProps) {
  const [loadingAction, setLoadingAction] = useState<"restore" | "no-restore" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState<string>("");
  const [sendingOtp, setSendingOtp] = useState<boolean>(false);
  const [otpSent, setOtpSent] = useState<boolean>(false);
  const [otpMessage, setOtpMessage] = useState<string | null>(null);

  if (!order) return null;

  const isInvoiceGenerated = Boolean(order.taxInvoiceNumber && order.taxInvoiceNumber.trim());

  const handleRequest2FA = async () => {
    try {
      setSendingOtp(true);
      setError(null);
      setOtpMessage(null);
      const res = await fetch("/api/admin/profile/send-otp", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send 2FA security code");
      }
      setOtpSent(true);
      setOtpMessage(data.message || `2FA Security Code sent to Super Admin email!`);
    } catch (err: any) {
      console.error("Error sending 2FA code:", err);
      setError(err.message || "Failed to dispatch 2FA email");
    } finally {
      setSendingOtp(false);
    }
  };

  const handleDelete = async (restoreStock: boolean) => {
    try {
      setError(null);

      if (isInvoiceGenerated) {
        const cleanCode = twoFactorCode.trim();
        if (!cleanCode || cleanCode.length < 4) {
          setError("Super Admin 2FA: Please enter the 6-digit security code sent to Super Admin email.");
          return;
        }
      }

      setLoadingAction(restoreStock ? "restore" : "no-restore");

      const res = await fetch(`/api/orders/${order.id}?restoreStock=${restoreStock}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restoreStock,
          twoFactorCode: isInvoiceGenerated ? twoFactorCode.trim() : undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete order");
      }

      onDeleted(restoreStock, order.orderNumber);
      onClose();
    } catch (err: any) {
      console.error("Error deleting order:", err);
      setError(err.message || "Failed to delete order");
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={loadingAction ? () => {} : onClose}
      title={isInvoiceGenerated ? "Delete Generated Final Invoice & Order" : "Delete Wholesale Order"}
      size="md"
    >
      <div className="space-y-4">
        {/* Warning Banner */}
        {isInvoiceGenerated ? (
          <div className="flex items-start gap-3 p-3.5 bg-red-50 border border-red-300 rounded-xl text-red-950 text-xs">
            <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-red-950 uppercase tracking-wide">
                Final Invoice Generated • Super Admin 2FA Required
              </p>
              <p className="text-red-800 leading-relaxed">
                Tax Invoice <strong className="font-mono">#{order.taxInvoiceNumber}</strong> has already been generated. Invoices are strictly locked. No one can delete this invoice without authenticating using the <strong>2FA of Super Admin</strong>.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-amber-950">You are about to delete an order form.</p>
              <p className="text-amber-800 leading-relaxed">
                Please choose whether you want to <strong>add the deducted stock sets back into inventory</strong> or{" "}
                <strong>delete only the order form</strong> without modifying product stock.
              </p>
            </div>
          </div>
        )}

        {/* Order Summary Card */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Order Number:</span>
            <span className="font-mono font-bold text-slate-900 text-sm">{order.orderNumber}</span>
          </div>
          {order.taxInvoiceNumber && (
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Invoice Number:</span>
              <span className="font-mono font-bold text-red-600 text-sm">#{order.taxInvoiceNumber}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Customer:</span>
            <span className="font-semibold text-slate-800">{order.customerName}</span>
          </div>
          {(order.totalSets !== undefined || order.totalPcs !== undefined) && (
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Quantity Booked:</span>
              <span className="font-medium text-slate-800">
                {order.totalSets || 0} Sets ({order.totalPcs || 0} Pcs)
              </span>
            </div>
          )}
          {order.grandTotal !== undefined && (
            <div className="flex items-center justify-between border-t border-slate-200 pt-2 mt-2">
              <span className="text-slate-500">Grand Total:</span>
              <span className="font-bold text-slate-900 text-sm font-mono">{formatCurrency(order.grandTotal)}</span>
            </div>
          )}
        </div>

        {/* 2FA Verification Box (Mandatory when invoice is generated) */}
        {isInvoiceGenerated && (
          <div className="p-4 bg-slate-900 text-white rounded-xl space-y-3 border border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-orange-400" />
                <span className="text-xs font-bold text-slate-200">Super Admin 2FA Authentication</span>
              </div>
              <button
                type="button"
                disabled={sendingOtp}
                onClick={handleRequest2FA}
                className="text-[11px] font-bold text-orange-400 hover:text-orange-300 underline cursor-pointer disabled:opacity-50"
              >
                {sendingOtp ? "Sending 2FA Code..." : otpSent ? "Resend 2FA Code" : "Request 2FA OTP"}
              </button>
            </div>

            {otpMessage && (
              <div className="flex items-center gap-2 p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-[11px]">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{otpMessage}</span>
              </div>
            )}

            <div>
              <label className="block text-[11px] text-slate-300 font-semibold mb-1">
                Enter 6-Digit 2FA Security Code sent to Super Admin email:
              </label>
              <input
                type="text"
                maxLength={6}
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-center tracking-[0.3em] text-lg font-bold focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
            {error}
          </div>
        )}

        {/* Actions Selection */}
        <div className="space-y-3 pt-1">
          <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Choose Deletion Action:
          </p>

          {/* Option 1: Add Stock Back & Delete */}
          <button
            type="button"
            disabled={loadingAction !== null || (isInvoiceGenerated && twoFactorCode.trim().length < 4)}
            onClick={() => handleDelete(true)}
            className="w-full flex items-start gap-3 p-3.5 rounded-xl border-2 border-emerald-500 bg-emerald-50/60 hover:bg-emerald-100/70 text-left transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            <div className="p-2 bg-emerald-600 text-white rounded-lg mt-0.5 shrink-0 group-hover:scale-105 transition-transform">
              {loadingAction === "restore" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <PackageCheck className="w-4 h-4" />
              )}
            </div>
            <div className="space-y-0.5 flex-1">
              <div className="font-bold text-emerald-950 text-xs flex items-center justify-between">
                <span>Add Stock Back &amp; Delete {isInvoiceGenerated ? "Invoice & Order" : "Order"}</span>
                <span className="text-[10px] font-semibold uppercase tracking-wide bg-emerald-200/80 text-emerald-800 px-2 py-0.5 rounded-full">
                  Recommended
                </span>
              </div>
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                Restores the deducted sets and sizes back into product inventory stock and completely deletes the order {isInvoiceGenerated ? "and final invoice" : ""}.
              </p>
            </div>
          </button>

          {/* Option 2: Delete Order Form Only */}
          <button
            type="button"
            disabled={loadingAction !== null || (isInvoiceGenerated && twoFactorCode.trim().length < 4)}
            onClick={() => handleDelete(false)}
            className="w-full flex items-start gap-3 p-3.5 rounded-xl border border-red-300 bg-red-50/40 hover:bg-red-100/60 text-left transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            <div className="p-2 bg-red-600 text-white rounded-lg mt-0.5 shrink-0 group-hover:scale-105 transition-transform">
              {loadingAction === "no-restore" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </div>
            <div className="space-y-0.5 flex-1">
              <div className="font-bold text-red-950 text-xs">
                Delete {isInvoiceGenerated ? "Invoice & Order" : "Order Only"} (Keep Stock Unchanged)
              </div>
              <p className="text-[11px] text-red-800 leading-relaxed">
                Deletes the record without restoring product inventory stock (stock stays unchanged).
              </p>
            </div>
          </button>
        </div>

        {/* Modal Footer */}
        <div className="flex justify-end pt-3 border-t border-slate-200">
          <button
            type="button"
            disabled={loadingAction !== null}
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
