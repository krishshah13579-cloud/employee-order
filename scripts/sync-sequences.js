const { PrismaClient } = require("@prisma/client");

async function main() {
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

    // Ensure testuser@iqtrousers.com exists in wholesale.AdminAccount
    try {
      const crypto = require("crypto");
      const salt = crypto.randomBytes(16).toString("hex");
      const derivedKey = crypto.scryptSync("Test@1234", salt, 64);
      const scryptHash = `scrypt:${salt}:${derivedKey.toString("hex")}`;
      const expiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

      const existingTestUser = await prisma.adminAccount.findUnique({
        where: { username: "testuser@iqtrousers.com" }
      });
      if (!existingTestUser) {
        await prisma.adminAccount.create({
          data: {
            username: "testuser@iqtrousers.com",
            password: scryptHash,
            lastOtp: "123456",
            otpExpiresAt: expiry,
          }
        });
        console.log("✅ [AUTH] Seeded testuser@iqtrousers.com in wholesale.AdminAccount");
      }
    } catch (testUserErr) {
      // Non-blocking
    }

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
