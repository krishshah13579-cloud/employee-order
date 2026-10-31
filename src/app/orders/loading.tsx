import { Loader2, ClipboardList } from "lucide-react";

export default function OrdersLoading() {
  return (
    <div className="min-h-screen bg-slate-50/60 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <div className="h-6 w-48 bg-slate-200 rounded animate-pulse" />
            <div className="h-4 w-64 bg-slate-100 rounded mt-2 animate-pulse" />
          </div>
        </div>

        <div className="py-16 bg-white rounded-2xl border border-slate-200 p-8 flex flex-col items-center justify-center text-center shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-orange-50 border border-orange-200 flex items-center justify-center text-orange-600 mb-3 shadow-xs">
            <Loader2 className="w-7 h-7 animate-spin" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">Loading Wholesale Orders...</h3>
          <p className="text-xs text-slate-500 mt-1">Fetching order forms, bill statuses, and dispatches.</p>
        </div>
      </div>
    </div>
  );
}
