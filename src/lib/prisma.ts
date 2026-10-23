import { PrismaClient } from "@prisma/client";

function getNormalizedDbUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;
  if ((url.startsWith("postgres://") || url.startsWith("postgresql://")) && !url.includes("schema=")) {
    return url.includes("?") ? `${url}&schema=wholesale` : `${url}?schema=wholesale`;
  }
  return url;
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

const dbUrl = getNormalizedDbUrl();

export const prisma =
  globalForPrisma.prisma ||
  (dbUrl
    ? new PrismaClient({ datasources: { db: { url: dbUrl } } })
    : new PrismaClient());

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
