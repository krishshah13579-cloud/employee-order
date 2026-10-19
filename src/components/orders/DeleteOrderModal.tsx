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

  if (!order) return null;

  const handleDelete = async (restoreStock: boolean) => {
    try {
      setError(null);
      setLoadingAction(restoreStock ? "restore" : "no-restore");

      const res = await fetch(`/api/orders/${order.id}?restoreStock=${restoreStock}`, {
        method: "DELETE",
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
    <Modal isOpen={isOpen} onClose={loadingAction ? () => {} : onClose} title="Delete Wholesale Order" size="md">
      <div className="space-y-5">
        {/* Warning Banner */}
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

        {/* Order Summary Card */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Order Number:</span>
            <span className="font-mono font-bold text-slate-900 text-sm">{order.orderNumber}</span>
          </div>
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
              <span className="text-slate-500">Order Total:</span>
              <span className="font-bold text-slate-900 text-sm font-mono">{formatCurrency(order.grandTotal)}</span>
            </div>
          )}
        </div>

        {/* Tax Invoice Preservation Notice */}
        {order.taxInvoiceNumber ? (
          <div className="flex items-start gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold text-emerald-950">Tax Invoice Will Be Preserved:</span>
              <p className="text-emerald-800 leading-relaxed">
                Tax Invoice <strong className="font-mono">{order.taxInvoiceNumber}</strong> has been generated for this order. It will <strong>NOT</strong> be deleted and will remain safely intact in the Sales Register &amp; Ledger.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg text-[11px] text-slate-600">
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            <span>No Tax Invoice was generated for this order.</span>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
            {error}
          </div>
        )}

        {/* Actions Selection */}
        <div className="space-y-3 pt-2">
          <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Choose Deletion Action:
          </p>

          {/* Option 1: Add Stock Back & Delete */}
          <button
            type="button"
            disabled={loadingAction !== null}
            onClick={() => handleDelete(true)}
            className="w-full flex items-start gap-3 p-3.5 rounded-xl border-2 border-emerald-500 bg-emerald-50/60 hover:bg-emerald-100/70 text-left transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed group"
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
                <span>Add Stock Back &amp; Delete Order</span>
                <span className="text-[10px] font-semibold uppercase tracking-wide bg-emerald-200/80 text-emerald-800 px-2 py-0.5 rounded-full">
                  Recommended
                </span>
              </div>
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                Restores the deducted sets and sizes back to product inventory, deletes the order form, and preserves any generated Tax Invoice.
              </p>
            </div>
          </button>

          {/* Option 2: Delete Order Form Only */}
          <button
            type="button"
            disabled={loadingAction !== null}
            onClick={() => handleDelete(false)}
            className="w-full flex items-start gap-3 p-3.5 rounded-xl border border-red-300 bg-red-50/40 hover:bg-red-100/60 text-left transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed group"
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
                Delete Order Form Only (Keep Stock Unchanged)
              </div>
              <p className="text-[11px] text-red-800 leading-relaxed">
                Deletes the order form without modifying inventory stock (stock is NOT added back). Any generated Tax Invoice remains preserved.
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
