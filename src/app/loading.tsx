import { Loader2, Sparkles } from "lucide-react";

export default function GlobalLoading() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 select-none animate-in fade-in duration-200">
      <div className="relative flex items-center justify-center mb-5">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-orange-500/10 via-amber-500/15 to-orange-500/20 border border-orange-200/80 flex items-center justify-center shadow-sm">
          <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
        </div>
        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-orange-600 text-white flex items-center justify-center shadow-xs">
          <Sparkles className="w-3 h-3" />
        </div>
      </div>

      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-orange-800 text-[11px] font-bold uppercase tracking-wider mb-2">
        <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
        <span>IQ TROUSERS</span>
      </div>

      <h2 className="text-sm font-bold text-slate-900 tracking-tight">
        Loading Portal...
      </h2>
      <p className="text-xs text-slate-500 mt-1">
        Preparing catalog data, orders, and field tools.
      </p>
    </div>
  );
}
