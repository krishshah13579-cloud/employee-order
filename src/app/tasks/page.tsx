"use client";

import { useEffect, useState } from "react";
import {
  ListTodo,
  CheckCircle2,
  Clock,
  RefreshCw,
  AlertCircle,
  Sparkles,
  Calendar,
  User,
  ShieldCheck,
  Check,
  Loader2,
} from "lucide-react";
import { useEmployee } from "@/components/providers/EmployeeProvider";
import { useToast } from "@/components/ui/Toast";
import type { EmployeeTaskData } from "@/lib/types";

export default function EmployeeTasksPage() {
  const { employee, loading: employeeLoading } = useEmployee();
  const { toast } = useToast();

  const [tasks, setTasks] = useState<EmployeeTaskData[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingTaskId, setUpdatingTaskId] = useState<number | null>(null);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/employee/tasks", { cache: "no-store" });
      if (!res.ok) {
        throw new Error("Failed to load tasks");
      }
      const data = await res.json();
      setTasks(data.tasks || []);
    } catch (err: any) {
      toast("Error loading tasks: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleToggleTask = async (task: EmployeeTaskData) => {
    const nextCompleted = !task.isCompleted;
    setUpdatingTaskId(task.id);

    // Optimistic UI update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? {
              ...t,
              isCompleted: nextCompleted,
              completedAt: nextCompleted ? new Date().toISOString() : null,
            }
          : t
      )
    );

    try {
      const res = await fetch("/api/employee/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: task.id,
          isCompleted: nextCompleted,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || "Failed to update task");
      }

      const result = await res.json();
      if (nextCompleted) {
        toast("Task completed! Timestamp sent to Admin.", "success");
      } else {
        toast("Task marked pending.", "info");
      }

      // Sync updated task from response
      if (result.task) {
        setTasks((prev) =>
          prev.map((t) => (t.id === result.task.id ? { ...t, ...result.task } : t))
        );
      }
    } catch (err: any) {
      // Revert optimistic update on failure
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, isCompleted: task.isCompleted, completedAt: task.completedAt } : t))
      );
      toast("Failed to update task: " + err.message, "error");
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const completedCount = tasks.filter((t) => t.isCompleted).length;
  const totalCount = tasks.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Top Header Banner */}
        <div className="bg-gradient-to-r from-purple-800 via-indigo-800 to-slate-900 p-6 sm:p-8 rounded-3xl text-white shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 rounded-full bg-purple-400/20 text-purple-200 text-xs font-bold border border-purple-400/30">
                  {employee?.designation || "Office Employee"}
                </span>
                <span className="text-xs text-purple-200 font-medium">Daily Checklist</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2.5">
                <ListTodo className="w-8 h-8 text-purple-300" />
                <span>Assigned Tasks</span>
              </h1>
              <p className="text-xs text-purple-200 mt-1 max-w-lg">
                Mark your daily tasks as completed. Each completed task is timestamped and synchronized directly to the Admin dashboard in real time.
              </p>
            </div>

            <button
              type="button"
              onClick={fetchTasks}
              disabled={loading}
              className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white rounded-xl text-xs font-bold backdrop-blur-xs transition cursor-pointer border border-white/20 shrink-0"
              title="Refresh task list"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              <span>Refresh</span>
            </button>
          </div>

          {/* Progress Bar */}
          <div className="mt-6 pt-5 border-t border-white/10">
            <div className="flex items-center justify-between text-xs font-bold mb-2 text-purple-200">
              <span>Overall Progress</span>
              <span className="font-mono text-white">
                {completedCount} of {totalCount} Completed ({progressPercent}%)
              </span>
            </div>
            <div className="w-full h-3 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 to-teal-300 transition-all duration-500 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Task List */}
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs p-5 sm:p-7 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Task Checklist</span>
            </h2>
            <span className="text-xs font-semibold text-slate-500">
              {totalCount === 0 ? "No tasks" : `${totalCount - completedCount} pending`}
            </span>
          </div>

          {loading && tasks.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-7 h-7 text-purple-600 animate-spin" />
              <p className="text-xs font-semibold text-slate-500">Loading assigned tasks...</p>
            </div>
          ) : tasks.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto">
                <ListTodo size={28} />
              </div>
              <h3 className="text-base font-bold text-slate-900">No Tasks Assigned Yet</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Your administrator has not assigned any specific checklist tasks to your account. When tasks are assigned from the Admin panel, they will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => {
                const isUpdating = updatingTaskId === task.id;
                const completedDate = task.completedAt ? new Date(task.completedAt) : null;

                return (
                  <div
                    key={task.id}
                    onClick={() => !isUpdating && handleToggleTask(task)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3.5 select-none ${
                      task.isCompleted
                        ? "bg-emerald-50/40 border-emerald-200 text-slate-700"
                        : "bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-900 shadow-2xs"
                    }`}
                  >
                    {/* Custom Checkbox */}
                    <div className="pt-0.5 shrink-0">
                      <div
                        className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
                          task.isCompleted
                            ? "bg-emerald-600 text-white shadow-xs"
                            : "border-2 border-slate-300 bg-white hover:border-purple-600"
                        }`}
                      >
                        {isUpdating ? (
                          <Loader2 size={13} className="animate-spin text-current" />
                        ) : task.isCompleted ? (
                          <Check size={14} className="stroke-[3]" />
                        ) : null}
                      </div>
                    </div>

                    {/* Task Title & Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span
                          className={`text-sm font-bold ${
                            task.isCompleted
                              ? "line-through text-slate-500"
                              : "text-slate-900"
                          }`}
                        >
                          {task.taskTitle}
                        </span>
                        <span
                          className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full shrink-0 ${
                            task.isCompleted
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {task.isCompleted ? "Completed" : "Pending"}
                        </span>
                      </div>

                      {/* Timestamp Info */}
                      {task.isCompleted && completedDate && (
                        <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 mt-1">
                          <Clock size={12} />
                          <span>
                            Done on{" "}
                            {completedDate.toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}{" "}
                            at{" "}
                            {completedDate.toLocaleTimeString("en-IN", {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: true,
                            })}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
