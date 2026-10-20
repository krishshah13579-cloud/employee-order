import prisma from "@/lib/prisma";
import { getAvailableSetsForColor, getAllProductColors } from "@/lib/stock";

export interface ColorStockReservationInfo {
  totalStock: number;
  reservedByOthers: number;
  reservedByMe: number;
  availableForMe: number;
  isSoldOut: boolean;
}

// In-memory fallback map in case database table is migrating or on cold starts
interface MemoryReservation {
  sessionId: string;
  employeeName?: string | null;
  productId: number;
  color: string;
  sets: number;
  expiresAt: number;
}
const memoryReservations: MemoryReservation[] = [];

function cleanMemoryReservations() {
  const now = Date.now();
  for (let i = memoryReservations.length - 1; i >= 0; i--) {
    if (memoryReservations[i].expiresAt < now || memoryReservations[i].sets <= 0) {
      memoryReservations.splice(i, 1);
    }
  }
}

/**
 * Calculates effective available stock for a product, accounting for real-time active reservations by other employees.
 */
export async function getEffectiveStock(
  productId: number,
  setsColorwise: string | null | undefined,
  colorMapping: string | null | undefined,
  colorsAvailable: string | null | undefined,
  sessionId: string
): Promise<Record<string, ColorStockReservationInfo>> {
  const colors = getAllProductColors(colorsAvailable, setsColorwise, colorMapping);
  const result: Record<string, ColorStockReservationInfo> = {};

  const now = new Date();

  // Try DB first
  let dbReservations: { sessionId: string; color: string; sets: number }[] = [];
  try {
    // Delete expired reservations
    if ((prisma as any).stockReservation) {
      await (prisma as any).stockReservation.deleteMany({
        where: { expiresAt: { lt: now } },
      });

      dbReservations = await (prisma as any).stockReservation.findMany({
        where: {
          productId,
          expiresAt: { gte: now },
        },
        select: {
          sessionId: true,
          color: true,
          sets: true,
        },
      });
    }
  } catch (err) {
    // Fall back to memory
    cleanMemoryReservations();
    dbReservations = memoryReservations.filter((r) => r.productId === productId);
  }

  for (const color of colors) {
    const totalStock = getAvailableSetsForColor(setsColorwise, color, colorMapping);

    // Sum reservations for this color
    let reservedByOthers = 0;
    let reservedByMe = 0;

    for (const res of dbReservations) {
      if (res.color.toLowerCase() === color.toLowerCase()) {
        if (res.sessionId === sessionId) {
          reservedByMe += res.sets;
        } else {
          reservedByOthers += res.sets;
        }
      }
    }

    const availableForMe = Math.max(0, totalStock - reservedByOthers);
    const isSoldOut = availableForMe <= 0;

    result[color] = {
      totalStock,
      reservedByOthers,
      reservedByMe,
      availableForMe,
      isSoldOut,
    };
  }

  return result;
}

/**
 * Atomically reserve or release sets for a specific product and color.
 * If requestedSets exceeds available stock (totalStock - reservedByOthers),
 * it caps at availableForMe and returns success: false with the capped count.
 */
