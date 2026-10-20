import prisma from "@/lib/prisma";

/**
 * Returns the next sequential Tax Invoice number as a string starting from 1
 * by scanning both Order.taxInvoiceNumber and SalesInvoice.invoiceNumber.
 */
export async function getNextTaxInvoiceNumber(tx?: any): Promise<string> {
  const db = tx || prisma;

  const allOrders = await db.order.findMany({
    select: { taxInvoiceNumber: true },
  });
  const allSalesInvoices = await db.salesInvoice.findMany({
    select: { invoiceNumber: true },
  });

  let maxInvoiceNum = 0;
  for (const ord of allOrders) {
    const raw = (ord.taxInvoiceNumber || "").trim();
    if (/^\d+$/.test(raw)) {
      const val = parseInt(raw, 10);
      if (val > maxInvoiceNum) maxInvoiceNum = val;
    }
  }
  for (const si of allSalesInvoices) {
    const raw = (si.invoiceNumber || "").trim();
    if (/^\d+$/.test(raw)) {
      const val = parseInt(raw, 10);
      if (val > maxInvoiceNum) maxInvoiceNum = val;
    }
  }

  let next = maxInvoiceNum + 1;
  let nextTaxInvoiceNumber = String(next);

  // Ensure uniqueness in both tables
  while (
    (await db.order.findFirst({ where: { taxInvoiceNumber: nextTaxInvoiceNumber } })) ||
    (await db.salesInvoice.findFirst({ where: { invoiceNumber: nextTaxInvoiceNumber } }))
  ) {
    next++;
    nextTaxInvoiceNumber = String(next);
  }

  return nextTaxInvoiceNumber;
}

/**
 * Returns the next sequential Order Form number starting from 1.
 */
export async function getNextOrderNumber(tx?: any): Promise<string> {
  const db = tx || prisma;

  const allOrders = await db.order.findMany({
    select: { orderNumber: true },
  });

  let maxNum = 0;
  for (const ord of allOrders) {
    const raw = (ord.orderNumber || "").trim();
    if (/^\d+$/.test(raw)) {
      const val = parseInt(raw, 10);
      if (val > maxNum) maxNum = val;
    }
  }

  let next = Math.max(maxNum, allOrders.length) + 1;
  if (allOrders.length === 0) next = 1;
  let nextOrderNumber = String(next);
  while (await db.order.findUnique({ where: { orderNumber: nextOrderNumber } })) {
    next++;
    nextOrderNumber = String(next);
  }

  return nextOrderNumber;
}

/**
 * Ensures all existing orders in the system have their sequence number starting from 1
 * in chronological order (createdAt: asc, id: asc).
 * Safely renumbers orders without unique key collisions.
 */
let isSyncingOrders = false;
export async function syncSequentialOrderNumbers(tx?: any): Promise<void> {
  if (isSyncingOrders) return;
  isSyncingOrders = true;
  const db = tx || prisma;
  try {
    const orders = await db.order.findMany({
      select: { id: true, orderNumber: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });

    if (!orders || orders.length === 0) return;

    // Check if renumbering is needed
    let needsRenumbering = false;
    for (let i = 0; i < orders.length; i++) {
      const expected = String(i + 1);
      if (orders[i].orderNumber !== expected) {
        needsRenumbering = true;
        break;
      }
    }

    if (!needsRenumbering) return;

    // Step 1: Temporarily assign unique placeholder numbers to avoid @unique constraint collision
    for (const ord of orders) {
      await db.order.update({
        where: { id: ord.id },
        data: { orderNumber: `__TEMP_ORD_${ord.id}_${Date.now()}__` },
      });
    }

    // Step 2: Assign clean sequential order numbers starting from 1
    for (let i = 0; i < orders.length; i++) {
      const seqStr = String(i + 1);
      await db.order.update({
        where: { id: orders[i].id },
        data: { orderNumber: seqStr },
      });

      // Also update linked SalesInvoice and SalesReturn records if any
      await db.salesInvoice.updateMany({
        where: { orderId: orders[i].id },
        data: { orderNumber: seqStr },
      }).catch(() => {});

      await db.salesReturn.updateMany({
        where: { orderId: orders[i].id },
        data: { orderNumber: seqStr },
      }).catch(() => {});
    }
  } catch (err) {
    console.error("Error syncing sequential order numbers:", err);
  } finally {
    isSyncingOrders = false;
  }
}

