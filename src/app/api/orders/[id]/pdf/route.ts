import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  formatColorAlphabetLines,
  formatProductNameWithMrp,
  expandOrderItemsForInvoice,
} from "@/lib/utils";
import { getInvoiceTemplateSettings } from "@/lib/invoice-template";
import fs from "fs";
import path from "path";

import { getAdminSession, getEmployeeSession, isSpecialTeamLeaderKrishShah } from "@/lib/auth-security";
import { sanitizePositiveInt } from "@/lib/navigation";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminSession(request);
    const employee = await getEmployeeSession(request);

    if (!admin && !employee) {
      return NextResponse.json({ error: "Unauthorized. Please log in to download order PDFs." }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const formatType = searchParams.get("type") === "tax_invoice" ? "TAX_INVOICE" : "ORDER_FORM";

    const orderId = sanitizePositiveInt(id);
    const order = await prisma.order.findFirst({
      where: {
        OR: [
          ...(orderId ? [{ id: orderId }] : []),
          { orderNumber: id },
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
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Role-based IDOR Defense
    const isTLKrishShah = isSpecialTeamLeaderKrishShah(employee);
    if (!admin && !isTLKrishShah && employee) {
      const empName = (employee.name || "").trim().toLowerCase();
      const placedBy = (order.placedBy || "").trim().toLowerCase();
      const custAllocatedEmpId = order.customer?.allocatedEmployeeId;
      const custAllocatedEmpName = (order.customer?.allocatedEmployeeName || "").trim().toLowerCase();

      const isMyOrder = placedBy === empName;
      const isMyAllocatedCustomer =
        (custAllocatedEmpId && custAllocatedEmpId === employee.id) ||
        (custAllocatedEmpName && custAllocatedEmpName === empName);

      if (!isMyOrder && !isMyAllocatedCustomer) {
        return NextResponse.json(
          { error: "Forbidden: You cannot access or download PDFs for another employee's order." },
          { status: 403 }
        );
      }
    }

    // Determine whether to use Tax Invoice data or Order Form data
    const isTaxInvoice =
      formatType === "TAX_INVOICE" ||
      order.status === "Ready" ||
      order.status === "Dispatched" ||
      order.status === "Delivered" ||
      Boolean(order.taxInvoiceNumber);

    const docTitle = isTaxInvoice ? "TAX INVOICE" : "ORDER FORM";
    const docNo = isTaxInvoice && order.taxInvoiceNumber ? order.taxInvoiceNumber : order.orderNumber;
    const docDate = isTaxInvoice && order.taxInvoiceDate ? order.taxInvoiceDate : order.orderDate;

    // Resolve items (use taxInvoiceItems if available and isTaxInvoice)
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

    // Load dynamic invoice template settings & order overrides
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

    // Build product map for resolving colorMapping & colorsAvailable
    const productByItem = new Map<any, any>();
    order.items.forEach((it: any) => {
      if (it.product) {
        if (it.productId) productByItem.set(it.productId, it.product);
        if (it.productName) productByItem.set(String(it.productName).toLowerCase().trim(), it.product);
      }
    });

    const missingProductNames = displayItems
      .filter(
        (it: any) =>
          !productByItem.get(it.productId) &&
          !productByItem.get(String(it.productName || "").toLowerCase().trim())
      )
      .map((it: any) => String(it.productName || "").trim())
      .filter(Boolean);

    if (missingProductNames.length > 0) {
      try {
        const dbProducts = await prisma.product.findMany({
          where: { name: { in: missingProductNames } },
        });
        dbProducts.forEach((p) => {
          productByItem.set(p.id, p);
          productByItem.set(p.name.toLowerCase().trim(), p);
        });
      } catch (err) {
        console.error("Error fetching missing products for PDF:", err);
      }
    }

    // Create a new PDF document (A4: 595.28 x 841.89 points)
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]);
    const { width, height } = page.getSize();

    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Try loading authorised signature image
    let signatureImage = null;
    try {
      const sigPath = path.join(process.cwd(), "public", "images", "krish-clothing-signature.png");
      if (fs.existsSync(sigPath)) {
        const sigBytes = fs.readFileSync(sigPath);
        signatureImage = await pdfDoc.embedPng(sigBytes);
      }
    } catch (e) {
      console.warn("Could not load signature image for PDF:", e);
    }

    // Margins (A4 page: 595.28 x 841.89)
    const margin = 26;
    const contentWidth = width - margin * 2;
    const startTopY = height - margin;
    let y = startTopY;

    // Helper: draw text
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

    // Helper: draw line
    const drawLine = (x1: number, y1: number, x2: number, y2: number, thickness = 0.75) => {
      page.drawLine({
        start: { x: x1, y: y1 },
        end: { x: x2, y: y2 },
        thickness,
        color: rgb(0, 0, 0),
      });
    };

    // Helper: draw rectangle
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

    // ══════════════════════════════════════════════════════════════════
    // 1. TOP HEADER: COMPANY NAME & ADDRESS (CENTERED)
    // ══════════════════════════════════════════════════════════════════
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

    y -= 7;
    drawLine(margin, y, width - margin, y, 1);

    // ══════════════════════════════════════════════════════════════════
    // 2. SUB-HEADER BAR: Debit Memo | ORDER FORM / TAX INVOICE | Original
    // ══════════════════════════════════════════════════════════════════
    const subBarHeight = 16;
    y -= subBarHeight;
    const barCenterY = y + 4;
    drawText("Debit Memo", margin + 8, barCenterY, { font: fontBold, size: 8 });

    const titleStr = docTitle.toUpperCase();
    const titleW = fontBold.widthOfTextAtSize(titleStr, 11);
    drawText(titleStr, margin + (contentWidth - titleW) / 2, barCenterY, {
      font: fontBold,
      size: 11,
      color: rgb(0, 0, 0),
    });

    const copyStr = "Original";
    const copyW = fontBold.widthOfTextAtSize(copyStr, 8);
    drawText(copyStr, width - margin - copyW - 8, barCenterY, { font: fontBold, size: 8 });

    drawLine(margin, y, width - margin, y, 1);

    // ══════════════════════════════════════════════════════════════════
    // 3. CUSTOMER & ORDER DETAILS SECTION
    // ══════════════════════════════════════════════════════════════════
    const detailsTopY = y;
    const colSplit = margin + contentWidth * 0.58;

    // Left Column Customer Info
    const custName = (order.customer?.shopName || order.customerName || "RETAIL CUSTOMER").toUpperCase();
    const custAddr = (order.customer?.address || order.customerAddress || "").toUpperCase();
    const custCity = `${order.customer?.city || "AHMEDABAD"} - ${order.customer?.state || "GUJARAT"}`.toUpperCase();
    const custPhone = order.customer?.phoneNumber || order.customerPhone || "";
    const custGstPan = (order.customer?.gstPanNo || order.customerGstPan || "—").toUpperCase();

    // Right Column Order Meta
    let transportText = "DIRECT TRANSPORT";
    if (order.notes && order.notes.includes("[TRANSPORT:")) {
      const match = order.notes.match(/\[TRANSPORT:\s*([^\]|]+)/i);
      if (match && match[1]) transportText = match[1].trim().toUpperCase();
    }
    const formattedDate = docDate
      ? new Date(docDate).toLocaleDateString("en-IN")
      : new Date().toLocaleDateString("en-IN");

    const detailsHeight = 64;
    const detailsBottomY = detailsTopY - detailsHeight;

    // Draw Left Column: Customer details
    let lY = detailsTopY - 11;
    drawText(`M/s. : ${custName.slice(0, 42)}`, margin + 6, lY, { font: fontBold, size: 8 });
    lY -= 10;
    if (custAddr) {
      drawText(custAddr.slice(0, 52), margin + 6, lY, { size: 7.5 });
      lY -= 10;
    }
    drawText(custCity, margin + 6, lY, { size: 7.5 });
    lY -= 10;
    drawText(`Place of Supply : 24-Gujarat`, margin + 6, lY, { size: 7.5 });
    if (custPhone) {
      drawText(`Mob No. ${custPhone}`, margin + 145, lY, { font: fontBold, size: 7.5 });
    }
    lY -= 10;
    drawText(`GSTIN No. : ${custGstPan}`, margin + 6, lY, { font: fontBold, size: 7.5 });

    // Draw Right Column: Order details with inner horizontal dividing lines
    const rightRowH = detailsHeight / 3;
    let rY1 = detailsTopY - rightRowH;
    let rY2 = detailsTopY - rightRowH * 2;

    // Order / Invoice No row
    const numLabel = isTaxInvoice ? "Invoice No." : "Order No.";
    drawText(numLabel, colSplit + 8, detailsTopY - 13, { font: fontBold, size: 8 });
    drawText(`: ${docNo}`, colSplit + 68, detailsTopY - 13, { font: fontBold, size: 8 });
    drawLine(colSplit, rY1, width - margin, rY1, 0.75);

    // Date row
    drawText("Date", colSplit + 8, rY1 - 13, { font: fontBold, size: 8 });
    drawText(`: ${formattedDate}`, colSplit + 68, rY1 - 13, { font: fontBold, size: 8 });
    drawLine(colSplit, rY2, width - margin, rY2, 0.75);

    // Transport row
    drawText("TRANSPORT", colSplit + 8, rY2 - 13, { font: fontBold, size: 8 });
    drawText(`: ${transportText.slice(0, 24)}`, colSplit + 68, rY2 - 13, { font: fontBold, size: 8 });

    // Vertical line dividing customer & order meta
    drawLine(colSplit, detailsTopY, colSplit, detailsBottomY, 0.75);

    y = detailsBottomY;
    drawLine(margin, y, width - margin, y, 1);

    // ══════════════════════════════════════════════════════════════════
    // 4. ITEMS TABLE (Columns matching physical invoice)
    // ══════════════════════════════════════════════════════════════════
    // Columns:
    // SrNo (24), Product Design No. (132), HSN/SAC (40), Size (50), Color (78), Set (38), Qty (54), Rate (54), Amount (contentWidth - rest)
    const colW = [24, 132, 40, 50, 78, 38, 54, 54];
    const colX: number[] = [margin];
    for (let i = 0; i < colW.length; i++) {
      colX.push(colX[i] + colW[i]);
    }
    colX.push(width - margin); // End at right margin

    // Table Header
    const thHeight = 16;
    y -= thHeight;
    const thTextY = y + 4.5;

    drawText("SrNo", colX[0] + 3, thTextY, { font: fontBold, size: 7.5 });
    drawText("Product Design No.", colX[1] + 4, thTextY, { font: fontBold, size: 7.5 });
    drawText("HSN/SAC", colX[2] + 4, thTextY, { font: fontBold, size: 7.5 });
    drawText("Size", colX[3] + 12, thTextY, { font: fontBold, size: 7.5 });
    drawText("Color", colX[4] + 14, thTextY, { font: fontBold, size: 7.5 });
    drawText("Set", colX[5] + 10, thTextY, { font: fontBold, size: 7.5 });
    drawText("Qty", colX[6] + 16, thTextY, { font: fontBold, size: 7.5 });
    drawText("Rate", colX[7] + 14, thTextY, { font: fontBold, size: 7.5 });
    drawText("Amount", colX[8] + 16, thTextY, { font: fontBold, size: 7.5 });

    // Header vertical dividers
    for (let i = 1; i < colX.length - 1; i++) {
      drawLine(colX[i], y + thHeight, colX[i], y, 0.75);
    }
    drawLine(margin, y, width - margin, y, 1);

    // Table Body Rows
    const tableTopY = y;
    let currentY = y;

    const isWithoutGst =
      (order as any).gstRate === 0 ||
      (order as any).businessType === "WHOLESALER WITHOUT GST" ||
      (order as any).businessType === "WHOLESALE WITHOUT GST" ||
      (order as any).businessType === "RETAILER WITHOUT GST" ||
      (order as any).businessType === "RETAILER (WITHOUT GST)" ||
      String((order as any).businessType || "").toUpperCase().includes("WITHOUT GST") ||
      order.customer?.businessType === "WHOLESALER WITHOUT GST" ||
      order.customer?.businessType === "WHOLESALE WITHOUT GST" ||
      order.customer?.businessType === "RETAILER WITHOUT GST" ||
      order.customer?.businessType === "RETAILER (WITHOUT GST)" ||
      String(order.customer?.businessType || "").toUpperCase().includes("WITHOUT GST");

    const expandedRows = expandOrderItemsForInvoice(displayItems);

    resolvedTotalSets = expandedRows.reduce((s, r) => s + (Number(r.totalSets) || 0), 0);
    resolvedTotalPcs = expandedRows.reduce((s, r) => s + (Number(r.totalPcs) || 0), 0);
    resolvedSubtotal = expandedRows.reduce((s, r) => s + (Number(r.itemSubtotal) || 0), 0);
    resolvedGst = isWithoutGst ? 0 : Math.round(resolvedSubtotal * 0.05 * 100) / 100;
    resolvedGrandTotal = Math.round(resolvedSubtotal + resolvedGst);

    expandedRows.forEach((row: any, index: number) => {
      const origItem = row.originalItem || row;
      // Resolve product information for color wholesale alphabet mapping
      const prod =
        row.product ||
        origItem.product ||
        productByItem.get(origItem.productId) ||
        productByItem.get(String(row.productName || origItem.productName || "").toLowerCase().trim());
      const colorMapping = prod?.colorMapping || origItem.colorMapping;
      const colorsAvailable = prod?.colorsAvailable || origItem.colorsAvailable;

      // Color lines formatted as A: 2 Sets or 34 - 2 etc.
      const colorLines =
        Array.isArray(row.colorWiseLines) && row.colorWiseLines.length > 0
          ? row.colorWiseLines
          : formatColorAlphabetLines(origItem.colorSets, colorMapping, colorsAvailable);
      const colorLinesCount = Math.max(1, colorLines.length);

      const lineSpacing = 9;
      // Row height fits the content compactly
      const rowHeight = Math.max(22, 12 + colorLinesCount * lineSpacing);
      const rowBottomY = currentY - rowHeight;
      const rowTextTopY = currentY - 10;

      // 1. SrNo
      drawText(String(index + 1), colX[0] + 8, rowTextTopY, { size: 7.5 });

      // 2. Product Design No. & Ratio
      const resolvedMrp = row.mrp || prod?.mrp || origItem.mrp;
      const resolvedFallbackPrice = prod?.retailerPrice || prod?.price || row.unitPrice || origItem.unitPrice;
      const formattedProdName = formatProductNameWithMrp(
        row.productName || origItem.productName,
        resolvedMrp,
        resolvedFallbackPrice
      );
      drawText(formattedProdName.slice(0, 26), colX[1] + 4, rowTextTopY, { font: fontBold, size: 7.5 });

      // Only show ratio below product name if not a mix row and showRatioBelowName is true
      if (row.showRatioBelowName && !row.isMixRow) {
        const ratio = String(row.sizeRatio || origItem.sizeRatio || prod?.sizeRatio || "30 to 38");
        drawText(`Ratio: ${ratio}`, colX[1] + 4, rowTextTopY - 9, { size: 7, color: rgb(0.2, 0.2, 0.2) });
      }

      // 3. HSN/SAC
      const hsn = String(row.hsnCode || origItem.hsnCode || prod?.hsnCode || tpl.defaultHsn || "6203");
      drawText(hsn, colX[2] + 8, rowTextTopY, { size: 7.5 });

      // 4. Size
      const sizeVal = row.isMixRow ? "Mix Sizes" : String(row.sizeRatio || origItem.sizeRatio || prod?.sizeRatio || "30 to 38");
      drawText(sizeVal, colX[3] + 6, rowTextTopY, { size: 7.5 });

      // 5. Color lines
      colorLines.forEach((cLine: string, cIdx: number) => {
        drawText(cLine, colX[4] + 4, rowTextTopY - cIdx * lineSpacing, {
          font: fontBold,
          size: 7,
          color: rgb(0.15, 0.15, 0.15),
        });
      });

      // 6. Set
      const setsVal =
        row.isMixRow || row.totalSets === null || row.totalSets === undefined || row.totalSets === 0
          ? "—"
          : Number(row.totalSets).toFixed(2);
      drawText(setsVal, colX[5] + 8, rowTextTopY, { font: fontBold, size: 7.5 });

      // 7. Qty (PCS)
      const pcsVal = `${Number(row.totalPcs || 0).toFixed(2)} PCS`;
      drawText(pcsVal, colX[6] + 4, rowTextTopY, { font: fontBold, size: 7.5 });

      // 8. Rate
      const rateVal = Number(row.unitPrice || 0).toFixed(2);
      drawText(rateVal, colX[7] + 8, rowTextTopY, { size: 7.5 });

      // 9. Amount
      const amtVal = Number(row.itemSubtotal || 0).toFixed(2);
      const amtW = fontBold.widthOfTextAtSize(amtVal, 7.5);
      drawText(amtVal, colX[9] - amtW - 6, rowTextTopY, { font: fontBold, size: 7.5 });

      // Row bottom divider
      drawLine(margin, rowBottomY, width - margin, rowBottomY, 0.5);

      // Vertical dividers for this row
      for (let i = 1; i < colX.length - 1; i++) {
        drawLine(colX[i], currentY, colX[i], rowBottomY, 0.5);
      }

      currentY = rowBottomY;
    });

    // ══════════════════════════════════════════════════════════════════
    // 5. SUB TOTAL ROW (Aligned perfectly with table columns)
    // ══════════════════════════════════════════════════════════════════
    const subtotalH = 15;
    const subtotalBottomY = currentY - subtotalH;
    const subTextY = currentY - 11;

    // GSTIN No on left
    drawText(`GSTIN No. : ${tpl.gstNo || "24LAAPS9916E1ZD"}`, colX[0] + 6, subTextY, { font: fontBold, size: 7.5 });

    // Total Qty PCS
    const totalPcsStr = Number(resolvedTotalPcs).toFixed(3);
    drawText(totalPcsStr, colX[6] + 8, subTextY, { font: fontBold, size: 7.5 });

    // SUB TOTAL label
    drawText("SUB TOTAL", colX[7] + 2, subTextY, { font: fontBold, size: 7.5 });

    // Subtotal amount
    const subtotalValStr = Number(resolvedSubtotal).toFixed(2);
    const subValW = fontBold.widthOfTextAtSize(subtotalValStr, 7.5);
    drawText(subtotalValStr, colX[9] - subValW - 6, subTextY, { font: fontBold, size: 7.5 });

    // Vertical dividers for subtotal row
    drawLine(colX[6], currentY, colX[6], subtotalBottomY, 0.5);
    drawLine(colX[7], currentY, colX[7], subtotalBottomY, 0.5);
    drawLine(colX[8], currentY, colX[8], subtotalBottomY, 0.5);
    drawLine(margin, subtotalBottomY, width - margin, subtotalBottomY, 1);

    currentY = subtotalBottomY;

    // ══════════════════════════════════════════════════════════════════
    // 6. BANK DETAILS (LEFT) & TAX CALCULATION (RIGHT)
    // ══════════════════════════════════════════════════════════════════
    const summaryHeight = 60;
    const summaryBottomY = currentY - summaryHeight;
    const summarySplitX = colSplit;

    // Bank Details (Left)
    let bY = currentY - 12;
    drawText("Bank Name", margin + 8, bY, { font: fontBold, size: 7.5 });
    drawText(`: ${tpl.bankName || "ICICI BANK"}`, margin + 82, bY, { font: fontBold, size: 7.5 });

    bY -= 11;
    drawText("Bank A/c. No.", margin + 8, bY, { font: fontBold, size: 7.5 });
    drawText(`: ${tpl.accountNo || "750705000692"}`, margin + 82, bY, { font: fontBold, size: 7.5 });

    bY -= 11;
    drawText("RTGS/IFSC Code", margin + 8, bY, { font: fontBold, size: 7.5 });
    drawText(`: ${tpl.ifscCode || "ICIC0007507"}`, margin + 82, bY, { font: fontBold, size: 7.5 });

    // Tax Breakdown (Right)
    const rightColW = width - margin - summarySplitX;
    const halfGst = Math.round((resolvedGst / 2) * 100) / 100;

    let sY = currentY - 12;
    drawText("Taxable Amount", summarySplitX + 8, sY, { size: 7.5 });
    const taxAmtStr = Number(resolvedSubtotal).toFixed(2);
    const taxAmtW = fontRegular.widthOfTextAtSize(taxAmtStr, 7.5);
    drawText(taxAmtStr, width - margin - taxAmtW - 8, sY, { size: 7.5 });

    if (isWithoutGst) {
      sY -= 11;
      drawText("GST (0%)", summarySplitX + 8, sY, { size: 7.5 });
      const zeroGstStr = "0.00";
      const zeroGstW = fontRegular.widthOfTextAtSize(zeroGstStr, 7.5);
      drawText(zeroGstStr, width - margin - zeroGstW - 8, sY, { size: 7.5 });
    } else {
      sY -= 11;
      drawText("Central Tax 2.50%", summarySplitX + 8, sY, { size: 7.5 });
      const cgstStr = Number(halfGst).toFixed(2);
      const cgstW = fontRegular.widthOfTextAtSize(cgstStr, 7.5);
      drawText(cgstStr, width - margin - cgstW - 8, sY, { size: 7.5 });

      sY -= 11;
      drawText("State/UT Tax 2.50%", summarySplitX + 8, sY, { size: 7.5 });
      const sgstStr = Number(halfGst).toFixed(2);
      const sgstW = fontRegular.widthOfTextAtSize(sgstStr, 7.5);
      drawText(sgstStr, width - margin - sgstW - 8, sY, { size: 7.5 });
    }

    sY -= 14;
    // Grand Total Bar
    drawLine(summarySplitX, sY + 11, width - margin, sY + 11, 0.75);
    drawText("GRAND TOTAL", summarySplitX + 8, sY, { font: fontBold, size: 9 });
    const gTotStr = `Rs. ${resolvedGrandTotal.toLocaleString("en-IN")}`;
    const gTotW = fontBold.widthOfTextAtSize(gTotStr, 10);
    drawText(gTotStr, width - margin - gTotW - 8, sY, { font: fontBold, size: 10 });

    // Vertical line between Bank details and Tax breakdown
    drawLine(summarySplitX, currentY, summarySplitX, summaryBottomY, 0.75);
    drawLine(margin, summaryBottomY, width - margin, summaryBottomY, 1);

    currentY = summaryBottomY;

    // ══════════════════════════════════════════════════════════════════
    // 7. PAYMENT NOTE BAR
    // ══════════════════════════════════════════════════════════════════
    const noteHeight = 15;
    const noteBottomY = currentY - noteHeight;
    const noteText = String(
      tpl.note || "NOTE : PAYMENT EVERY WEEK AND SHOULD BE COMPLETED WITHIN 90 DAYS."
    );
    drawText(noteText, margin + 8, currentY - 11, { font: fontBold, size: 7.5 });
    drawLine(margin, noteBottomY, width - margin, noteBottomY, 1);

    currentY = noteBottomY;

    // ══════════════════════════════════════════════════════════════════
    // 8. TERMS & CONDITIONS (LEFT) & AUTHORISED SIGNATORY (RIGHT)
    // ══════════════════════════════════════════════════════════════════
    const footerHeight = 65;
    const footerBottomY = currentY - footerHeight;
    const sigSplitX = margin + contentWidth * 0.65;

    // Terms on Left
    let tY = currentY - 11;
    drawText("TERMS & CONDITION :", margin + 8, tY, { font: fontBold, size: 7.5 });
    tY -= 9.5;
    drawText(String(tpl.terms1 || "1. Goods once sold will not be taken back.").slice(0, 78), margin + 8, tY, { size: 6.5 });
    tY -= 8.5;
    drawText(String(tpl.terms2 || "2. Interest @18% p.a. will be charged if payment is not made within due date.").slice(0, 78), margin + 8, tY, { size: 6.5 });
    tY -= 8.5;
    drawText(String(tpl.terms3 || "3. Our risk and responsibility ceases as soon as the goods leave our premises.").slice(0, 78), margin + 8, tY, { size: 6.5 });
    tY -= 8.5;
    drawText(String(tpl.terms4 || '4. "Subject to \'AHMEDABAD\' Jurisdiction only. E.&.O.E"').slice(0, 78), margin + 8, tY, { size: 6.5 });
    tY -= 8.5;
    drawText(String(tpl.terms5 || "5. Any damages or problem in any products should be informed within 7 days of purchase.").slice(0, 78), margin + 8, tY, {
      font: fontBold,
      size: 6.5,
    });

    // Signature on Right
    drawLine(sigSplitX, currentY, sigSplitX, footerBottomY, 0.75);

    const sigCompany = `FOR, ${String(tpl.companyName || "KRISH CLOTHING CO.").toUpperCase()}`;
    const sigCompanyW = fontBold.widthOfTextAtSize(sigCompany, 8);
    drawText(sigCompany, width - margin - sigCompanyW - 12, currentY - 12, { font: fontBold, size: 8 });

    // Draw Signature Image if available
    if (signatureImage) {
      try {
        const sigImgW = 85;
        const sigImgH = 34;
        const sigImgX = width - margin - sigImgW - 14;
        const sigImgY = currentY - 48;
        page.drawImage(signatureImage, {
          x: sigImgX,
          y: sigImgY,
          width: sigImgW,
          height: sigImgH,
        });
      } catch (err) {
        console.warn("Error drawing signature image:", err);
      }
    }

    const authLabel = String(tpl.signatoryTitle || "(Authorised Signatory)");
    const authLabelW = fontRegular.widthOfTextAtSize(authLabel, 7.5);
    drawText(authLabel, width - margin - authLabelW - 16, footerBottomY + 6, { font: fontBold, size: 7.5 });

    // Bottom horizontal line of footer
    drawLine(margin, footerBottomY, width - margin, footerBottomY, 1);

    currentY = footerBottomY;

    // ══════════════════════════════════════════════════════════════════
    // 9. OUTER BORDER (TIGHT FIT: ONLY AROUND BILL CONTENT)
    // ══════════════════════════════════════════════════════════════════
    // Instead of stretching to the full A4 page, the box height is
    // exactly the bill's natural content height (startTopY - currentY).
    const billBoxHeight = startTopY - currentY;
    drawRect(margin, currentY, contentWidth, billBoxHeight, undefined, 1.25);

    // Serialize PDF to bytes
    const pdfBytes = await pdfDoc.save();

    const fileName = `${isTaxInvoice ? "Tax_Invoice" : "Order_Form"}_${docNo.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch (error: any) {
    console.error("PDF generation error:", error);
    return NextResponse.json({ error: "Failed to generate PDF: " + error.message }, { status: 500 });
  }
}