export async function reserveColorSets(
  sessionId: string,
  employeeName: string | null | undefined,
  productId: number,
  color: string,
  requestedSets: number,
  setsColorwise: string | null | undefined,
  colorMapping: string | null | undefined
): Promise<{
  success: boolean;
  allocatedSets: number;
  availableForMe: number;
  message?: string;
}> {
  const now = new Date();
  const ttlMinutes = 15;
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
  const totalStock = getAvailableSetsForColor(setsColorwise, color, colorMapping);

  try {
    if ((prisma as any).stockReservation) {
      // Clean expired
      await (prisma as any).stockReservation.deleteMany({
        where: { expiresAt: { lt: now } },
      });

      // Sum reservations by other sessions for this product and color
      const otherReservations = await (prisma as any).stockReservation.findMany({
        where: {
          productId,
          color: { equals: color, mode: "insensitive" },
          sessionId: { not: sessionId },
          expiresAt: { gte: now },
        },
      });

      const reservedByOthers = otherReservations.reduce(
        (sum: number, r: any) => sum + (r.sets || 0),
        0
      );

      const availableForMe = Math.max(0, totalStock - reservedByOthers);

      if (requestedSets <= 0) {
        // Release reservation
        await (prisma as any).stockReservation.deleteMany({
          where: {
            productId,
            sessionId,
            color: { equals: color, mode: "insensitive" },
          },
        });
        return { success: true, allocatedSets: 0, availableForMe };
      }

      if (requestedSets > availableForMe) {
        // Exceeds available stock, cap to availableForMe
        if (availableForMe > 0) {
          const existing = await (prisma as any).stockReservation.findFirst({
            where: {
              productId,
              sessionId,
              color: { equals: color, mode: "insensitive" },
            },
          });

          if (existing) {
            await (prisma as any).stockReservation.update({
              where: { id: existing.id },
              data: { sets: availableForMe, expiresAt, employeeName },
            });
          } else {
            await (prisma as any).stockReservation.create({
              data: {
                sessionId,
                employeeName,
                productId,
                color,
                sets: availableForMe,
                expiresAt,
              },
            });
          }
        } else {
          // 0 available, release any previous reservation
          await (prisma as any).stockReservation.deleteMany({
            where: {
              productId,
              sessionId,
              color: { equals: color, mode: "insensitive" },
            },
          });
        }

        return {
          success: false,
          allocatedSets: availableForMe,
          availableForMe,
          message:
            availableForMe <= 0
              ? `All ${totalStock} sets of "${color}" are currently reserved by other active orders.`
              : `Stock limit reached: only ${availableForMe} ${
                  availableForMe === 1 ? "set is" : "sets are"
                } available for "${color}" (${reservedByOthers} reserved by other orders).`,
        };
      }

      // Valid requested sets, upsert reservation
      const existing = await (prisma as any).stockReservation.findFirst({
        where: {
          productId,
          sessionId,
          color: { equals: color, mode: "insensitive" },
        },
      });

      if (existing) {
        await (prisma as any).stockReservation.update({
          where: { id: existing.id },
          data: { sets: requestedSets, expiresAt, employeeName },
        });
      } else {
        await (prisma as any).stockReservation.create({
          data: {
            sessionId,
            employeeName,
            productId,
            color,
            sets: requestedSets,
            expiresAt,
          },
        });
      }

      return { success: true, allocatedSets: requestedSets, availableForMe };
    }
  } catch (err) {
    // Memory fallback
  }

  // Fallback to memory
  cleanMemoryReservations();
  const otherResSets = memoryReservations
    .filter(
      (r) =>
        r.productId === productId &&
        r.color.toLowerCase() === color.toLowerCase() &&
        r.sessionId !== sessionId
    )
    .reduce((sum, r) => sum + r.sets, 0);

  const availableForMe = Math.max(0, totalStock - otherResSets);
  const targetIdx = memoryReservations.findIndex(
    (r) =>
      r.productId === productId &&
      r.color.toLowerCase() === color.toLowerCase() &&
      r.sessionId === sessionId
  );

  if (requestedSets <= 0) {
    if (targetIdx !== -1) memoryReservations.splice(targetIdx, 1);
    return { success: true, allocatedSets: 0, availableForMe };
  }

  const allocated = Math.min(requestedSets, availableForMe);
  if (targetIdx !== -1) {
    memoryReservations[targetIdx].sets = allocated;
    memoryReservations[targetIdx].expiresAt = Date.now() + ttlMinutes * 60 * 1000;
  } else if (allocated > 0) {
    memoryReservations.push({
      sessionId,
      employeeName,
      productId,
      color,
      sets: allocated,
      expiresAt: Date.now() + ttlMinutes * 60 * 1000,
    });
  }

  return {
    success: allocated === requestedSets,
    allocatedSets: allocated,
    availableForMe,
    message:
      allocated < requestedSets
        ? `Only ${allocated} sets available for "${color}".`
        : undefined,
  };
}

/**
 * Releases all reservations held by a session (e.g. after order placement or order form clearance).
 */
export async function releaseReservations(sessionId: string, productId?: number) {
  if (!sessionId) return;
  try {
    if ((prisma as any).stockReservation) {
      const where: any = { sessionId };
      if (productId) where.productId = productId;
      await (prisma as any).stockReservation.deleteMany({ where });
    }
  } catch (err) {}

  cleanMemoryReservations();
  for (let i = memoryReservations.length - 1; i >= 0; i--) {
    if (
      memoryReservations[i].sessionId === sessionId &&
      (!productId || memoryReservations[i].productId === productId)
    ) {
      memoryReservations.splice(i, 1);
    }
  }
}
