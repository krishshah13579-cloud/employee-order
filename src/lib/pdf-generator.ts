import prisma from "@/lib/prisma";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  formatCurrency,
  formatDate,
  numberToIndianWords,
  formatColorAlphabetLines,
  formatProductNameWithMrp,
} from "@/lib/utils";
import { getInvoiceTemplateSettings } from "@/lib/invoice-template";
import { DEFAULT_INVOICE_TEMPLATE } from "@/lib/invoice-template-types";
import fs from "fs";
import path from "path";

/**
 * 1. Generates an A4 PDF Buffer for an Order Form or Tax Invoice
 */
export async function generateOrderPdfBuffer(
  orderIdOrNumber: string | number,
  formatType?: "TAX_INVOICE" | "ORDER_FORM"
): Promise<{ pdfBuffer: Buffer; fileName: string; docNo: string; customerPhone?: string | null }> {
  const orderId = typeof orderIdOrNumber === "number" ? orderIdOrNumber : parseInt(orderIdOrNumber, 10);
  const order = await prisma.order.findFirst({
    where: {
      OR: [
        ...(isNaN(orderId) ? [] : [{ id: orderId }]),
        { orderNumber: String(orderIdOrNumber) },
      ],
    },
    include: {
      customer: true,
      items: {
        include: {
          product: true,
        },
      },
    },
  });

  if (!order) {
    throw new Error(`Order '${orderIdOrNumber}' not found`);
  }

  const isTaxInvoice =
    formatType === "TAX_INVOICE" ||
    order.status === "Ready" ||
    order.status === "Dispatched" ||
    order.status === "Delivered" ||
    Boolean(order.taxInvoiceNumber);

  const docTitle = isTaxInvoice ? "TAX INVOICE" : "ORDER FORM";
  const docNo = isTaxInvoice && order.taxInvoiceNumber ? order.taxInvoiceNumber : order.orderNumber;
  const docDate = isTaxInvoice && order.taxInvoiceDate ? order.taxInvoiceDate : order.orderDate;

  // Resolve items
  let displayItems: any[] = order.items;
  let resolvedSubtotal = order.subtotal;
  let resolvedGst = order.gstAmount;
  let resolvedGrandTotal = order.grandTotal;
  let resolvedTotalSets = order.totalSets;
  let resolvedTotalPcs = order.totalPcs;

  if (isTaxInvoice && order.taxInvoiceItems) {
    try {
      const parsed = JSON.parse(order.taxInvoiceItems);
      if (Array.isArray(parsed) && parsed.length > 0) {
        displayItems = parsed;
        resolvedTotalSets = parsed.reduce((s: number, it: any) => s + (Number(it.totalSets) || 0), 0);
        resolvedTotalPcs = parsed.reduce((s: number, it: any) => s + (Number(it.totalPcs) || 0), 0);
        resolvedSubtotal = parsed.reduce((s: number, it: any) => s + (Number(it.itemSubtotal) || 0), 0);
        resolvedGst = Math.round(resolvedSubtotal * 0.05 * 100) / 100;
        resolvedGrandTotal = Math.round(resolvedSubtotal + resolvedGst);
      }
    } catch (e) {
      console.error("Error parsing taxInvoiceItems for PDF:", e);
    }
  }

  const globalTemplate = await getInvoiceTemplateSettings();
  let overrides: any = {};
  if ((order as any).templateOverrides) {
    try {
      overrides =
        typeof (order as any).templateOverrides === "string"
          ? JSON.parse((order as any).templateOverrides)
          : (order as any).templateOverrides;
    } catch {}
  }
  const tpl = { ...globalTemplate, ...overrides };

  // Create PDF
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let signatureImage: any = null;
  try {
    const sigPath = path.join(process.cwd(), "public", "images", "krish-clothing-signature.png");
    if (fs.existsSync(sigPath)) {
      const sigBytes = fs.readFileSync(sigPath);
      signatureImage = await pdfDoc.embedPng(sigBytes);
    }
  } catch {}

  const margin = 26;
  const contentWidth = width - margin * 2;
  const startTopY = height - margin;
  let y = startTopY;

  const drawText = (
    text: string,
    xPos: number,
    yPos: number,
    options: { font?: any; size?: number; color?: any } = {}
  ) => {
    const f = options.font || fontRegular;
    const s = options.size || 8.5;
    const c = options.color || rgb(0, 0, 0);
    page.drawText(String(text || ""), { x: xPos, y: yPos, font: f, size: s, color: c });
  };

  const drawLine = (x1: number, y1: number, x2: number, y2: number, thickness = 0.75) => {
    page.drawLine({
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 },
      thickness,
      color: rgb(0, 0, 0),
    });
  };

  const drawRect = (xPos: number, yPos: number, w: number, h: number, fillColor?: any, borderWidth = 1) => {
    page.drawRectangle({
      x: xPos,
      y: yPos,
      width: w,
      height: h,
      borderWidth,
      borderColor: rgb(0, 0, 0),
      color: fillColor || undefined,
    });
  };

  // Header: Company Letterhead
  y -= 18;
  const headerTitle = String(tpl.companyName || "KRISH CLOTHING CO.").toUpperCase();
  const titleWidth = fontBold.widthOfTextAtSize(headerTitle, 15);
  drawText(headerTitle, margin + (contentWidth - titleWidth) / 2, y, { font: fontBold, size: 15 });

  y -= 11;
  const addr1 = String(tpl.addressLine1 || "2ND FLOOR, Q-8,SAMET BUSINESS PARK,NEAR PARISHKAR-2,KHOKHARA CIRCLE,MANINAGAR,").trim();
  const addr1Width = fontBold.widthOfTextAtSize(addr1, 7.5);
  drawText(addr1, margin + (contentWidth - addr1Width) / 2, y, { font: fontBold, size: 7.5 });

  y -= 10;
  const addr2 = String(tpl.addressLine2 || "AHMEDABAD - 380008 (M) : 8128756632").trim();
  const addr2Width = fontBold.widthOfTextAtSize(addr2, 7.5);
  drawText(addr2, margin + (contentWidth - addr2Width) / 2, y, { font: fontBold, size: 7.5 });

  y -= 8;
  drawLine(margin, y, width - margin, y, 1);

  // Document Title Banner
  y -= 14;
  const bannerY = y - 4;
  drawRect(margin, bannerY, contentWidth, 18, rgb(0.92, 0.92, 0.92), 1);
  const docBannerText = docTitle;
  const docBannerW = fontBold.widthOfTextAtSize(docBannerText, 10);
  drawText(docBannerText, margin + (contentWidth - docBannerW) / 2, y + 1, { font: fontBold, size: 10 });

  y = bannerY;

  // Metadata 2-Column Block
  const metaHeight = 62;
  const metaBottomY = y - metaHeight;
  drawRect(margin, metaBottomY, contentWidth, metaHeight, undefined, 1);
  drawLine(margin + contentWidth / 2, y, margin + contentWidth / 2, metaBottomY, 1);

  // Left: Customer Info
  const leftX = margin + 8;
  let leftY = y - 12;
  drawText(`M/s : ${order.customerName.toUpperCase()}`, leftX, leftY, { font: fontBold, size: 8.5 });
  leftY -= 11;
  if (order.customerAddress) {
    drawText(order.customerAddress.slice(0, 48), leftX, leftY, { size: 7.5 });
    leftY -= 10;
  }
  const custCityState = `${order.customer?.city || "Ahmedabad"}${order.customer?.state ? `, ${order.customer.state}` : ""}`;
  drawText(custCityState, leftX, leftY, { size: 7.5 });
  leftY -= 11;
  drawText(`GSTIN / PAN : ${order.customerGstPan || "UNREGISTERED"}`, leftX, leftY, { font: fontBold, size: 7.5 });
  leftY -= 10;
  if (order.customerPhone) {
    drawText(`Phone : ${order.customerPhone}`, leftX, leftY, { size: 7.5 });
  }

  // Right: Document Metadata
  const rightX = margin + contentWidth / 2 + 8;
  let rightY = y - 12;
  drawText(`Bill No: #${docNo}`, rightX, rightY, { font: fontBold, size: 8.5 });
  rightY -= 11;
  drawText(`Date: ${formatDate(docDate)}`, rightX, rightY, { size: 8 });
  rightY -= 11;
  let transportText = "Direct Transport";
  if (order.notes && order.notes.includes("[TRANSPORT:")) {
    const match = order.notes.match(/\[TRANSPORT:\s*([^\]|]+)/i);
    if (match && match[1]) transportText = match[1].trim();
  }
  drawText(`Transport: ${transportText}`, rightX, rightY, { size: 8 });
  rightY -= 11;
  drawText(`Place of Supply: 24-Gujarat`, rightX, rightY, { size: 8 });

  y = metaBottomY;

  // Items Table Header
  const colSr = margin;
  const colDesc = margin + 24;
  const colColor = margin + 230;
  const colSets = margin + 350;
  const colPcs = margin + 410;
  const colRate = margin + 460;
  const colTotal = margin + 500;

  const thHeight = 16;
  const thBottomY = y - thHeight;
  drawRect(margin, thBottomY, contentWidth, thHeight, rgb(0.92, 0.92, 0.92), 1);
  drawText("Sr", colSr + 6, thBottomY + 4, { font: fontBold, size: 7.5 });
  drawText("Description of Goods", colDesc + 4, thBottomY + 4, { font: fontBold, size: 7.5 });
  drawText("Color (Alphabet)", colColor + 4, thBottomY + 4, { font: fontBold, size: 7.5 });
  drawText("Sets", colSets + 4, thBottomY + 4, { font: fontBold, size: 7.5 });
  drawText("Pcs", colPcs + 4, thBottomY + 4, { font: fontBold, size: 7.5 });
  drawText("Rate", colRate + 4, thBottomY + 4, { font: fontBold, size: 7.5 });
  drawText("Amount (₹)", colTotal + 4, thBottomY + 4, { font: fontBold, size: 7.5 });

  y = thBottomY;

  // Item Rows
  displayItems.forEach((it, idx) => {
    const rowH = 18;
    const rowBottomY = y - rowH;
    drawRect(margin, rowBottomY, contentWidth, rowH, undefined, 0.5);

    drawText(String(idx + 1), colSr + 8, rowBottomY + 5, { size: 7.5 });
    const prodName = it.productName || it.product?.name || "Garment Item";
    drawText(String(prodName).slice(0, 32), colDesc + 4, rowBottomY + 5, { font: fontBold, size: 7.5 });

    const colorText = it.color || it.selectedColor || "Standard";
    drawText(String(colorText).slice(0, 22), colColor + 4, rowBottomY + 5, { size: 7.5 });

    drawText(String(it.totalSets || 1), colSets + 8, rowBottomY + 5, { size: 7.5 });
    drawText(String(it.totalPcs || 5), colPcs + 8, rowBottomY + 5, { size: 7.5 });

    const rate = it.unitPrice || 0;
    drawText(rate.toFixed(2), colRate + 4, rowBottomY + 5, { size: 7.5 });

    const amt = it.itemSubtotal || it.totalPrice || 0;
    drawText(amt.toFixed(2), colTotal + 4, rowBottomY + 5, { font: fontBold, size: 7.5 });

    y = rowBottomY;
  });

  // Totals Section
  const totH = 44;
  const totBottomY = y - totH;
  drawRect(margin, totBottomY, contentWidth, totH, rgb(0.97, 0.97, 0.97), 1);

  drawText(`Total Quantity: ${resolvedTotalSets} Sets (${resolvedTotalPcs} Pieces)`, margin + 8, totBottomY + 28, {
    font: fontBold,
    size: 8,
  });
  drawText(`Amount in Words: ${numberToIndianWords(resolvedGrandTotal)}`, margin + 8, totBottomY + 12, {
    font: fontBold,
    size: 7.5,
  });

  const totRightX = margin + contentWidth - 140;
  drawText(`Subtotal:`, totRightX, totBottomY + 28, { size: 7.5 });
  drawText(`₹${resolvedSubtotal.toLocaleString("en-IN")}`, totRightX + 60, totBottomY + 28, { size: 7.5 });

  drawText(`GST (5%):`, totRightX, totBottomY + 16, { size: 7.5 });
  drawText(`₹${resolvedGst.toLocaleString("en-IN")}`, totRightX + 60, totBottomY + 16, { size: 7.5 });

  drawText(`Grand Total:`, totRightX, totBottomY + 4, { font: fontBold, size: 8.5 });
  drawText(`₹${resolvedGrandTotal.toLocaleString("en-IN")}`, totRightX + 60, totBottomY + 4, {
    font: fontBold,
    size: 8.5,
  });

  y = totBottomY;

  // Bank & Signatory Footer
  const footerH = 70;
  const footerBottomY = y - footerH;
  drawRect(margin, footerBottomY, contentWidth, footerH, undefined, 1);
  drawLine(margin + contentWidth / 2, y, margin + contentWidth / 2, footerBottomY, 1);

  // Left Bank Info
  let bkY = y - 12;
  drawText("Bank Remittance Details:", margin + 8, bkY, { font: fontBold, size: 7.5 });
  bkY -= 10;
  drawText(`Bank Name: ${tpl.bankName || "ICICI BANK"}`, margin + 8, bkY, { size: 7 });
  bkY -= 9;
  drawText(`Account No: ${tpl.accountNo || "750705000692"}`, margin + 8, bkY, { font: fontBold, size: 7.5 });
  bkY -= 9;
  drawText(`IFSC Code: ${tpl.ifscCode || "ICIC0007507"}`, margin + 8, bkY, { font: fontBold, size: 7 });
  bkY -= 9;
  drawText(`Branch: ${tpl.branch || "Khokhra Maninagar, Ahmedabad"}`, margin + 8, bkY, { size: 7 });
  bkY -= 9;
  drawText(`Beneficiary: ${tpl.beneficiaryName || "KRISH CLOTHING CO."}`, margin + 8, bkY, { size: 7 });

  // Right Signatory
  const sigX = margin + contentWidth / 2 + 8;
  drawText(`For, ${tpl.companyName || "KRISH CLOTHING CO."}`, sigX, y - 12, { font: fontBold, size: 8 });
  if (signatureImage) {
    try {
      page.drawImage(signatureImage, {
        x: sigX + 40,
        y: footerBottomY + 14,
        width: 70,
        height: 28,
      });
    } catch {}
  }
  drawText("(Authorised Signatory)", sigX + 50, footerBottomY + 6, { font: fontBold, size: 7.5 });

  y = footerBottomY;

  // Outer Border Box
  const billBoxH = startTopY - y;
  drawRect(margin, y, contentWidth, billBoxH, undefined, 1.25);

  const pdfBytes = await pdfDoc.save();
  const fileName = `${isTaxInvoice ? "Tax_Invoice" : "Order_Form"}_${docNo.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;

  return {
    pdfBuffer: Buffer.from(pdfBytes),
    fileName,
    docNo,
    customerPhone: order.customerPhone || order.customer?.phoneNumber,
  };
}

/**
 * 2. Generates an A4 PDF Buffer for a Customer Ledger / Pending Bills Statement
 */
export async function generateCustomerLedgerPdfBuffer(
  customerId: number,
  formatType: "format1" | "format2" = "format1"
): Promise<{ pdfBuffer: Buffer; fileName: string; customerPhone?: string | null; customerName: string }> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      salesInvoices: { orderBy: { invoiceDate: "asc" } },
      payments: { orderBy: { paymentDate: "asc" } },
      salesReturns: { orderBy: { returnDate: "asc" } },
      orders: {
        where: {
          status: { in: ["Confirmed", "In Production", "Ready", "Dispatched", "Delivered"] },
        },
        orderBy: { orderDate: "asc" },
      },
    },
  });

  if (!customer) {
    throw new Error(`Customer ID '${customerId}' not found`);
  }

  let companyTemplate = DEFAULT_INVOICE_TEMPLATE;
  try {
    const dbTpl = await prisma.invoiceTemplate.findFirst();
    if (dbTpl) companyTemplate = { ...DEFAULT_INVOICE_TEMPLATE, ...dbTpl };
  } catch {}

  const creditDays = Number(customer.creditDays) || 45;

  // Collect credit bills deduplicated
  interface BillItem {
    id: string;
    billNo: string;
    billDate: Date;
    dueDate: Date;
    totalAmount: number;
    paidAmount: number;
    pendingAmount: number;
  }

  const billsMap = new Map<string, { id: string; billNo: string; billDate: Date; dueDate: Date; totalAmount: number }>();

  for (const si of customer.salesInvoices) {
    if (si.paymentType === "Cash") continue;
    const bDate = new Date(si.invoiceDate);
    const dDate = new Date(bDate.getTime() + creditDays * 24 * 60 * 60 * 1000);
    const docNo = (si.invoiceNumber || si.orderNumber || String(si.id)).trim();
    const key = (si.orderId ? `order-${si.orderId}` : `si-${si.id}`).toLowerCase();
    billsMap.set(key, {
      id: `si-${si.id}`,
      billNo: docNo,
      billDate: bDate,
      dueDate: dDate,
      totalAmount: Number(si.grandTotal) || 0,
    });
  }

  for (const ord of customer.orders) {
    const key = `order-${ord.id}`.toLowerCase();
    if (billsMap.has(key)) continue;
    const docNo = (ord.taxInvoiceNumber || ord.orderNumber || String(ord.id)).trim();
    const bDate = new Date(ord.taxInvoiceDate || ord.orderDate);
    const dDate = new Date(bDate.getTime() + creditDays * 24 * 60 * 60 * 1000);
    billsMap.set(key, {
      id: `ord-${ord.id}`,
      billNo: docNo,
      billDate: bDate,
      dueDate: dDate,
      totalAmount: Number(ord.grandTotal) || 0,
    });
  }

  const allBillsRaw = Array.from(billsMap.values()).sort((a, b) => a.billDate.getTime() - b.billDate.getTime());
  const totalBilled = allBillsRaw.reduce((sum, b) => sum + b.totalAmount, 0);
  const totalPaid = customer.payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const totalReturns = customer.salesReturns.reduce((sum, r) => sum + Number(r.totalAmount || 0), 0);
  const totalCredits = totalPaid + totalReturns;

  // FIFO Calculation
  let remainingCredit = totalCredits;
  const pendingBills: BillItem[] = [];

  for (const b of allBillsRaw) {
    let paid = 0;
    let pending = b.totalAmount;
    if (remainingCredit >= b.totalAmount) {
      paid = b.totalAmount;
      pending = 0;
      remainingCredit -= b.totalAmount;
    } else if (remainingCredit > 0) {
      paid = remainingCredit;
      pending = b.totalAmount - remainingCredit;
      remainingCredit = 0;
    } else {
      paid = 0;
      pending = b.totalAmount;
    }

    if (pending > 0) {
      pendingBills.push({
        id: b.id,
        billNo: b.billNo,
        billDate: b.billDate,
        dueDate: b.dueDate,
        totalAmount: b.totalAmount,
        paidAmount: paid,
        pendingAmount: pending,
      });
    }
  }

  const totalPendingAmount = pendingBills.reduce((sum, b) => sum + b.pendingAmount, 0);
  const netOutstanding = Math.max(0, totalBilled - totalCredits);

  // Create A4 PDF Document
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const margin = 26;
  const contentWidth = width - margin * 2;
  const startTopY = height - margin;
  let y = startTopY;

  const drawText = (
    text: string,
    xPos: number,
    yPos: number,
    options: { font?: any; size?: number; color?: any } = {}
  ) => {
    const f = options.font || fontRegular;
    const s = options.size || 8.5;
    const c = options.color || rgb(0, 0, 0);
    page.drawText(String(text || ""), { x: xPos, y: yPos, font: f, size: s, color: c });
  };

  const drawLine = (x1: number, y1: number, x2: number, y2: number, thickness = 0.75) => {
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color: rgb(0, 0, 0) });
  };

  const drawRect = (xPos: number, yPos: number, w: number, h: number, fillColor?: any, borderWidth = 1) => {
    page.drawRectangle({
      x: xPos,
      y: yPos,
      width: w,
      height: h,
      borderWidth,
      borderColor: rgb(0, 0, 0),
      color: fillColor || undefined,
    });
  };

  // Header Letterhead
  y -= 18;
  const companyName = String(companyTemplate.companyName || "KRISH CLOTHING CO.").toUpperCase();
  const cNameW = fontBold.widthOfTextAtSize(companyName, 15);
  drawText(companyName, margin + (contentWidth - cNameW) / 2, y, { font: fontBold, size: 15 });

  y -= 11;
  const addr1 = String(companyTemplate.addressLine1 || "2ND FLOOR, Q-8,SAMET BUSINESS PARK,NEAR PARISHKAR-2,KHOKHARA CIRCLE,MANINAGAR,").trim();
  const addr1W = fontBold.widthOfTextAtSize(addr1, 7.5);
  drawText(addr1, margin + (contentWidth - addr1W) / 2, y, { font: fontBold, size: 7.5 });

  y -= 10;
  const addr2 = String(companyTemplate.addressLine2 || "AHMEDABAD - 380008 (M) : 8128756632").trim();
  const addr2W = fontBold.widthOfTextAtSize(addr2, 7.5);
  drawText(addr2, margin + (contentWidth - addr2W) / 2, y, { font: fontBold, size: 7.5 });

  y -= 8;
  drawLine(margin, y, width - margin, y, 1);

  // Title Banner
  y -= 14;
  const bannerY = y - 4;
  drawRect(margin, bannerY, contentWidth, 18, rgb(0.1, 0.1, 0.1), 1);
  const titleText =
    formatType === "format1"
      ? "STATEMENT OF PENDING & PARTLY PAID BILLS"
      : "STATEMENT OF ACCOUNT / CUSTOMER LEDGER";
  const titleW = fontBold.widthOfTextAtSize(titleText, 9.5);
  drawText(titleText, margin + (contentWidth - titleW) / 2, y + 1, {
    font: fontBold,
    size: 9.5,
    color: rgb(1, 1, 1),
  });

  y = bannerY;

  // Customer & Statement Metadata Block
  const metaHeight = 54;
  const metaBottomY = y - metaHeight;
  drawRect(margin, metaBottomY, contentWidth, metaHeight, undefined, 1);
  drawLine(margin + contentWidth / 2, y, margin + contentWidth / 2, metaBottomY, 1);

  const leftX = margin + 8;
  let leftY = y - 11;
  drawText(`M/s : ${customer.shopName.toUpperCase()}`, leftX, leftY, { font: fontBold, size: 8.5 });
  leftY -= 10;
  if (customer.contactPerson) {
    drawText(`Attn: ${customer.contactPerson}`, leftX, leftY, { size: 7.5 });
    leftY -= 9;
  }
  drawText(`${customer.city || "Ahmedabad"}${customer.state ? `, ${customer.state}` : ""}`, leftX, leftY, { size: 7.5 });
  leftY -= 10;
  drawText(`Phone: ${customer.phoneNumber || "—"}  •  GST/PAN: ${customer.gstPanNo || "UNREGISTERED"}`, leftX, leftY, {
    font: fontBold,
    size: 7,
  });

  const rightX = margin + contentWidth / 2 + 8;
  let rightY = y - 11;
  drawText(`Statement Date: ${formatDate(new Date())}`, rightX, rightY, { font: fontBold, size: 8 });
  rightY -= 11;
  drawText(`Credit Terms: ${creditDays} Days`, rightX, rightY, { size: 7.5 });
  rightY -= 11;
  drawText(`Total Outstanding Due:`, rightX, rightY, { size: 7.5 });
  rightY -= 11;
  drawText(`₹${totalPendingAmount.toLocaleString("en-IN")}`, rightX, rightY, {
    font: fontBold,
    size: 10,
    color: rgb(0.8, 0, 0),
  });

  y = metaBottomY;

  // Notice Box (Format 1: Exact text requested by user)
  if (formatType === "format1") {
    const noticeH = 24;
    const noticeBottomY = y - noticeH;
    drawRect(margin, noticeBottomY, contentWidth, noticeH, rgb(0.97, 0.97, 0.94), 0.75);
    drawText(
      "Note: The bills that are partly paid (Amount left after Deducting the amount received) and not paid bills are shown below.",
      margin + 8,
      noticeBottomY + 13,
      { font: fontBold, size: 7.5 }
    );
    drawText(
      "Kindly arrange for the remittance of the pending balance at your earliest convenience.",
      margin + 8,
      noticeBottomY + 4,
      { size: 7 }
    );
    y = noticeBottomY;
  }

  // Table Column Coordinates
  const cSr = margin;
  const cDate = margin + 24;
  const cBillNo = margin + 95;
  const cDueDate = margin + 200;
  const cTotal = margin + 285;
  const cPaid = margin + 375;
  const cPending = margin + 460;

  const thH = 16;
  const thBottomY = y - thH;
  drawRect(margin, thBottomY, contentWidth, thH, rgb(0.92, 0.92, 0.92), 1);
  drawText("Sr", cSr + 6, thBottomY + 4, { font: fontBold, size: 7.5 });
  drawText("Bill Date", cDate + 4, thBottomY + 4, { font: fontBold, size: 7.5 });
  drawText("Bill / Invoice No.", cBillNo + 4, thBottomY + 4, { font: fontBold, size: 7.5 });
  drawText("Due Date", cDueDate + 4, thBottomY + 4, { font: fontBold, size: 7.5 });
  drawText("Bill Total (₹)", cTotal + 4, thBottomY + 4, { font: fontBold, size: 7.5 });
  drawText("Amount Received (₹)", cPaid + 4, thBottomY + 4, { font: fontBold, size: 7.5 });
  drawText("Amount Left (₹)", cPending + 4, thBottomY + 4, { font: fontBold, size: 7.5 });

  y = thBottomY;

  // Render Pending Bills
  if (pendingBills.length === 0) {
    const rowH = 24;
    const rowBottomY = y - rowH;
    drawRect(margin, rowBottomY, contentWidth, rowH, undefined, 0.5);
    drawText("✅ All bills are fully paid! No outstanding payment due.", margin + 40, rowBottomY + 8, {
      font: fontBold,
      size: 8.5,
      color: rgb(0, 0.5, 0),
    });
    y = rowBottomY;
  } else {
    pendingBills.slice(0, 24).forEach((b, idx) => {
      const rowH = 16;
      const rowBottomY = y - rowH;
      drawRect(margin, rowBottomY, contentWidth, rowH, undefined, 0.5);

      drawText(String(idx + 1), cSr + 8, rowBottomY + 4, { size: 7.5 });
      drawText(formatDate(b.billDate), cDate + 4, rowBottomY + 4, { size: 7.5 });
      drawText(`Bill #${b.billNo}`, cBillNo + 4, rowBottomY + 4, { font: fontBold, size: 7.5 });
      drawText(formatDate(b.dueDate), cDueDate + 4, rowBottomY + 4, { size: 7.5 });

      drawText(b.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 }), cTotal + 4, rowBottomY + 4, {
        size: 7.5,
      });

      const paidText = b.paidAmount > 0 ? `-${b.paidAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "0.00";
      drawText(paidText, cPaid + 4, rowBottomY + 4, {
        size: 7.5,
        color: b.paidAmount > 0 ? rgb(0, 0.5, 0) : rgb(0.4, 0.4, 0.4),
      });

      drawText(b.pendingAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 }), cPending + 4, rowBottomY + 4, {
        font: fontBold,
        size: 8,
        color: rgb(0.8, 0, 0),
      });

      y = rowBottomY;
    });
  }

  // Totals & Words Row
  const totH = 34;
  const totBottomY = y - totH;
  drawRect(margin, totBottomY, contentWidth, totH, rgb(0.95, 0.95, 0.95), 1);

  drawText(`Total Pending Due: ₹${totalPendingAmount.toLocaleString("en-IN")}`, margin + 8, totBottomY + 19, {
    font: fontBold,
    size: 9.5,
    color: rgb(0.8, 0, 0),
  });
  drawText(`Amount in Words: ${numberToIndianWords(totalPendingAmount)}`, margin + 8, totBottomY + 6, {
    font: fontBold,
    size: 7.5,
  });

  y = totBottomY;

  // Bank Remittance & Signatory Footer
  const footerH = 68;
  const footerBottomY = y - footerH;
  drawRect(margin, footerBottomY, contentWidth, footerH, undefined, 1);
  drawLine(margin + contentWidth / 2, y, margin + contentWidth / 2, footerBottomY, 1);

  let bkY = y - 11;
  drawText("Bank Remittance Details (ICICI BANK):", margin + 8, bkY, { font: fontBold, size: 7.5 });
  bkY -= 10;
  drawText(`Bank Name: ${companyTemplate.bankName || "ICICI BANK"}`, margin + 8, bkY, { size: 7 });
  bkY -= 9;
  drawText(`Account No: ${companyTemplate.accountNo || "750705000692"}`, margin + 8, bkY, {
    font: fontBold,
    size: 7.5,
  });
  bkY -= 9;
  drawText(`IFSC Code: ${companyTemplate.ifscCode || "ICIC0007507"}`, margin + 8, bkY, { font: fontBold, size: 7 });
  bkY -= 9;
  drawText(`Branch: ${companyTemplate.branch || "Khokhra Maninagar, Ahmedabad"}`, margin + 8, bkY, { size: 7 });
  bkY -= 9;
  drawText(`Beneficiary: ${companyTemplate.beneficiaryName || "KRISH CLOTHING CO."}`, margin + 8, bkY, { size: 7 });

  const sigX = margin + contentWidth / 2 + 8;
  drawText(`For, ${companyTemplate.companyName || "KRISH CLOTHING CO."}`, sigX, y - 12, { font: fontBold, size: 8 });
  drawText("(Authorised Signatory)", sigX + 50, footerBottomY + 6, { font: fontBold, size: 7.5 });

  y = footerBottomY;

  // Outer Border Box
  const ledgerBoxH = startTopY - y;
  drawRect(margin, y, contentWidth, ledgerBoxH, undefined, 1.25);

  const pdfBytes = await pdfDoc.save();
  const safeName = customer.shopName.replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `Statement_${safeName}_${formatDate(new Date()).replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;

  return {
    pdfBuffer: Buffer.from(pdfBytes),
    fileName,
    customerPhone: customer.phoneNumber,
    customerName: customer.shopName,
  };
}

