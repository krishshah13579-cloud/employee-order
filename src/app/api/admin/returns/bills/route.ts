import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth-security";

// GET /api/admin/returns/bills: Fetch all billed invoices categorized into the 4 customer return categories
export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminSession(request);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const categoryFilter = searchParams.get("category"); // WITH_GST | WITHOUT_GST | SPL_DISC_WITH_GST | SPL_DISC_WITHOUT_GST
    const search = searchParams.get("search")?.toLowerCase().trim();

    // Fetch all confirmed/delivered orders or billed orders
    const orders = await prisma.order.findMany({
      where: {
        status: {
          notIn: ["Cancelled", "Draft"],
        },
      },
      include: {
        customer: {
          select: {
            id: true,
            shopName: true,
            gstPanNo: true,
            businessType: true,
            specialDiscount: true,
            city: true,
            phoneNumber: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                category: true,
                sizesRatio: true,
                retailerPrice: true,
                wholesalerPrice: true,
                price: true,
                pcsPerSet: true,
              },
            },
          },
        },
      },
      orderBy: {
        orderDate: "desc",
      },
    });

    const billsList = orders.map((ord) => {
      const customer = ord.customer;
      const custTypeUpper = (customer?.businessType || ord.businessType || "RETAILER").toUpperCase();
      const isWholesaler = custTypeUpper.includes("WHOLESAL");

      // Check Without GST vs With GST
      const isWithoutGst = Boolean(
        ord.isPreviousBill ||
        (ord.notes && ord.notes.includes("[BILL_WITHOUT_GST")) ||
        ord.gstRate === 0 ||
        ord.gstAmount === 0 ||
        custTypeUpper.includes("WITHOUT GST") ||
        custTypeUpper.includes("NO GST")
      );
      const isWithGst = !isWithoutGst;

      // Special Discount
      const specialDiscount = Math.max(0, Number(customer?.specialDiscount) || 0);
      const hasSpecialDiscount =
        specialDiscount > 0 ||
        custTypeUpper.includes("SPECIAL DISCOUNT");

      // Categorize into the 4 requested categories
      let category: "WITH_GST" | "WITHOUT_GST" | "SPL_DISC_WITH_GST" | "SPL_DISC_WITHOUT_GST";
      if (isWithGst) {
        category = hasSpecialDiscount ? "SPL_DISC_WITH_GST" : "WITH_GST";
      } else {
        category = hasSpecialDiscount ? "SPL_DISC_WITHOUT_GST" : "WITHOUT_GST";
      }

      // Display Bill / Invoice Number
      const billNoMatch = ord.notes?.match(/\[BILL_WITHOUT_GST:\s*([^\]]+)\]/i);
      const bookNoMatch = ord.notes?.match(/\[HANDWRITTEN_BOOK_NO:\s*([^\]]+)\]/i);
      const displayBillNo = bookNoMatch
        ? bookNoMatch[1].trim()
        : billNoMatch
        ? billNoMatch[1].trim()
        : ord.taxInvoiceNumber || ord.orderNumber;

      // Expand items and colors
      const expandedItems: Array<{
        productId: number;
        productName: string;
        color: string;
        sizeRatio: string;
        pcsPerSet: number;
        sets: number;
        totalPcs: number;
        unitPrice: number;
        amount: number;
      }> = [];

      ord.items.forEach((item) => {
        const prod = item.product;
        const pcsPerSet = item.pcsPerSet || prod?.pcsPerSet || 5;

        // Calculate locked tier unit price
        let lockedUnitPrice = item.unitPrice;
        if (!lockedUnitPrice || lockedUnitPrice <= 0) {
          const basePrice = isWholesaler
            ? (prod?.wholesalerPrice || prod?.price || 490)
            : (prod?.retailerPrice || prod?.price || 490);
          lockedUnitPrice = hasSpecialDiscount
            ? Math.max(0, basePrice - specialDiscount)
            : basePrice;
        }

        // Parse colorSets
        let parsedColors: Array<{ color: string; sets: number; pcs?: number }> = [];
        try {
          if (item.colorSets) {
            parsedColors = JSON.parse(item.colorSets);
          }
        } catch {
          parsedColors = [];
        }

        if (Array.isArray(parsedColors) && parsedColors.length > 0) {
          parsedColors.forEach((c) => {
            const sets = Number(c.sets) || 0;
            const pcs = Number(c.pcs) || (sets * pcsPerSet);
            if (pcs > 0 || sets > 0) {
              expandedItems.push({
                productId: item.productId,
                productName: item.productName || prod?.name || "Trouser",
                color: c.color || "Default",
                sizeRatio: item.sizeRatio || prod?.sizesRatio || "30 to 38",
                pcsPerSet,
                sets,
                totalPcs: pcs,
                unitPrice: lockedUnitPrice,
                amount: Math.round(pcs * lockedUnitPrice),
              });
            }
          });
        } else {
          // Single row fallback
          expandedItems.push({
            productId: item.productId,
            productName: item.productName || prod?.name || "Trouser",
            color: "Standard",
            sizeRatio: item.sizeRatio || prod?.sizesRatio || "30 to 38",
            pcsPerSet,
            sets: item.totalSets,
            totalPcs: item.totalPcs,
            unitPrice: lockedUnitPrice,
            amount: item.itemSubtotal || Math.round(item.totalPcs * lockedUnitPrice),
          });
        }
      });

      const subtotal = expandedItems.reduce((sum, it) => sum + it.amount, 0) || ord.subtotal;
      const gstRate = isWithGst ? (ord.gstRate || 5) : 0;
      const gstAmount = isWithGst ? Math.round(subtotal * (gstRate / 100)) : 0;
      const grandTotal = subtotal + gstAmount;
      const totalSets = expandedItems.reduce((sum, it) => sum + it.sets, 0) || ord.totalSets;
      const totalPcs = expandedItems.reduce((sum, it) => sum + it.totalPcs, 0) || ord.totalPcs;

      return {
        id: ord.id,
        orderNumber: ord.orderNumber,
        taxInvoiceNumber: ord.taxInvoiceNumber,
        displayBillNo,
        invoiceDate: ord.taxInvoiceDate || ord.orderDate,
        orderDate: ord.orderDate,
        status: ord.status,
        category,
        isWithGst,
        isWithoutGst,
        hasSpecialDiscount,
        specialDiscount,
        customer: {
          id: customer?.id || ord.customerId,
          shopName: customer?.shopName || ord.customerName,
          gstPanNo: customer?.gstPanNo || ord.customerGstPan,
          businessType: custTypeUpper,
          isWholesaler,
          city: customer?.city || "—",
          phoneNumber: customer?.phoneNumber || ord.customerPhone,
        },
        items: expandedItems,
        subtotal,
        gstRate,
        gstAmount,
        grandTotal,
        totalSets,
        totalPcs,
      };
    });

    // Counts for tabs
    const counts = {
      WITH_GST: billsList.filter((b) => b.category === "WITH_GST").length,
      WITHOUT_GST: billsList.filter((b) => b.category === "WITHOUT_GST").length,
      SPL_DISC_WITH_GST: billsList.filter((b) => b.category === "SPL_DISC_WITH_GST").length,
      SPL_DISC_WITHOUT_GST: billsList.filter((b) => b.category === "SPL_DISC_WITHOUT_GST").length,
      ALL: billsList.length,
    };

    // Filter by category if requested
    let filtered = billsList;
    if (categoryFilter && categoryFilter !== "ALL") {
      filtered = filtered.filter((b) => b.category === categoryFilter);
    }

    // Filter by search
    if (search) {
      filtered = filtered.filter(
        (b) =>
          b.displayBillNo.toLowerCase().includes(search) ||
          b.orderNumber.toLowerCase().includes(search) ||
          (b.taxInvoiceNumber && b.taxInvoiceNumber.toLowerCase().includes(search)) ||
          b.customer.shopName.toLowerCase().includes(search) ||
          b.customer.city.toLowerCase().includes(search) ||
          (b.customer.phoneNumber && b.customer.phoneNumber.includes(search)) ||
          (b.customer.gstPanNo && b.customer.gstPanNo.toLowerCase().includes(search))
      );
    }

    return NextResponse.json({
      counts,
      bills: filtered,
    });
  } catch (error: any) {
    console.error("Error fetching return bills:", error);
    return NextResponse.json(
      { error: "Failed to fetch return bills: " + error.message },
      { status: 500 }
    );
  }
}
