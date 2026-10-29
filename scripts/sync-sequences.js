const { PrismaClient } = require("@prisma/client");

async function main() {
  const prisma = new PrismaClient();
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
    console.warn("⚠️ [POSTGRES] Sequence sync warning:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
