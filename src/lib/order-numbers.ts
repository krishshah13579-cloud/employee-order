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

  let next = maxNum + 1;
  let nextOrderNumber = String(next);
  while (await db.order.findUnique({ where: { orderNumber: nextOrderNumber } })) {
    next++;
    nextOrderNumber = String(next);
  }

  return nextOrderNumber;
}
