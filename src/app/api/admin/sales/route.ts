import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth-security";

// GET /api/admin/sales: List all sales invoices
export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminSession(request);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.toLowerCase().trim() || "";
    const paymentType = searchParams.get("paymentType") || "ALL";

    let whereClause: any = {};

    if (paymentType === "CASH") {
      whereClause.paymentType = "Cash";
    } else if (paymentType === "CREDIT") {
      whereClause.paymentType = "Credit";
    }

    const invoices = await prisma.salesInvoice.findMany({
      where: whereClause,
      include: {
        customer: {
          select: {
            id: true,
            shopName: true,
            phoneNumber: true,
            city: true,
            gstPanNo: true,
          },
        },
      },
      orderBy: {
        invoiceDate: "desc",
      },
    });

    // Client-side search filter
    const filtered = invoices.filter((inv) => {
      if (!search) return true;
      const invNum = inv.invoiceNumber?.toLowerCase() || "";
      const ordNum = inv.orderNumber?.toLowerCase() || "";
      const custName = inv.customerName?.toLowerCase() || "";
      const phone = inv.customerPhone?.toLowerCase() || "";
      const gst = inv.customerGstPan?.toLowerCase() || "";
      return (
        invNum.includes(search) ||
        ordNum.includes(search) ||
        custName.includes(search) ||
        phone.includes(search) ||
        gst.includes(search)
      );
    });

    let totalRevenue = 0;
    let cashSalesRevenue = 0;
    let creditSalesRevenue = 0;
    let totalPcs = 0;
    let totalSets = 0;

    filtered.forEach((inv) => {
      totalRevenue += inv.grandTotal;
      if (inv.paymentType === "Cash") {
        cashSalesRevenue += inv.grandTotal;
      } else {
        creditSalesRevenue += inv.grandTotal;
      }
      totalPcs += inv.totalPcs || 0;
      totalSets += inv.totalSets || 0;
    });

    return NextResponse.json({
      invoices: filtered,
      summary: {
        totalInvoices: filtered.length,
        totalRevenue,
        cashSalesRevenue,
        creditSalesRevenue,
        totalPcs,
        totalSets,
      },
    });
  } catch (error: any) {
    console.error("Error fetching sales invoices:", error);
    return NextResponse.json(
      { error: "Failed to fetch sales invoices: " + error.message },
      { status: 500 }
    );
  }
}

// POST /api/admin/sales: Create a new Sales Invoice (Cash or Credit)
export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminSession(request);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      customerId,
      customerName,
      customerPhone,
      customerGstPan,
      customerAddress,
      businessType,
      invoiceDate,
      paymentType = "Cash",
      creditDays = 0,
      items = [],
      subtotal = 0,
      gstRate = 5.0,
      notes,
    } = body;

    const trimmedCustName = (customerName || "").trim();
    if (!trimmedCustName) {
      return NextResponse.json(
        { error: "Customer or firm name is required." },
        { status: 400 }
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "At least one product item is required for the sales invoice." },
        { status: 400 }
      );
    }

    let calculatedSubtotal = 0;
    let totalSets = 0;
    let totalPcs = 0;

    const formattedItems = items.map((it: any) => {
      const sets = Number(it.totalSets) || 0;
      const pcs = Number(it.totalPcs) || sets * (Number(it.pcsPerSet) || 5);
      const unitPrice = Number(it.unitPrice) || 0;
      const lineSub = Number(it.itemSubtotal) || pcs * unitPrice;
      calculatedSubtotal += lineSub;
      totalSets += sets;
      totalPcs += pcs;

      return {
        productId: it.productId ? Number(it.productId) : undefined,
        productName: it.productName || "Garment Product",
        color: it.color || "",
        sizeRatio: it.sizeRatio || "30 to 38",
        sizesList: it.sizesList || "30, 32, 34, 36, 38",
        pcsPerSet: Number(it.pcsPerSet) || 5,
        totalSets: sets,
        totalPcs: pcs,
        unitPrice,
        itemSubtotal: lineSub,
      };
    });

    const effectiveSubtotal = subtotal > 0 ? Number(subtotal) : calculatedSubtotal;
    const effectiveGstRate = Number(gstRate) || 0;
    const gstAmount = Math.round(effectiveSubtotal * (effectiveGstRate / 100) * 100) / 100;
    const grandTotal = Math.round(effectiveSubtotal + gstAmount);

    // Generate unique serial invoice number: CS-YYMMDD-XXX for cash, INV-YYMMDD-XXX for credit
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const datePrefix = `${yy}${mm}${dd}`;

    const countToday = await prisma.salesInvoice.count({
      where: {
        createdAt: {
          gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
        },
      },
    });

    const seq = String(countToday + 1).padStart(3, "0");
    const prefix = paymentType === "Cash" ? "CS" : "INV";
    const invoiceNumber = `${prefix}-${datePrefix}-${seq}`;

    const isCash = paymentType === "Cash";
    const parsedCustomerId = customerId ? parseInt(customerId, 10) : null;

    // Use transaction to create invoice and record cash payment if customer is linked
    const result = await prisma.$transaction(async (tx) => {
      const invoice = await tx.salesInvoice.create({
        data: {
          invoiceNumber,
          customerId: parsedCustomerId,
          customerName: trimmedCustName,
          customerPhone: customerPhone?.trim() || null,
          customerGstPan: customerGstPan?.trim() || null,
          customerAddress: customerAddress?.trim() || null,
          businessType: businessType || (isCash ? "CASH" : "RETAILER"),
          invoiceDate: invoiceDate ? new Date(invoiceDate) : new Date(),
          paymentType,
          paymentStatus: isCash ? "Paid" : "Unpaid",
          subtotal: effectiveSubtotal,
          gstRate: effectiveGstRate,
          gstAmount,
          grandTotal,
          paidAmount: isCash ? grandTotal : 0,
          balanceAmount: isCash ? 0 : grandTotal,
          totalSets,
          totalPcs,
          items: JSON.stringify(formattedItems),
          creditDays: isCash ? 0 : Number(creditDays) || 0,
          notes: notes?.trim() || null,
          placedBy: admin.username,
        },
      });

      // If it's a cash sale with a linked customer, record in Payment ledger
      if (isCash && parsedCustomerId) {
        await tx.payment.create({
          data: {
            customerId: parsedCustomerId,
            customerName: trimmedCustName,
            amount: grandTotal,
            paymentDate: invoiceDate ? new Date(invoiceDate) : new Date(),
            paymentMode: "Cash",
            referenceNo: invoiceNumber,
            notes: `Cash Sale Invoice ${invoiceNumber}`,
          },
        });
      }

      return invoice;
    });

    return NextResponse.json({
      success: true,
      invoice: result,
      message: `Sales Invoice ${result.invoiceNumber} registered successfully!`,
    }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating sales invoice:", error);
    return NextResponse.json(
      { error: "Failed to create sales invoice: " + error.message },
      { status: 500 }
    );
  }
}
