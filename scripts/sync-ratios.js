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

    // Inspect and harmonize setsColorwise
    if (p.setsColorwise && p.setsColorwise.trim().startsWith("{")) {
      try {
        const parsed = JSON.parse(p.setsColorwise);
        let modifiedStock = false;

        for (const [col, val] of Object.entries(parsed)) {
          if (typeof val === "object" && val !== null) {
            const ratios = val.ratios || val;
            const ratioKeys = Object.keys(ratios).filter((k) => k !== "loose" && k !== "loosePcs");

            // Discrepancy detection: e.g. IMP-012 where product.sizesRatio is "28 TO 40" but ratioKeys is ["38 to 40"]
            if (
              ratioKeys.length === 1 &&
              ratioKeys[0].toLowerCase() !== primaryRatio.toLowerCase()
            ) {
              const oldKey = ratioKeys[0];
              const count = ratios[oldKey];
              // Align single ratio entry to product's primary sizesRatio if mismatched
              console.log(
                `🔄 Aligning ${p.name} color [${col}]: migrating ratio from "${oldKey}" to "${primaryRatio}" (${count} sets)`
              );
              delete ratios[oldKey];
              ratios[primaryRatio] = count;
              modifiedStock = true;
            }
          }
        }

        if (modifiedStock) {
          nextSetsColorwise = JSON.stringify(parsed);
          needsUpdate = true;
        }
      } catch (err) {
        console.warn(`Could not parse setsColorwise for product ${p.name}:`, err.message);
      }
    }

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
