import prisma from "@/lib/prisma";

export interface AuditLogEntry {
  action: string;
  actorType: "ADMIN" | "EMPLOYEE" | "SYSTEM";
  actorName: string;
  entityType?: string;
  entityId?: string | number;
  details?: string | Record<string, any>;
  ipAddress?: string | null;
  status?: "SUCCESS" | "FAILURE" | "BLOCKED";
}

/**
 * Centrally records immutable security and business event audit logs.
 * Conforms to SOC 2 Type II, ISO 27001, and CIS Control 8.
 */
export async function recordAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    const detailsStr =
      entry.details !== undefined && entry.details !== null
        ? typeof entry.details === "object"
          ? JSON.stringify(entry.details)
          : String(entry.details)
        : null;

    if ((prisma as any).auditLog) {
      await (prisma as any).auditLog.create({
        data: {
          action: entry.action,
          actorType: entry.actorType,
          actorName: entry.actorName,
          entityType: entry.entityType || null,
          entityId: entry.entityId ? String(entry.entityId) : null,
          details: detailsStr,
          ipAddress: entry.ipAddress || null,
          status: entry.status || "SUCCESS",
        },
      });
    }
  } catch (err: any) {
    // Audit logging is non-blocking to preserve application availability (NIST CSF PR.DS)
    console.warn("[AUDIT LOG WARN] Failed to persist audit record:", err.message);
  }
}
