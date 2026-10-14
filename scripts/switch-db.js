const fs = require("fs");
const path = require("path");

const targetProvider = process.argv[2];

if (!targetProvider || (targetProvider !== "postgresql" && targetProvider !== "sqlite")) {
  console.error("Usage: node scripts/switch-db.js [postgresql|sqlite]");
  process.exit(1);
}

const schemaPath = path.join(__dirname, "..", "prisma", "schema.prisma");
let content = fs.readFileSync(schemaPath, "utf8");

if (targetProvider === "postgresql") {
  content = content.replace(/provider\s*=\s*"sqlite"/g, 'provider = "postgresql"');
  console.log("✅ Switched Prisma schema to: postgresql (Ready for Vercel / Render / Supabase / Neon)");
} else {
  content = content.replace(/provider\s*=\s*"postgresql"/g, 'provider = "sqlite"');
  console.log("✅ Switched Prisma schema to: sqlite (Ready for local offline dev)");
}

fs.writeFileSync(schemaPath, content, "utf8");
