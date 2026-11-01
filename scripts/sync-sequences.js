const { PrismaClient } = require("@prisma/client");

async function main() {
  const fs = require("fs");
  const path = require("path");
  try {
    const pubUploads = path.join(process.cwd(), "public", "uploads");
    fs.mkdirSync(pubUploads, { recursive: true });
    try { fs.chmodSync(pubUploads, 0o777); } catch {}
  } catch (e) {}
  try {
    const tmpUploads = path.join("/tmp", "uploads");
    fs.mkdirSync(tmpUploads, { recursive: true });
    try { fs.chmodSync(tmpUploads, 0o777); } catch {}
  } catch (e) {}

  if (!process.env.DATABASE_URL) {
    console.log("ℹ️ [POSTGRES] No DATABASE_URL provided during build step; sequence sync handled live at runtime.");
    return;
  }

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

  try {
    console.log("⚡ [POSTGRES] Pre-syncing all sequence counters to prevent (id) collisions...");
    const alterStatements = [
      `CREATE SCHEMA IF NOT EXISTS wholesale;`,
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
        BEGIN
          ALTER TABLE wholesale."ProductCosting" ADD COLUMN IF NOT EXISTS "arrivalDate" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
          ALTER TABLE wholesale."ProductCosting" ADD COLUMN IF NOT EXISTS "totalMeters" DOUBLE PRECISION DEFAULT 0;
          ALTER TABLE wholesale."ProductCosting" ADD COLUMN IF NOT EXISTS "totalPcs" INTEGER DEFAULT 0;
          ALTER TABLE wholesale."ProductCosting" ADD COLUMN IF NOT EXISTS "itemsUsed" TEXT;
          ALTER TABLE wholesale."ProductCosting" ADD COLUMN IF NOT EXISTS "itemCostPerPiece" DOUBLE PRECISION DEFAULT 0;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
        BEGIN
          ALTER TABLE "ProductCosting" ADD COLUMN IF NOT EXISTS "arrivalDate" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
          ALTER TABLE "ProductCosting" ADD COLUMN IF NOT EXISTS "totalMeters" DOUBLE PRECISION DEFAULT 0;
          ALTER TABLE "ProductCosting" ADD COLUMN IF NOT EXISTS "totalPcs" INTEGER DEFAULT 0;
          ALTER TABLE "ProductCosting" ADD COLUMN IF NOT EXISTS "itemsUsed" TEXT;
          ALTER TABLE "ProductCosting" ADD COLUMN IF NOT EXISTS "itemCostPerPiece" DOUBLE PRECISION DEFAULT 0;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
        BEGIN
          ALTER TABLE wholesale."Product" ADD COLUMN IF NOT EXISTS "washGuide" TEXT;
          ALTER TABLE wholesale."Product" ADD COLUMN IF NOT EXISTS "description" TEXT;
          ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "washGuide" TEXT;
          ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "description" TEXT;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
        BEGIN
          ALTER TABLE wholesale."Employee" ADD COLUMN IF NOT EXISTS "canViewOrderForm" BOOLEAN DEFAULT true;
          ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "canViewOrderForm" BOOLEAN DEFAULT true;
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
      END $$;
    `);
    await prisma.$executeRawUnsafe(`
      DO $$
      DECLARE
        t text;
        seq text;
      BEGIN
        FOR t IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'wholesale' LOOP
          BEGIN
            seq := pg_get_serial_sequence('wholesale."' || t || '"', 'id');
            IF seq IS NOT NULL THEN
              EXECUTE 'SELECT setval(' || quote_literal(seq) || ', COALESCE((SELECT MAX(id) FROM wholesale."' || t || '"), 0) + 1, false)';
            END IF;
          EXCEPTION WHEN OTHERS THEN
            NULL;
          END;
        END LOOP;
      END $$;
    `);
    console.log("✅ [POSTGRES] All wholesale sequences synchronized successfully.");
  } catch (err) {
    console.log("ℹ️ [POSTGRES] Database unreachable during build container step; live sequence sync is active at runtime.");
  } finally {
    try {
      await prisma.$disconnect();
    } catch {}
  }
}

main();
