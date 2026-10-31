import { Loader2, Package } from "lucide-react";

export default function ProductsLoading() {
  return (
    <div className="min-h-screen bg-slate-50/60 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-6">
        {/* Header Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div className="space-y-2">
            <div className="h-6 w-48 bg-slate-200 rounded-lg animate-pulse" />
            <div className="h-4 w-72 bg-slate-100 rounded-md animate-pulse" />
          </div>
          <div className="h-9 w-32 bg-slate-200 rounded-xl animate-pulse" />
        </div>

        {/* Categories Bar Skeleton */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-8 w-24 bg-slate-200 rounded-full animate-pulse shrink-0" />
          ))}
        </div>

        {/* Center Spinner Banner */}
        <div className="py-12 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center mb-3 shadow-xs">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">Loading Garment Catalog...</h3>
          <p className="text-xs text-slate-500 mt-0.5">Fetching latest styles, set ratios, and stock availability.</p>
        </div>

        {/* Grid Skeletons */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs p-3 space-y-3">
              <div className="aspect-[4/5] w-full bg-slate-100 rounded-xl animate-pulse" />
              <div className="h-4 w-3/4 bg-slate-200 rounded animate-pulse" />
              <div className="h-3 w-1/2 bg-slate-100 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