/**
 * 3. Generates an A4 PDF Buffer for a Sales Invoice (Sales Register)
 */
export async function generateSalesInvoicePdfBuffer(
  invoiceId: number
): Promise<{ pdfBuffer: Buffer; fileName: string; customerPhone?: string | null }> {
  const inv = await prisma.salesInvoice.findUnique({
    where: { id: invoiceId },
    include: {
      customer: true,
    },
  });

  if (!inv) {
    throw new Error(`Sales Invoice ID '${invoiceId}' not found`);
  }

  // If linked to an order, generate via order generator with tax invoice formatting
  if (inv.orderId) {
    return generateOrderPdfBuffer(inv.orderId, "TAX_INVOICE");
  }

  let itemsList: any[] = [];
  try {
    itemsList = JSON.parse(inv.items || "[]");
  } catch {}

  const globalTemplate = await getInvoiceTemplateSettings();
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const margin = 26;
  const contentWidth = width - margin * 2;
  const startTopY = height - margin;
  let y = startTopY;

  const drawText = (
    text: string,
    xPos: number,
    yPos: number,
    options: { font?: any; size?: number; color?: any } = {}
  ) => {
    const f = options.font || fontRegular;
    const s = options.size || 8.5;
    const c = options.color || rgb(0, 0, 0);
    page.drawText(String(text || ""), { x: xPos, y: yPos, font: f, size: s, color: c });
  };

  const drawLine = (x1: number, y1: number, x2: number, y2: number, thickness = 0.75) => {
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color: rgb(0, 0, 0) });
  };

  const drawRect = (xPos: number, yPos: number, w: number, h: number, fillColor?: any, borderWidth = 1) => {
    page.drawRectangle({
      x: xPos,
      y: yPos,
      width: w,
      height: h,
      borderWidth,
      borderColor: rgb(0, 0, 0),
      color: fillColor || undefined,
    });
  };

  // Header Letterhead
  y -= 18;
  const compName = String(globalTemplate.companyName || "KRISH CLOTHING CO.").toUpperCase();
  const cW = fontBold.widthOfTextAtSize(compName, 15);
  drawText(compName, margin + (contentWidth - cW) / 2, y, { font: fontBold, size: 15 });

  y -= 11;
  const addr1 = String(globalTemplate.addressLine1 || "2ND FLOOR, Q-8,SAMET BUSINESS PARK,NEAR PARISHKAR-2,KHOKHARA CIRCLE,MANINAGAR,").trim();
  const a1W = fontBold.widthOfTextAtSize(addr1, 7.5);
  drawText(addr1, margin + (contentWidth - a1W) / 2, y, { font: fontBold, size: 7.5 });

  y -= 10;
  const addr2 = String(globalTemplate.addressLine2 || "AHMEDABAD - 380008 (M) : 8128756632").trim();
  const a2W = fontBold.widthOfTextAtSize(addr2, 7.5);
  drawText(addr2, margin + (contentWidth - a2W) / 2, y, { font: fontBold, size: 7.5 });

  y -= 8;
  drawLine(margin, y, width - margin, y, 1);

  // Title Banner
  y -= 14;
  const bannerY = y - 4;
  drawRect(margin, bannerY, contentWidth, 18, rgb(0.92, 0.92, 0.92), 1);
  const docBannerText = "TAX INVOICE";
  const docBannerW = fontBold.widthOfTextAtSize(docBannerText, 10);
  drawText(docBannerText, margin + (contentWidth - docBannerW) / 2, y + 1, { font: fontBold, size: 10 });

  y = bannerY;

  // Metadata
  const metaHeight = 54;
  const metaBottomY = y - metaHeight;
  drawRect(margin, metaBottomY, contentWidth, metaHeight, undefined, 1);
  drawLine(margin + contentWidth / 2, y, margin + contentWidth / 2, metaBottomY, 1);

  const leftX = margin + 8;
  let leftY = y - 11;
  drawText(`M/s : ${inv.customerName.toUpperCase()}`, leftX, leftY, { font: fontBold, size: 8.5 });
  leftY -= 10;
  if (inv.customerAddress) {
    drawText(inv.customerAddress.slice(0, 48), leftX, leftY, { size: 7.5 });
    leftY -= 9;
  }
  drawText(`GSTIN / PAN : ${inv.customerGstPan || "UNREGISTERED"}`, leftX, leftY, { font: fontBold, size: 7.5 });
  leftY -= 10;
  if (inv.customerPhone) {
    drawText(`Phone : ${inv.customerPhone}`, leftX, leftY, { size: 7.5 });
  }

  const rightX = margin + contentWidth / 2 + 8;
  let rightY = y - 11;
  drawText(`Invoice No: #${inv.invoiceNumber}`, rightX, rightY, { font: fontBold, size: 8.5 });
  rightY -= 11;
  drawText(`Date: ${formatDate(inv.invoiceDate)}`, rightX, rightY, { size: 8 });
  rightY -= 11;
  drawText(`Payment Mode: ${inv.paymentType}  •  Status: ${inv.paymentStatus}`, rightX, rightY, { size: 7.5 });
  rightY -= 11;
  drawText(`Place of Supply: 24-Gujarat`, rightX, rightY, { size: 7.5 });

  y = metaBottomY;

  // Items Table Header
  const colSr = margin;
  const colDesc = margin + 24;
  const colColor = margin + 240;
  const colSets = margin + 350;
  const colPcs = margin + 410;
  const colRate = margin + 460;
  const colTotal = margin + 500;

  const thHeight = 16;
  const thBottomY = y - thHeight;
  drawRect(margin, thBottomY, contentWidth, thHeight, rgb(0.92, 0.92, 0.92), 1);
  drawText("Sr", colSr + 6, thBottomY + 4, { font: fontBold, size: 7.5 });
  drawText("Description of Goods", colDesc + 4, thBottomY + 4, { font: fontBold, size: 7.5 });
  drawText("Color / Details", colColor + 4, thBottomY + 4, { font: fontBold, size: 7.5 });
  drawText("Sets", colSets + 4, thBottomY + 4, { font: fontBold, size: 7.5 });
  drawText("Pcs", colPcs + 4, thBottomY + 4, { font: fontBold, size: 7.5 });
  drawText("Rate", colRate + 4, thBottomY + 4, { font: fontBold, size: 7.5 });
  drawText("Amount (₹)", colTotal + 4, thBottomY + 4, { font: fontBold, size: 7.5 });

  y = thBottomY;

  itemsList.forEach((it: any, idx: number) => {
    const rowH = 18;
    const rowBottomY = y - rowH;
    drawRect(margin, rowBottomY, contentWidth, rowH, undefined, 0.5);

    drawText(String(idx + 1), colSr + 8, rowBottomY + 5, { size: 7.5 });
    drawText(String(it.productName || "Garment Item").slice(0, 32), colDesc + 4, rowBottomY + 5, {
      font: fontBold,
      size: 7.5,
    });
    drawText(String(it.color || it.sizeRatio || "Standard").slice(0, 20), colColor + 4, rowBottomY + 5, { size: 7.5 });
    drawText(String(it.totalSets || 1), colSets + 8, rowBottomY + 5, { size: 7.5 });
    drawText(String(it.totalPcs || 5), colPcs + 8, rowBottomY + 5, { size: 7.5 });
    drawText(Number(it.unitPrice || 0).toFixed(2), colRate + 4, rowBottomY + 5, { size: 7.5 });
    drawText(Number(it.itemSubtotal || 0).toFixed(2), colTotal + 4, rowBottomY + 5, { font: fontBold, size: 7.5 });

    y = rowBottomY;
  });

  // Totals
  const totH = 40;
  const totBottomY = y - totH;
  drawRect(margin, totBottomY, contentWidth, totH, rgb(0.97, 0.97, 0.97), 1);

  drawText(`Total Quantity: ${inv.totalSets} Sets (${inv.totalPcs} Pieces)`, margin + 8, totBottomY + 24, {
    font: fontBold,
    size: 8,
  });
  drawText(`Amount in Words: ${numberToIndianWords(inv.grandTotal)}`, margin + 8, totBottomY + 10, {
    font: fontBold,
    size: 7.5,
  });

  const totRightX = margin + contentWidth - 140;
  drawText(`Subtotal:`, totRightX, totBottomY + 24, { size: 7.5 });
  drawText(`₹${inv.subtotal.toLocaleString("en-IN")}`, totRightX + 60, totBottomY + 24, { size: 7.5 });

  drawText(`GST (5%):`, totRightX, totBottomY + 13, { size: 7.5 });
  drawText(`₹${inv.gstAmount.toLocaleString("en-IN")}`, totRightX + 60, totBottomY + 13, { size: 7.5 });

  drawText(`Grand Total:`, totRightX, totBottomY + 2, { font: fontBold, size: 8.5 });
  drawText(`₹${inv.grandTotal.toLocaleString("en-IN")}`, totRightX + 60, totBottomY + 2, {
    font: fontBold,
    size: 8.5,
  });

  y = totBottomY;

  // Footer
  const footerH = 68;
  const footerBottomY = y - footerH;
  drawRect(margin, footerBottomY, contentWidth, footerH, undefined, 1);
  drawLine(margin + contentWidth / 2, y, margin + contentWidth / 2, footerBottomY, 1);

  let bkY = y - 11;
  drawText("Bank Remittance Details (ICICI BANK):", margin + 8, bkY, { font: fontBold, size: 7.5 });
  bkY -= 10;
  drawText(`Bank: ${globalTemplate.bankName || "ICICI BANK"}`, margin + 8, bkY, { size: 7 });
  bkY -= 9;
  drawText(`A/C: ${globalTemplate.accountNo || "750705000692"}`, margin + 8, bkY, { font: fontBold, size: 7.5 });
  bkY -= 9;
  drawText(`IFSC: ${globalTemplate.ifscCode || "ICIC0007507"}`, margin + 8, bkY, { font: fontBold, size: 7 });
  bkY -= 9;
  drawText(`Branch: ${globalTemplate.branch || "Khokhra Maninagar, Ahmedabad"}`, margin + 8, bkY, { size: 7 });

  const sigX = margin + contentWidth / 2 + 8;
  drawText(`For, ${globalTemplate.companyName || "KRISH CLOTHING CO."}`, sigX, y - 12, { font: fontBold, size: 8 });
  drawText("(Authorised Signatory)", sigX + 50, footerBottomY + 6, { font: fontBold, size: 7.5 });

  y = footerBottomY;

  const boxH = startTopY - y;
  drawRect(margin, y, contentWidth, boxH, undefined, 1.25);

  const pdfBytes = await pdfDoc.save();
  const fileName = `Tax_Invoice_${inv.invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;

  return {
    pdfBuffer: Buffer.from(pdfBytes),
    fileName,
    customerPhone: inv.customerPhone || inv.customer?.phoneNumber,
  };
}
