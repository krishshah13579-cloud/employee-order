import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

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

    const [costings, products] = await Promise.all([
      prisma.productCosting.findMany({
        orderBy: { updatedAt: "desc" },
      }),
      prisma.product.findMany({
        select: { id: true, name: true, costPrice: true, price: true, mrp: true },
        orderBy: { name: "asc" },
      }),
    ]);

    return NextResponse.json({
      success: true,
      costings,
      products,
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
      rateMode = "PER_METER",
      fabricRate = 0,
      mtrPerKg = null,
      avgFabricPerPiece = 0,
      jobworkCost = 0,
      otherCost = 0,
      pressCost = 0,
      margin = 0,
      notes = "",
    } = body;

    const cleanDesignNo = (designNo || "").trim();
    const cleanFabricName = (fabricName || "").trim();

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

    const numFabricRate = Math.max(0, parseFloat(fabricRate) || 0);
    const numMtrPerKg = mtrPerKg ? Math.max(0, parseFloat(mtrPerKg) || 0) : null;
    const numAvgFabric = Math.max(0, parseFloat(avgFabricPerPiece) || 0);
    const numJobwork = Math.max(0, parseFloat(jobworkCost) || 0);
    const numOther = Math.max(0, parseFloat(otherCost) || 0);
    const numPress = Math.max(0, parseFloat(pressCost) || 0);
    const numMargin = Math.max(0, parseFloat(margin) || 0);

    // Rate Per Meter calculation
    let calculatedRatePerMtr = numFabricRate;
    if (rateMode === "PER_KG") {
      calculatedRatePerMtr =
        numMtrPerKg && numMtrPerKg > 0 ? numFabricRate / numMtrPerKg : 0;
    }
    calculatedRatePerMtr = Math.round(calculatedRatePerMtr * 100) / 100;

    // Fabric Cost = Avg Fabric * Rate Per Meter
    const fabricCost = Math.round(numAvgFabric * calculatedRatePerMtr * 100) / 100;

    // Total Costing = Fabric + Jobwork + Other + Press
    const totalCosting =
      Math.round((fabricCost + numJobwork + numOther + numPress) * 100) / 100;

    // Price = Total Costing + Margin
    const sellingPrice = Math.round((totalCosting + numMargin) * 100) / 100;

    // MRP = Price * 2
    const mrp = Math.round(sellingPrice * 2 * 100) / 100;

    // Upsert into ProductCosting
    const savedCosting = await prisma.productCosting.upsert({
      where: { designNo: cleanDesignNo },
      update: {
        fabricName: cleanFabricName,
        purchasedFrom: (purchasedFrom || "").trim(),
        rateMode,
        fabricRate: numFabricRate,
        mtrPerKg: numMtrPerKg,
        ratePerMeter: calculatedRatePerMtr,
        avgFabricPerPiece: numAvgFabric,
        fabricCost,
        jobworkCost: numJobwork,
        otherCost: numOther,
        pressCost: numPress,
        totalCosting,
        margin: numMargin,
        sellingPrice,
        mrp,
        notes: (notes || "").trim(),
      },
      create: {
        designNo: cleanDesignNo,
        fabricName: cleanFabricName,
        purchasedFrom: (purchasedFrom || "").trim(),
        rateMode,
        fabricRate: numFabricRate,
        mtrPerKg: numMtrPerKg,
        ratePerMeter: calculatedRatePerMtr,
        avgFabricPerPiece: numAvgFabric,
        fabricCost,
        jobworkCost: numJobwork,
        otherCost: numOther,
        pressCost: numPress,
        totalCosting,
        margin: numMargin,
        sellingPrice,
        mrp,
        notes: (notes || "").trim(),
      },
    });

    // Automatically sync costing, selling price, and MRP with Product & Stock
    // Look for matching product by exact name or case-insensitive name
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
          retailerPrice: mrp / 2,
          wholesalerPrice: Math.max(0, mrp / 2 - 100),
        },
      });
    }

    return NextResponse.json({
      success: true,
      costing: savedCosting,
      syncedProductsCount: matchingProducts.length,
      message: `Costing saved for D.No. "${cleanDesignNo}"! Total Costing: ₹${totalCosting}, MRP: ₹${mrp}. Synced with ${matchingProducts.length} product(s).`,
    });
  } catch (error: any) {
    console.error("POST /api/admin/costing error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to save costing" },
      { status: 500 }
    );
  }
}
