import prisma from "./prisma";

let isSchemaEnsured = false;

export async function ensureDbSchema(force = false) {
  if (isSchemaEnsured && !force) return;
  try {
    try {
      await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS wholesale;`);
    } catch {}

    // Explicitly ensure canViewOrderForm on wholesale.Employee and all schema variants
    const alterStatements = [
      `ALTER TABLE wholesale."Employee" ADD COLUMN IF NOT EXISTS "canViewOrderForm" BOOLEAN DEFAULT true;`,
      `ALTER TABLE wholesale.employee ADD COLUMN IF NOT EXISTS "canViewOrderForm" BOOLEAN DEFAULT true;`,
      `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "canViewOrderForm" BOOLEAN DEFAULT true;`,
      `ALTER TABLE employee ADD COLUMN IF NOT EXISTS "canViewOrderForm" BOOLEAN DEFAULT true;`,
      `ALTER TABLE public."Employee" ADD COLUMN IF NOT EXISTS "canViewOrderForm" BOOLEAN DEFAULT true;`,
      `ALTER TABLE public.employee ADD COLUMN IF NOT EXISTS "canViewOrderForm" BOOLEAN DEFAULT true;`,
    ];

    for (const sql of alterStatements) {
      try {
        await prisma.$executeRawUnsafe(sql);
      } catch {}
    }

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

        -- 4. Ensure wholesale."Product" washGuide and description
        BEGIN
          ALTER TABLE wholesale."Product" ADD COLUMN IF NOT EXISTS "washGuide" TEXT;
          ALTER TABLE wholesale."Product" ADD COLUMN IF NOT EXISTS "description" TEXT;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
        BEGIN
          ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "washGuide" TEXT;
          ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "description" TEXT;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;

        -- 5. Ensure wholesale."Employee" canViewOrderForm, username, displayPin, mustChangePin, onboardingStep & EmployeeTask table
        BEGIN
          ALTER TABLE wholesale."Employee" ADD COLUMN IF NOT EXISTS "canViewOrderForm" BOOLEAN DEFAULT true;
          ALTER TABLE wholesale."Employee" ADD COLUMN IF NOT EXISTS "username" TEXT;
          ALTER TABLE wholesale."Employee" ADD COLUMN IF NOT EXISTS "displayPin" TEXT DEFAULT '1234';
          ALTER TABLE wholesale."Employee" ADD COLUMN IF NOT EXISTS "mustChangePin" BOOLEAN DEFAULT true;
          ALTER TABLE wholesale."Employee" ADD COLUMN IF NOT EXISTS "onboardingStep" INTEGER DEFAULT 3;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
        BEGIN
          ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "canViewOrderForm" BOOLEAN DEFAULT true;
          ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "username" TEXT;
          ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "displayPin" TEXT DEFAULT '1234';
          ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "mustChangePin" BOOLEAN DEFAULT true;
          ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "onboardingStep" INTEGER DEFAULT 3;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;

        BEGIN
          CREATE TABLE IF NOT EXISTS wholesale."EmployeeTask" (
            "id" SERIAL PRIMARY KEY,
            "employeeId" INTEGER NOT NULL,
            "taskTitle" TEXT NOT NULL,
            "isCompleted" BOOLEAN DEFAULT false,
            "completedAt" TIMESTAMP(3),
            "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "EmployeeTask_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES wholesale."Employee"("id") ON DELETE CASCADE
          );
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
        BEGIN
          CREATE TABLE IF NOT EXISTS "EmployeeTask" (
            "id" SERIAL PRIMARY KEY,
            "employeeId" INTEGER NOT NULL,
            "taskTitle" TEXT NOT NULL,
            "isCompleted" BOOLEAN DEFAULT false,
            "completedAt" TIMESTAMP(3),
            "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
          );
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
        -- 6. Ensure wholesale."Order" employeeId
        BEGIN
          ALTER TABLE wholesale."Order" ADD COLUMN IF NOT EXISTS "employeeId" INTEGER;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
        BEGIN
          ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "employeeId" INTEGER;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
      END $$;
    `);
    isSchemaEnsured = true;
  } catch (err) {
    console.warn("[DB_SCHEMA] Automatic schema alignment notice:", err);
  }
}
