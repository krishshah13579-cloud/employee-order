import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-security";

/**
 * Audit Logs API - ISO 27001 (A.8.15) & SOC 2 Type II
 * Provides authenticated administrators with visibility into security and business events.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.authorized) {
      return auth.errorResponse!;
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get("limit") || "50", 10)));
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10));
    const actionFilter = searchParams.get("action");
    const actorFilter = searchParams.get("actor");

    const where: any = {};
    if (actionFilter) {
      where.action = actionFilter;
    }
    if (actorFilter) {
      where.actorName = { contains: actorFilter, mode: "insensitive" };
    }

    const [logs, total] = await Promise.all([
      (prisma as any).auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      (prisma as any).auditLog.count({ where }),
    ]);

    return NextResponse.json({
      logs,
      total,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error("Failed to fetch audit logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch audit logs: " + error.message },
      { status: 500 }
    );
  }
}
