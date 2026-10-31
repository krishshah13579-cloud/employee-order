import { Loader2, Users } from "lucide-react";

export default function EmployeeAdminLoading() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 select-none animate-in fade-in duration-150">
      <div className="relative flex items-center justify-center mb-4">
        <div className="w-14 h-14 rounded-2xl bg-orange-50 border border-orange-200 flex items-center justify-center shadow-xs">
          <Loader2 className="w-7 h-7 text-orange-600 animate-spin" />
        </div>
        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-orange-600 text-white flex items-center justify-center shadow-xs">
          <Users className="w-3 h-3" />
        </div>
      </div>

      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-orange-800 text-[11px] font-bold uppercase tracking-wider mb-2">
        <span className="w-1.5 h-1.5 rounded-full bg-orange-600 animate-pulse" />
        <span>WHOLESALE CONTROL CENTER</span>
      </div>

      <h2 className="text-sm font-bold text-zinc-900 tracking-tight">
        Loading Wholesale Management...
      </h2>
      <p className="text-xs text-zinc-500 mt-1">
        Synchronizing employee records, wholesale stock, and dispatch records.
      </p>
    </div>
  );
}
