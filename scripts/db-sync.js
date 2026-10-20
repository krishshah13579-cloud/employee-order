const { execSync } = require("child_process");

const dbUrl = process.env.DATABASE_URL || "";

if (dbUrl.startsWith("postgres://") || dbUrl.startsWith("postgresql://") || dbUrl.startsWith("prisma+postgres://")) {
  console.log("⚡ PostgreSQL cloud database detected: synchronizing schema...");
  try {
    execSync("npx prisma db push --accept-data-loss", { stdio: "inherit" });
    console.log("✅ Database schema synchronized successfully.");
  } catch (err) {
    console.warn("⚠️ Warning: prisma db push warning, continuing build:", err.message);
  }

  try {
    console.log("⚡ Synchronizing historical bills 1 to 39 with product names and colors...");
    execSync("node scripts/sync-past-invoices.js", { stdio: "inherit" });
    console.log("✅ Historical bills 1 to 39 synchronized successfully.");
  } catch (err) {
    console.warn("⚠️ Warning: sync-past-invoices warning, continuing build:", err.message);
  }

  try {
    console.log("⚡ Harmonizing product size ratios (2 to 8 sizes) and stock sets across catalog...");
    execSync("node scripts/sync-ratios.js", { stdio: "inherit" });
    console.log("✅ Product size ratios and stock sets harmonized successfully.");
  } catch (err) {
    console.warn("⚠️ Warning: sync-ratios warning, continuing build:", err.message);
  }
} else {
  console.log("ℹ️ Local/non-postgres DATABASE_URL detected, skipping cloud push.");
}
