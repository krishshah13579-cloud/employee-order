import { Loader2, Globe } from "lucide-react";

export default function OnlineAdminLoading() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 select-none animate-in fade-in duration-150">
      <div className="relative flex items-center justify-center mb-4">
        <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center shadow-xs">
          <Loader2 className="w-7 h-7 text-blue-600 animate-spin" />
        </div>
        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xs">
          <Globe className="w-3 h-3" />
        </div>
      </div>

      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-[11px] font-bold uppercase tracking-wider mb-2">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
        <span>ONLINE E-COMMERCE ADMIN</span>
      </div>

      <h2 className="text-sm font-bold text-zinc-900 tracking-tight">
        Loading Online Store Management...
      </h2>
      <p className="text-xs text-zinc-500 mt-1">
        Synchronizing online catalog, deals, promotional pricing, and stock matrices.
      </p>
    </div>
  );
}
