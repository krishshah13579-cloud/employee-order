import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🧹 Resetting database to completely clean state (no prior entries)...");

  // Delete all entries across all tables to start 100% fresh
  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.customer.deleteMany({});
  await prisma.employee.deleteMany({});
  await prisma.category.deleteMany({});
  await prisma.adminAccount.deleteMany({});
  await prisma.adminProfile.deleteMany({});

  console.log("✅ Database reset complete!");
  console.log("  - Zero pre-existing Admin Accounts (Setup required upon first visit to /admin)");
  console.log("  - Zero pre-existing Employees");
  console.log("  - Zero pre-existing Customers");
  console.log("  - Zero pre-existing Products");
  console.log("  - Zero pre-existing Orders");
}

main()
  .catch((e) => {
    console.error("❌ Reset failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
