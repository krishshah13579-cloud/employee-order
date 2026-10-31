import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getEmployeeSession } from "@/lib/auth-security";
import { sendWebPushNotification } from "@/lib/web-push";
import { recordAuditLog } from "@/lib/audit";
import { ensureDbSchema } from "@/lib/ensure-db-schema";

export const dynamic = "force-dynamic";

// GET /api/employee/tasks — Fetch tasks assigned to the currently logged in employee
export async function GET(req: NextRequest) {
  try {
    await ensureDbSchema();
    const employee = await getEmployeeSession(req);
    if (!employee) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tasks = await prisma.employeeTask.findMany({
      where: { employeeId: employee.id },
      orderBy: [{ isCompleted: "asc" }, { id: "asc" }],
    });

    return NextResponse.json({
      success: true,
      employee: {
        id: employee.id,
        name: employee.name,
        designation: employee.designation,
      },
      tasks,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/employee/tasks — Toggle task completion and notify Admin
export async function POST(req: NextRequest) {
  try {
    await ensureDbSchema();
    const employee = await getEmployeeSession(req);
    if (!employee) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { taskId, isCompleted } = body;

    if (!taskId) {
      return NextResponse.json({ error: "Task ID is required" }, { status: 400 });
    }

    // Verify task belongs to this employee
    const existingTask = await prisma.employeeTask.findFirst({
      where: { id: Number(taskId), employeeId: employee.id },
    });

    if (!existingTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const completed = Boolean(isCompleted);
    const completedAt = completed ? new Date() : null;

    const updatedTask = await prisma.employeeTask.update({
      where: { id: existingTask.id },
      data: {
        isCompleted: completed,
        completedAt,
      },
    });

    // When task is marked DONE, alert Admin logged-in devices with timestamp
    if (completed) {
      const timeStr = completedAt!.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      const dateStr = completedAt!.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });

      // 1. Dispatch Web Push notification to Super Admin devices
      try {
        await sendWebPushNotification(
          {
            title: `Task Completed: ${updatedTask.taskTitle}`,
            body: `${employee.name} (${employee.designation}) completed this task on ${dateStr} at ${timeStr}.`,
            url: "/admin/employee/employees",
            icon: "/icon-192.png",
            badge: "/icon-192.png",
          },
          { role: "SUPER_ADMIN" }
        );
      } catch (pushErr) {
        console.warn("[TASK/PUSH] Failed to send push notification to admin:", pushErr);
      }

      // 2. Record in system audit log
      try {
        await recordAuditLog({
          action: "TASK_COMPLETED",
          actorType: "EMPLOYEE",
          actorName: employee.name,
          entityType: "EmployeeTask",
          entityId: updatedTask.id,
          details: `Office Employee "${employee.name}" completed task "${updatedTask.taskTitle}" on ${dateStr} at ${timeStr}`,
          status: "SUCCESS",
        });
      } catch (auditErr) {
        console.warn("[TASK/AUDIT] Failed to record audit log:", auditErr);
      }
    }

    return NextResponse.json({
      success: true,
      task: updatedTask,
      message: completed
        ? `Task completed! Admin has been notified with completion timestamp.`
        : "Task reopened.",
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
