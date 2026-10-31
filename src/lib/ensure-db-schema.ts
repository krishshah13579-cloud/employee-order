import prisma from "./prisma";

let isSchemaEnsured = false;

export async function ensureDbSchema() {
  if (isSchemaEnsured) return;
  try {
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        -- 1. Ensure wholesale."ProductCosting" columns
        BEGIN
          ALTER TABLE wholesale."ProductCosting" ADD COLUMN IF NOT EXISTS "arrivalDate" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
          ALTER TABLE wholesale."ProductCosting" ADD COLUMN IF NOT EXISTS "totalMeters" DOUBLE PRECISION DEFAULT 0;
          ALTER TABLE wholesale."ProductCosting" ADD COLUMN IF NOT EXISTS "totalPcs" INTEGER DEFAULT 0;
          ALTER TABLE wholesale."ProductCosting" ADD COLUMN IF NOT EXISTS "itemsUsed" TEXT;
          ALTER TABLE wholesale."ProductCosting" ADD COLUMN IF NOT EXISTS "itemCostPerPiece" DOUBLE PRECISION DEFAULT 0;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;

        -- 2. Fallback for public schema
        BEGIN
          ALTER TABLE "ProductCosting" ADD COLUMN IF NOT EXISTS "arrivalDate" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
          ALTER TABLE "ProductCosting" ADD COLUMN IF NOT EXISTS "totalMeters" DOUBLE PRECISION DEFAULT 0;
          ALTER TABLE "ProductCosting" ADD COLUMN IF NOT EXISTS "totalPcs" INTEGER DEFAULT 0;
          ALTER TABLE "ProductCosting" ADD COLUMN IF NOT EXISTS "itemsUsed" TEXT;
          ALTER TABLE "ProductCosting" ADD COLUMN IF NOT EXISTS "itemCostPerPiece" DOUBLE PRECISION DEFAULT 0;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;

        -- 3. Ensure AccessoryItem columns
        BEGIN
          ALTER TABLE wholesale."AccessoryItem" ADD COLUMN IF NOT EXISTS "costPerUnit" DOUBLE PRECISION DEFAULT 0;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
        BEGIN
          ALTER TABLE "AccessoryItem" ADD COLUMN IF NOT EXISTS "costPerUnit" DOUBLE PRECISION DEFAULT 0;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
      END $$;
    `);
    isSchemaEnsured = true;
  } catch (err) {
    console.warn("[DB_SCHEMA] Automatic schema alignment notice:", err);
  }
}
