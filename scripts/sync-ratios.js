const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function getSizesFromRatio(ratio) {
  if (!ratio) return [];
  const clean = ratio.trim().toLowerCase();
  const match = clean.match(/(\d+)\s*(?:to|x|-)\s*(\d+)/i);
  if (match) {
    const start = parseInt(match[1], 10);
    const end = parseInt(match[2], 10);
    if (!isNaN(start) && !isNaN(end) && start <= end && (end - start) <= 30) {
      const sizes = [];
      for (let s = start; s <= end; s += 2) {
        sizes.push(String(s));
      }
      return sizes;
    }
  }
  return [ratio];
}

async function syncProductRatios() {
  console.log("⚡ Starting synchronization of product size ratios and stock sets...");

  const products = await prisma.product.findMany();
  console.log(`📦 Auditing ${products.length} products in catalog...`);

  let updatedCount = 0;

  for (const p of products) {
    let needsUpdate = false;
    let nextSetsColorwise = p.setsColorwise;
    let nextPcsPerSet = p.pcsPerSet;
    let nextSizesList = p.sizesList;

    const primaryRatio = p.sizesRatio ? p.sizesRatio.trim() : "28 to 36";
    const primarySizes = getSizesFromRatio(primaryRatio);
    const expectedPcs = primarySizes.length > 0 && primarySizes[0] !== primaryRatio ? primarySizes.length : (p.pcsPerSet || 5);
    const expectedSizesList = primarySizes.join(", ");

    if (p.pcsPerSet !== expectedPcs) {
      nextPcsPerSet = expectedPcs;
      needsUpdate = true;
    }

    if (!p.sizesList || p.sizesList.trim() === "" || p.sizesList !== expectedSizesList) {
      nextSizesList = expectedSizesList;
      needsUpdate = true;
    }

    // Individual colors can have different ratios (e.g. 2 sizes ratio or 8 sizes ratio).
    // We strictly preserve each color's ratios in setsColorwise as set by the user.

    if (needsUpdate) {
      await prisma.product.update({
        where: { id: p.id },
        data: {
          pcsPerSet: nextPcsPerSet,
          sizesList: nextSizesList,
          setsColorwise: nextSetsColorwise,
        },
      });
      updatedCount++;
      console.log(`✅ Synchronized product: ${p.name} (sizesRatio: "${primaryRatio}", pcsPerSet: ${nextPcsPerSet}, sizes: [${nextSizesList}])`);
    }
  }

  console.log(`🎉 Size ratio synchronization complete. ${updatedCount} products updated.`);
}

syncProductRatios()
  .catch((err) => {
    console.error("❌ Error in syncProductRatios:", err.message);
  })
  .finally(() => prisma.$disconnect());
