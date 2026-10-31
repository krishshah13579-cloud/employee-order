import { Loader2, ShieldCheck } from "lucide-react";

export default function AdminLoading() {
  return (
    <div className="min-h-[65vh] flex flex-col items-center justify-center p-6 select-none animate-in fade-in duration-150">
      <div className="relative flex items-center justify-center mb-4">
        <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shadow-lg">
          <Loader2 className="w-7 h-7 text-white animate-spin" />
        </div>
        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm">
          <ShieldCheck className="w-3 h-3" />
        </div>
      </div>

      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-100 border border-zinc-300 text-zinc-800 text-[11px] font-bold uppercase tracking-wider mb-2">
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-900 animate-pulse" />
        <span>OBEXA ADMIN</span>
      </div>

      <h2 className="text-sm font-bold text-zinc-900 tracking-tight">
        Loading Admin Workspace...
      </h2>
      <p className="text-xs text-zinc-500 mt-1">
        Connecting to secured operations & inventory management.
      </p>
    </div>
  );
}
