import { Loader2, CheckSquare } from "lucide-react";

export default function TasksLoading() {
  return (
    <div className="min-h-screen bg-slate-50/70 py-6 sm:py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 flex flex-col items-center justify-center text-center shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 mb-3 shadow-xs">
            <Loader2 className="w-7 h-7 animate-spin" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">Loading Office Employee Tasks...</h3>
          <p className="text-xs text-slate-500 mt-1">Fetching your assigned checklist from the database.</p>
        </div>
      </div>
    </div>
  );
}
