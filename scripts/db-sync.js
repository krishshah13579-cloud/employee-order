const { execSync } = require("child_process");

const dbUrl = process.env.DATABASE_URL || "";

if (dbUrl.startsWith("postgres://") || dbUrl.startsWith("postgresql://")) {
  console.log("⚡ PostgreSQL cloud database detected: synchronizing schema...");
  try {
    execSync("npx prisma db push --accept-data-loss", { stdio: "inherit" });
    console.log("✅ Database schema synchronized successfully.");
  } catch (err) {
    console.warn("⚠️ Warning: prisma db push warning, continuing build:", err.message);
  }
} else {
  console.log("ℹ️ Local/non-postgres DATABASE_URL detected, skipping cloud push.");
}
