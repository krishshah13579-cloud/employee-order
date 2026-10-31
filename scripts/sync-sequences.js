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
