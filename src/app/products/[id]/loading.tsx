import { Loader2, Shirt } from "lucide-react";

export default function ProductDetailLoading() {
  return (
    <div className="min-h-screen bg-white pb-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-8">
        {/* Breadcrumb skeleton */}
        <div className="h-4 w-40 bg-slate-100 rounded animate-pulse" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          {/* Photo gallery skeleton */}
          <div className="space-y-3">
            <div className="aspect-[4/5] w-full bg-slate-100 rounded-3xl animate-pulse flex items-center justify-center">
              <Shirt className="w-16 h-16 text-slate-200" />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="aspect-square bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          </div>

          {/* Details & Ordering skeleton */}
          <div className="space-y-5">
            <div className="space-y-2">
              <div className="h-5 w-24 bg-orange-100 rounded-full animate-pulse" />
              <div className="h-8 w-3/4 bg-slate-200 rounded-lg animate-pulse" />
              <div className="h-4 w-1/3 bg-slate-100 rounded animate-pulse" />
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center text-center space-y-2">
              <Loader2 className="w-7 h-7 text-orange-600 animate-spin" />
              <span className="text-xs font-bold text-slate-700">Loading Garment Specifications &amp; Ratios...</span>
            </div>

            <div className="space-y-3 pt-4 border-t border-slate-100">
              <div className="h-12 w-full bg-slate-100 rounded-xl animate-pulse" />
              <div className="h-12 w-full bg-slate-100 rounded-xl animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
