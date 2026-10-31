import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function parseSequenceNumber(dNo: string): number {
  const match = dNo.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

function normalizeVendorName(name?: string | null): string {
  if (!name) return "";
  const trimmed = name.trim();
  const upper = trimmed.toUpperCase().replace(/\s+/g, " ");

  if (
    upper === "M. NIKHIL KUMAR" ||
    upper === "M NIKHIL KUMAR" ||
    upper === "M.NIKHIL KUMAR" ||
    upper === "M. NIKHIL KUMAR & CO." ||
    upper === "M. NIKHIL KUMAR & CO" ||
    upper === "M NIKHIL KUMAR & CO." ||
    upper === "M NIKHIL KUMAR & CO"
  ) {
    return "M. NIKHIL KUMAR & CO.";
  }

  if (upper === "MANAN FABRIC" || upper === "MANAN FABRICS") {
    return "MANAN FABRICS";
  }

  return trimmed;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const designNo = searchParams.get("designNo");

    if (designNo) {
      const entry = await prisma.productCosting.findUnique({
        where: { designNo: designNo.trim() },
      });
      return NextResponse.json({ success: true, costing: entry });
    }

    const [costingsRaw, products] = await Promise.all([
      prisma.productCosting.findMany(),
      prisma.product.findMany({
        select: { id: true, name: true, costPrice: true, price: true, mrp: true, setsColorwise: true, isActive: true },
        orderBy: { name: "asc" },
      }),
    ]);

    // Sort costings strictly in ascending numerical sequence: IMP - 001, IMP - 002, IMP - 003...
    const costings = [...costingsRaw].sort((a, b) => {
      const seqA = parseSequenceNumber(a.designNo);
      const seqB = parseSequenceNumber(b.designNo);
      if (seqA !== seqB) return seqA - seqB;
      return a.designNo.localeCompare(b.designNo);
    });

    // Detect duplicate/repeating sequences
    const seenSequences = new Map<number, typeof costings>();
    const duplicateIds: number[] = [];
    costings.forEach((c) => {
      const num = parseSequenceNumber(c.designNo);
      if (num > 0) {
        if (seenSequences.has(num)) {
          duplicateIds.push(c.id);
        } else {
          seenSequences.set(num, [c]);
        }
      }
    });

    // Detect missing sequence in the middle (ignore GR records from blocking sequence)
    const existingSeqNumbers = new Set<number>();
    costings.forEach((c) => {
      const num = parseSequenceNumber(c.designNo);
      if (num > 0) existingSeqNumbers.add(num);
    });

    let missingSequence: string | null = null;
    let nextSequenceNumber = 1;

    if (existingSeqNumbers.size > 0) {
      const maxSeq = Math.max(...Array.from(existingSeqNumbers));
      for (let i = 1; i < maxSeq; i++) {
        if (!existingSeqNumbers.has(i)) {
          missingSequence = `IMP - ${String(i).padStart(3, "0")}`;
          break;
        }
      }
      nextSequenceNumber = missingSequence ? parseSequenceNumber(missingSequence) : maxSeq + 1;
    }

    const suggestedNextDesignNo = missingSequence || `IMP - ${String(nextSequenceNumber).padStart(3, "0")}`;

    // Extract unique vendors for the dropdown menu with normalization & deduplication
    const vendorSet = new Set<string>();
    costings.forEach((c) => {
      const normalized = normalizeVendorName(c.purchasedFrom);
      if (normalized) {
        vendorSet.add(normalized);
      }
    });
    const vendors = Array.from(vendorSet).sort();

    // Yearly statistics for the emerald banner matching screenshot
    const currentYear = new Date().getFullYear();
    const yearlyCostings = costings.filter((c) => {
      const yr = new Date(c.createdAt).getFullYear();
      return yr === currentYear;
    });
    const totalDesignsYearly = yearlyCostings.length > 0 ? yearlyCostings.length : costings.length;
    const grCountYearly = costings.filter((c) => c.isGR).length;

    // Check whole designs sold (designs where all inventory has been sold out)
    let soldWholeDesignsYearly = 0;
    products.forEach((p) => {
      try {
        if (!p.setsColorwise || p.setsColorwise.trim() === "" || p.setsColorwise === "{}") {
          soldWholeDesignsYearly++;
        } else {
          const parsed = JSON.parse(p.setsColorwise);
          let totalSets = 0;
          for (const col of Object.values(parsed)) {
            const ratios = (col as any)?.ratios || {};
            for (const cnt of Object.values(ratios)) {
              totalSets += Number(cnt) || 0;
            }
          }
          if (totalSets === 0) soldWholeDesignsYearly++;
        }
      } catch {}
    });

    return NextResponse.json({
      success: true,
      costings,
      products,
      vendors,
      missingSequence,
      suggestedNextDesignNo,
      duplicateCount: duplicateIds.length,
      yearlyMetrics: {
        currentYear,
        totalDesignsYearly,
        soldWholeDesignsYearly,
        grCountYearly,
        activeDesignsCount: costings.filter((c) => !c.isGR).length,
      },
    });
  } catch (error: any) {
    console.error("GET /api/admin/costing error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load costing records" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      designNo,
      fabricName,
      purchasedFrom,
      isJobwork = false,
      isGR = false,
      rateMode = "PER_METER",
      fabricRate = 0,
      mtrPerKg = null,
      avgFabricPerPiece = 0,
      jobworkCost = 0,
      otherCost = 0,
      pressCost = 0,
      margin = 0,
      arrivalDate,
      totalMeters,
      totalPcs,
      itemsUsed,
      itemCostPerPiece,
      notes = "",
    } = body;

    const cleanDesignNo = (designNo || "").trim();
    const cleanFabricName = (fabricName || "").trim();
    const cleanPurchasedFrom = normalizeVendorName(purchasedFrom);
    const isGRMode = Boolean(isGR);

    if (!cleanDesignNo) {
      return NextResponse.json(
        { success: false, error: "Design Number (D.No.) is required" },
        { status: 400 }
      );
    }

    if (!cleanFabricName) {
      return NextResponse.json(
        { success: false, error: "Fabric Name is required" },
        { status: 400 }
      );
    }

    const currentSeq = parseSequenceNumber(cleanDesignNo);

    // Sequence Check: If adding a brand new design (not updating existing), check if any prior sequence is missing
    const existingEntry = await prisma.productCosting.findUnique({
      where: { designNo: cleanDesignNo },
    });

    if (!existingEntry && currentSeq > 1) {
      // Fetch all existing sequences
      const allCostings = await prisma.productCosting.findMany({
        select: { designNo: true },
      });
      const existingSeqs = new Set<number>();
      allCostings.forEach((c) => {
        const num = parseSequenceNumber(c.designNo);
        if (num > 0) existingSeqs.add(num);
      });

      for (let i = 1; i < currentSeq; i++) {
        if (!existingSeqs.has(i)) {
          const missingDNo = `IMP - ${String(i).padStart(3, "0")}`;
          return NextResponse.json(
            {
              success: false,
              missingSequence: missingDNo,
              error: `Middle sequence missing! Sequence "${missingDNo}" must be added first before adding "${cleanDesignNo}".`,
            },
            { status: 400 }
          );
        }
      }
    }

    const isJobworkMode = Boolean(isJobwork);

    // If NOT jobwork mode, all costing fields are mandatory
    if (!isJobworkMode) {
      if (!fabricRate || parseFloat(fabricRate) <= 0) {
        return NextResponse.json(
          { success: false, error: "Fabric Rate is mandatory when Jobwork is NO" },
          { status: 400 }
        );
      }
      if (!avgFabricPerPiece || parseFloat(avgFabricPerPiece) <= 0) {
        return NextResponse.json(
          { success: false, error: "Avg Fabric per Piece is mandatory when Jobwork is NO" },
          { status: 400 }
        );
      }
    }

    const numFabricRate = Math.max(0, parseFloat(fabricRate) || 0);
    const numMtrPerKg = mtrPerKg ? Math.max(0, parseFloat(mtrPerKg) || 0) : null;
    const numAvgFabric = Math.max(0, parseFloat(avgFabricPerPiece) || 0);
    const numJobwork = Math.max(0, parseFloat(jobworkCost) || 0);
    const numOther = Math.max(0, parseFloat(otherCost) || 0);
    const numPress = Math.max(0, parseFloat(pressCost) || 0);
    const numMargin = Math.max(0, parseFloat(margin) || 0);

    // All values strictly ROUNDED OFF
    let calculatedRatePerMtr = numFabricRate;
    if (rateMode === "PER_KG") {
      calculatedRatePerMtr =
        numMtrPerKg && numMtrPerKg > 0 ? numFabricRate / numMtrPerKg : 0;
    }
    calculatedRatePerMtr = Math.round(calculatedRatePerMtr);

    // Fabric Cost = Avg Fabric * Rate Per Meter (Round Off)
    const fabricCost = Math.round(numAvgFabric * calculatedRatePerMtr);

    // Total Costing = Fabric + Jobwork + Other + Press (Round Off)
    const totalCosting = Math.round(fabricCost + numJobwork + numOther + numPress);

    // Price = Total Costing + Margin (Round Off)
    const sellingPrice = Math.round(totalCosting + numMargin);

    // MRP = (Price * 2) - 1 (Strict Round Off: e.g. 1400 -> 1399, 1450 -> 1449)
    const rawMrp = Math.round(sellingPrice * 2);
    const mrp = rawMrp > 0 ? Math.max(0, rawMrp - 1) : 0;

    // Retailer Price = Selling Price (or Math.round(mrp / 2))
    const retailerPrice = sellingPrice;

    // Wholesaler Price = Retailer Price - 100 (Round Off)
    const wholesalerPrice = Math.max(0, retailerPrice - 100);

    const numTotalMeters = Math.max(0, parseFloat(totalMeters) || 0);
    const numTotalPcs = totalPcs !== undefined && totalPcs !== null
      ? Math.max(0, parseInt(String(totalPcs), 10) || 0)
      : (numTotalMeters > 0 && numAvgFabric > 0 ? Math.round(numTotalMeters * numAvgFabric) : 0);

    const numItemCostPerPiece = Math.max(0, parseFloat(itemCostPerPiece) || 0);
    const parsedArrivalDate = arrivalDate ? new Date(arrivalDate) : new Date();

    // Serialize itemsUsed
    let itemsUsedList: any[] = [];
    if (Array.isArray(itemsUsed)) {
      itemsUsedList = itemsUsed;
    } else if (typeof itemsUsed === "string" && itemsUsed.trim()) {
      try {
        itemsUsedList = JSON.parse(itemsUsed);
      } catch {}
    }
    const itemsUsedJson = itemsUsedList.length > 0 ? JSON.stringify(itemsUsedList) : null;

    // Upsert into ProductCosting
    const savedCosting = await prisma.productCosting.upsert({
      where: { designNo: cleanDesignNo },
      update: {
        fabricName: cleanFabricName,
        purchasedFrom: cleanPurchasedFrom,
        isJobwork: isJobworkMode,
        isGR: isGRMode,
        rateMode,
        fabricRate: Math.round(numFabricRate),
        mtrPerKg: numMtrPerKg ? Math.round(numMtrPerKg * 100) / 100 : null,
        ratePerMeter: calculatedRatePerMtr,
        avgFabricPerPiece: Math.round(numAvgFabric * 100) / 100,
        fabricCost,
        jobworkCost: Math.round(numJobwork),
        otherCost: Math.round(numOther),
        pressCost: Math.round(numPress),
        totalCosting,
        margin: Math.round(numMargin),
        sellingPrice,
        mrp,
        arrivalDate: parsedArrivalDate,
        totalMeters: numTotalMeters,
        totalPcs: numTotalPcs,
        itemsUsed: itemsUsedJson,
        itemCostPerPiece: numItemCostPerPiece,
        notes: (notes || "").trim(),
      },
      create: {
        designNo: cleanDesignNo,
        fabricName: cleanFabricName,
        purchasedFrom: cleanPurchasedFrom,
        isJobwork: isJobworkMode,
        isGR: isGRMode,
        rateMode,
        fabricRate: Math.round(numFabricRate),
        mtrPerKg: numMtrPerKg ? Math.round(numMtrPerKg * 100) / 100 : null,
        ratePerMeter: calculatedRatePerMtr,
        avgFabricPerPiece: Math.round(numAvgFabric * 100) / 100,
        fabricCost,
        jobworkCost: Math.round(numJobwork),
        otherCost: Math.round(numOther),
        pressCost: Math.round(numPress),
        totalCosting,
        margin: Math.round(numMargin),
        sellingPrice,
        mrp,
        arrivalDate: parsedArrivalDate,
        totalMeters: numTotalMeters,
        totalPcs: numTotalPcs,
        itemsUsed: itemsUsedJson,
        itemCostPerPiece: numItemCostPerPiece,
        notes: (notes || "").trim(),
      },
    });

    // Deduct stock for items used in this costing
    try {
      for (const item of itemsUsedList) {
        const qtyUsed = Math.max(0, parseInt(String(item.quantityUsed || item.qty), 10) || 0);
        if (qtyUsed <= 0) continue;

        if (item.itemId) {
          const accId = parseInt(String(item.itemId), 10);
          const existingAcc = await prisma.accessoryItem.findUnique({ where: { id: accId } });
          if (existingAcc) {
            const updatedQty = Math.max(0, existingAcc.quantity - qtyUsed);
            await prisma.accessoryItem.update({
              where: { id: accId },
              data: { quantity: updatedQty },
            });
          }
        } else if (item.isNewItem && item.name) {
          // If added on-the-fly, create and set remaining stock
          const initialStock = Math.max(0, parseInt(String(item.initialStock), 10) || 0);
          const remaining = Math.max(0, initialStock - qtyUsed);
          await prisma.accessoryItem.create({
            data: {
              name: String(item.name).trim(),
              category: String(item.category || "Other").trim(),
              quantity: remaining,
              unit: String(item.unit || "Pcs").trim(),
              costPerUnit: Math.max(0, parseFloat(String(item.costPerUnit)) || 0),
              imageUrl: item.imageUrl ? String(item.imageUrl).trim() : null,
            },
          });
        }
      }
    } catch (err) {
      console.error("Error deducting accessory stock for costing items used:", err);
    }

    // Automatically sync costing, selling price, and MRP with Product & Stock
    const matchingProducts = await prisma.product.findMany({
      where: {
        name: {
          equals: cleanDesignNo,
          mode: "insensitive",
        },
      },
    });

    if (matchingProducts.length > 0) {
      await prisma.product.updateMany({
        where: {
          name: {
            equals: cleanDesignNo,
            mode: "insensitive",
          },
        },
        data: {
          costPrice: totalCosting,
          price: sellingPrice,
          mrp,
          retailerPrice,
          wholesalerPrice,
          isActive: isGRMode ? false : undefined, // If GR, deactivate product immediately
        },
      });
    }

    return NextResponse.json({
      success: true,
      costing: savedCosting,
      syncedProductsCount: matchingProducts.length,
      message: `Costing saved for D.No. "${cleanDesignNo}"! Total Costing: ₹${totalCosting}, MRP: ₹${mrp} (Round Off - 1).`,
    });
  } catch (error: any) {
    console.error("POST /api/admin/costing error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to save costing" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, isGR } = body;
    const costingId = parseInt(id, 10);
    if (!costingId) {
      return NextResponse.json(
        { success: false, error: "Costing ID is required" },
        { status: 400 }
      );
    }

    const updated = await prisma.productCosting.update({
      where: { id: costingId },
      data: { isGR: Boolean(isGR) },
    });

    // If marked as GR, also deactivate matching product in catalog
    if (isGR) {
      await prisma.product.updateMany({
        where: {
          name: {
            equals: updated.designNo,
            mode: "insensitive",
          },
        },
        data: { isActive: false },
      });
    }

    return NextResponse.json({
      success: true,
      costing: updated,
      message: `Design "${updated.designNo}" ${isGR ? "marked as Goods Return (GR)" : "unmarked from Goods Return"}.`,
    });
  } catch (error: any) {
    console.error("PATCH /api/admin/costing error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update costing status" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = parseInt(searchParams.get("id") || "0", 10);
    const designNo = searchParams.get("designNo");

    if (!id && !designNo) {
      return NextResponse.json(
        { success: false, error: "ID or designNo is required to delete costing" },
        { status: 400 }
      );
    }

    if (id) {
      await prisma.productCosting.delete({ where: { id } });
    } else if (designNo) {
      await prisma.productCosting.delete({ where: { designNo: designNo.trim() } });
    }

    return NextResponse.json({
      success: true,
      message: `Deleted costing record successfully`,
    });
  } catch (error: any) {
    console.error("DELETE /api/admin/costing error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete costing" },
      { status: 500 }
    );
  }
}
