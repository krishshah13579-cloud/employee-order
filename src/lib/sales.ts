import prisma from "@/lib/prisma";

export interface InvoiceItemPayload {
  productId?: number;
  productName: string;
  color?: string;
  sizeRatio?: string;
  sizesList?: string;
  pcsPerSet?: number;
  totalSets: number;
  totalPcs: number;
  unitPrice: number;
  itemSubtotal: number;
  colorSets?: any;
}

/**
 * Creates or updates a SalesInvoice record whenever an Order is Confirmed
 */
export async function createOrUpdateSalesInvoiceFromOrder(orderId: number) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        items: true,
      },
    });

    if (!order) return null;

    // Only process orders with Confirmed, In Production, Ready, Dispatched, Delivered status
    const confirmedStatuses = ["Confirmed", "In Production", "Ready", "Dispatched", "Delivered"];
    if (!confirmedStatuses.includes(order.status)) {
      // Never delete sales invoices from Sales Register even if order is cancelled
      return null;
    }

    // Extract invoice items
    let items: InvoiceItemPayload[] = [];
    let subtotal = 0;
    let totalSets = 0;
    let totalPcs = 0;

    if (order.taxInvoiceItems) {
      try {
        const parsed = JSON.parse(order.taxInvoiceItems);
        if (Array.isArray(parsed) && parsed.length > 0) {
          items = parsed.map((it: any) => {
            const sets = Number(it.totalSets) || 0;
            const pcs = Number(it.totalPcs) || sets * (Number(it.pcsPerSet) || 5);
            const lineSub = Number(it.itemSubtotal) || pcs * (Number(it.unitPrice) || 0);
            subtotal += lineSub;
            totalSets += sets;
            totalPcs += pcs;
            return {
              productId: it.productId,
              productName: it.productName || "Product",
              color: it.color || "",
              sizeRatio: it.sizeRatio || "30 to 38",
              sizesList: it.sizesList || "30, 32, 34, 36, 38",
              pcsPerSet: Number(it.pcsPerSet) || 5,
              totalSets: sets,
              totalPcs: pcs,
              unitPrice: Number(it.unitPrice) || 0,
              itemSubtotal: lineSub,
            };
          });
        }
      } catch (e) {
        console.error("Error parsing taxInvoiceItems for sales invoice:", e);
      }
    }

    if (items.length === 0 && order.items && order.items.length > 0) {
      items = order.items.map((it) => {
        const sets = it.totalSets || 0;
        const pcs = it.totalPcs || sets * (it.pcsPerSet || 5);
        const lineSub = it.itemSubtotal || pcs * it.unitPrice;
        subtotal += lineSub;
        totalSets += sets;
        totalPcs += pcs;
        return {
          productId: it.productId,
          productName: it.productName,
          sizeRatio: it.sizeRatio,
          sizesList: it.sizesList,
          pcsPerSet: it.pcsPerSet,
          totalSets: sets,
          totalPcs: pcs,
          unitPrice: it.unitPrice,
          itemSubtotal: lineSub,
          colorSets: it.colorSets,
        };
      });
    }

    if (subtotal === 0) {
      subtotal = order.subtotal || order.grandTotal;
      totalSets = order.totalSets || 0;
      totalPcs = order.totalPcs || 0;
    }

    const gstRate = order.gstRate ?? 5.0;
    const gstAmount = Math.round(subtotal * (gstRate / 100) * 100) / 100;
    const grandTotal = Math.round(subtotal + gstAmount);

    // Determine invoice number
    const existing = await prisma.salesInvoice.findFirst({
      where: { orderId: order.id },
    });

    const invoiceNumber =
      order.taxInvoiceNumber ||
      existing?.invoiceNumber ||
      `INV-${order.orderNumber.replace(/^GO-/, "")}`;

    const invoiceDate = order.taxInvoiceDate || order.orderDate || new Date();

    if (existing) {
      return await prisma.salesInvoice.update({
        where: { id: existing.id },
        data: {
          invoiceNumber,
          customerName: order.customerName,
          customerPhone: order.customerPhone || order.customer?.phoneNumber,
          customerGstPan: order.customerGstPan || order.customer?.gstPanNo,
          customerAddress: order.customerAddress || order.customer?.address,
          businessType: order.businessType || order.customer?.businessType || "RETAILER",
          invoiceDate,
          subtotal,
          gstRate,
          gstAmount,
          grandTotal,
          balanceAmount: Math.max(0, grandTotal - (existing.paidAmount || 0)),
          totalSets,
          totalPcs,
          items: JSON.stringify(items),
          creditDays: order.creditDays ?? order.customer?.creditDays ?? 0,
          notes: order.notes,
          placedBy: order.placedBy,
        },
      });
    } else {
      return await prisma.salesInvoice.create({
        data: {
          invoiceNumber,
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerId: order.customerId,
          customerName: order.customerName,
          customerPhone: order.customerPhone || order.customer?.phoneNumber,
          customerGstPan: order.customerGstPan || order.customer?.gstPanNo,
          customerAddress: order.customerAddress || order.customer?.address,
          businessType: order.businessType || order.customer?.businessType || "RETAILER",
          invoiceDate,
          paymentType: "Credit",
          paymentStatus: "Unpaid",
          subtotal,
          gstRate,
          gstAmount,
          grandTotal,
          paidAmount: 0,
          balanceAmount: grandTotal,
          totalSets,
          totalPcs,
          items: JSON.stringify(items),
          creditDays: order.creditDays ?? order.customer?.creditDays ?? 0,
          notes: order.notes,
          placedBy: order.placedBy,
        },
      });
    }
  } catch (error: any) {
    console.error(`Failed to sync sales invoice for order #${orderId}:`, error);
    return null;
  }
}

/**
 * Automatically sync all past confirmed orders into Sales Invoices table if not already present
 */
export async function syncExistingConfirmedOrdersToSales() {
  try {
    const confirmedOrders = await prisma.order.findMany({
      where: {
        status: { in: ["Confirmed", "In Production", "Ready", "Dispatched", "Delivered"] },
      },
      select: { id: true },
    });

    for (const ord of confirmedOrders) {
      await createOrUpdateSalesInvoiceFromOrder(ord.id);
    }
  } catch (error: any) {
    console.error("Error in syncExistingConfirmedOrdersToSales:", error);
  }
}
