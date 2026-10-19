import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatColorAlphabetLines, formatProductNameWithMrp } from "@/lib/utils";
import { getInvoiceTemplateSettings } from "@/lib/invoice-template";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const formatType = searchParams.get("type") === "tax_invoice" ? "TAX_INVOICE" : "ORDER_FORM";

    const orderId = parseInt(id, 10);
    const order = await prisma.order.findFirst({
      where: {
        OR: [
          ...(isNaN(orderId) ? [] : [{ id: orderId }]),
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

    // Margins
    const margin = 36;
    const contentWidth = width - margin * 2;
    let y = height - margin;

    // Helper: draw text
    const drawText = (
      text: string,
      xPos: number,
      yPos: number,
      options: { font?: any; size?: number; color?: any } = {}
    ) => {
      const f = options.font || fontRegular;
      const s = options.size || 9;
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
    const drawRect = (xPos: number, yPos: number, w: number, h: number, fillColor?: any) => {
      page.drawRectangle({
        x: xPos,
        y: yPos,
        width: w,
        height: h,
        borderWidth: 1,
        borderColor: rgb(0, 0, 0),
        color: fillColor || undefined,
      });
    };

    // Outer border around the page
    const boxHeight = height - margin * 2;
    drawRect(margin, margin, contentWidth, boxHeight);

    // 1. TOP HEADER: KRISH CLOTHING CO.
    y = height - margin - 20;
    const headerTitle = String(tpl.companyName || "KRISH CLOTHING CO.").toUpperCase();
    const titleWidth = fontBold.widthOfTextAtSize(headerTitle, 16);
    drawText(headerTitle, margin + (contentWidth - titleWidth) / 2, y, { font: fontBold, size: 16 });

    y -= 12;
    const subTitle = `${tpl.addressLine1 || ""} ${tpl.addressLine2 || ""}`.trim() || "Samet Business Park, Khokhra Circle, Maninagar, Ahmedabad - 380008, Gujarat";
    const subTitleWidth = fontRegular.widthOfTextAtSize(subTitle, 7.5);
    drawText(subTitle, margin + (contentWidth - subTitleWidth) / 2, y, { size: 7.5, color: rgb(0.2, 0.2, 0.2) });

    y -= 11;
    const contactLine = `Mobile: ${tpl.phone || "+91 8128756632"}  |  Email: ${tpl.email || "krishclothingco3@gmail.com"}`;
    const contactLineWidth = fontRegular.widthOfTextAtSize(contactLine, 8);
    drawText(contactLine, margin + (contentWidth - contactLineWidth) / 2, y, { size: 8 });

    y -= 11;
    const gstinLine = `GSTIN: ${tpl.gstNo || "24LAAPS9916E1ZD"}    PAN: ${tpl.panNo || "LAAPS9916E"}`;
    const gstinLineWidth = fontBold.widthOfTextAtSize(gstinLine, 8);
    drawText(gstinLine, margin + (contentWidth - gstinLineWidth) / 2, y, { font: fontBold, size: 8 });

    // Divider line
    y -= 10;
    drawLine(margin, y, width - margin, y, 1);

    // 2. DOCUMENT TITLE BAR (TAX INVOICE / ORDER FORM)
    const titleBarHeight = 22;
    y -= titleBarHeight;
    page.drawRectangle({
      x: margin,
      y,
      width: contentWidth,
      height: titleBarHeight,
      color: rgb(0.92, 0.94, 0.96),
    });
    const docTitleWidth = fontBold.widthOfTextAtSize(docTitle, 11);
    drawText(docTitle, margin + (contentWidth - docTitleWidth) / 2, y + 6, {
      font: fontBold,
      size: 11,
      color: rgb(0.1, 0.1, 0.1),
    });
    drawLine(margin, y, width - margin, y, 1);

    // 3. INVOICE META & CUSTOMER DETAILS SECTION
    const detailsTopY = y;
    const detailsHeight = 85;
    const colSplit = margin + contentWidth * 0.58;

    // Vertical divider between customer info and invoice meta
    drawLine(colSplit, detailsTopY, colSplit, detailsTopY - detailsHeight, 0.75);

    // Left Column: Customer (Billed To)
    let leftY = detailsTopY - 14;
    drawText("BILLED TO (CUSTOMER / FIRM):", margin + 10, leftY, { font: fontBold, size: 8, color: rgb(0.4, 0.4, 0.4) });
    leftY -= 12;
    const custName = (order.customer?.shopName || order.customerName || "RETAIL CUSTOMER").toUpperCase();
    drawText(custName.slice(0, 42), margin + 10, leftY, { font: fontBold, size: 10 });
    leftY -= 12;
    const custAddress = (order.customer?.address || order.customerAddress || "Address on File").toUpperCase();
    drawText(custAddress.slice(0, 52), margin + 10, leftY, { size: 8 });
    leftY -= 11;
    const custCityState = `${order.customer?.city || "AHMEDABAD"}, ${order.customer?.state || "GUJARAT"}`.toUpperCase();
    drawText(custCityState, margin + 10, leftY, { size: 8 });
    leftY -= 11;
    const custPhone = `Phone: ${order.customer?.phoneNumber || order.customerPhone || "—"}`;
    drawText(custPhone, margin + 10, leftY, { size: 8 });
    leftY -= 11;
    const custGst = `GST/PAN: ${(order.customer?.gstPanNo || order.customerGstPan || "UNREGISTERED").toUpperCase()}`;
    drawText(custGst, margin + 10, leftY, { font: fontBold, size: 8 });

    // Right Column: Invoice / Order Meta
    let rightY = detailsTopY - 14;
    drawText(`${isTaxInvoice ? "Tax Invoice No:" : "Order No:"}`, colSplit + 10, rightY, { font: fontBold, size: 8 });
    drawText(docNo, colSplit + 95, rightY, { font: fontBold, size: 9 });

    rightY -= 13;
    const formattedDate = docDate ? new Date(docDate).toLocaleDateString("en-IN") : new Date().toLocaleDateString("en-IN");
    drawText("Date:", colSplit + 10, rightY, { font: fontBold, size: 8 });
    drawText(formattedDate, colSplit + 95, rightY, { size: 8 });

    rightY -= 13;
    drawText("Payment Terms:", colSplit + 10, rightY, { font: fontBold, size: 8 });
    const creditTerms = (order.creditDays || order.customer?.creditDays || 0) > 0
      ? `${order.creditDays || order.customer?.creditDays} Days Credit`
      : "Advance Payment";
    drawText(creditTerms, colSplit + 95, rightY, { size: 8 });

    rightY -= 13;
    let transportText = "Direct Transport";
    if (order.notes && order.notes.includes("[TRANSPORT:")) {
      const match = order.notes.match(/\[TRANSPORT:\s*([^\]|]+)/i);
      if (match && match[1]) transportText = match[1].trim();
    }
    drawText("Transport:", colSplit + 10, rightY, { font: fontBold, size: 8 });
    drawText(transportText.slice(0, 22), colSplit + 95, rightY, { size: 8 });

    rightY -= 13;
    drawText("Status:", colSplit + 10, rightY, { font: fontBold, size: 8 });
    drawText(order.status.toUpperCase(), colSplit + 95, rightY, { font: fontBold, size: 8 });

    y -= detailsHeight;
    drawLine(margin, y, width - margin, y, 1);

    // 4. ITEMS TABLE
    // Columns: # (24), Description (200), Ratio (70), Sets (40), PCS (45), Rate (65), Amount (79)
    const colX = [
      margin,
      margin + 26,
      margin + 230,
      margin + 300,
      margin + 345,
      margin + 395,
      margin + 460,
      width - margin,
    ];

    // Table Header
    const thHeight = 20;
    y -= thHeight;
    page.drawRectangle({
      x: margin,
      y,
      width: contentWidth,
      height: thHeight,
      color: rgb(0.94, 0.94, 0.94),
    });

    drawText("#", colX[0] + 8, y + 6, { font: fontBold, size: 8 });
    drawText("DESCRIPTION & COLOR SETS", colX[1] + 6, y + 6, { font: fontBold, size: 8 });
    drawText("SIZE RATIO", colX[2] + 6, y + 6, { font: fontBold, size: 8 });
    drawText("SETS", colX[3] + 8, y + 6, { font: fontBold, size: 8 });
    drawText("PCS", colX[4] + 12, y + 6, { font: fontBold, size: 8 });
    drawText("RATE / PC", colX[5] + 10, y + 6, { font: fontBold, size: 8 });
    drawText("AMOUNT (Rs.)", colX[6] + 6, y + 6, { font: fontBold, size: 8 });

    // Vertical lines for header
    for (let i = 1; i < colX.length - 1; i++) {
      drawLine(colX[i], y + thHeight, colX[i], y, 0.75);
    }
    drawLine(margin, y, width - margin, y, 1);

    // Table Rows
    const tableTopY = y;
    let currentY = y;

    displayItems.forEach((item: any, index: number) => {
      // Resolve product information for color wholesale alphabet mapping
      const prod =
        (item as any).product ||
        productByItem.get(item.productId) ||
        productByItem.get(String(item.productName || "").toLowerCase().trim());
      const colorMapping = prod?.colorMapping || (item as any).colorMapping;
      const colorsAvailable = prod?.colorsAvailable || (item as any).colorsAvailable;

      // Format each color's wholesale alphabet and sets (each on next line)
      const colorLines = formatColorAlphabetLines(item.colorSets, colorMapping, colorsAvailable);
      const colorLinesCount = colorLines.length;

      const lineSpacing = colorLinesCount > 4 ? 9.5 : 10.5;
      const rowHeight = Math.max(28, 16 + colorLinesCount * lineSpacing);
      currentY -= rowHeight;

      const topY = currentY + rowHeight - 12;

      // Draw item details
      drawText(String(index + 1), colX[0] + 8, topY, { size: 8 });

      // Product Name with MRP in bracket: e.g. "IMP - 003 (1770)"
      const resolvedMrp = prod?.mrp || (item as any).mrp;
      const resolvedFallbackPrice = prod?.retailerPrice || prod?.price || item.unitPrice;
      const formattedProdName = formatProductNameWithMrp(
        item.productName,
        resolvedMrp,
        resolvedFallbackPrice
      );
      const prodName = formattedProdName.slice(0, 42);
      drawText(prodName, colX[1] + 6, topY, { font: fontBold, size: 8 });

      // Each color wholesale alphabet entry on the next line
      colorLines.forEach((line, lIdx) => {
        const lineY = topY - 11 - lIdx * lineSpacing;
        drawText(line, colX[1] + 6, lineY, {
          font: fontBold,
          size: 7.5,
          color: rgb(0.2, 0.2, 0.2),
        });
      });

      // Size Ratio
      const ratio = String(item.sizeRatio || "30 to 38");
      drawText(ratio, colX[2] + 6, topY, { size: 8 });

      // Sets
      drawText(String(item.totalSets || 0), colX[3] + 12, topY, { font: fontBold, size: 8 });

      // PCS
      drawText(String(item.totalPcs || 0), colX[4] + 14, topY, { font: fontBold, size: 8 });

      // Unit Price
      const unitPriceStr = `Rs. ${Number(item.unitPrice || 0).toLocaleString("en-IN")}`;
      drawText(unitPriceStr, colX[5] + 8, topY, { size: 8 });

      // Amount
      const subtotalStr = `Rs. ${Number(item.itemSubtotal || 0).toLocaleString("en-IN")}`;
      drawText(subtotalStr, colX[6] + 8, topY, { font: fontBold, size: 8 });

      // Row separator
      drawLine(margin, currentY, width - margin, currentY, 0.5);
    });

    // Minimum table height fill
    const minTableHeight = 160;
    const actualHeight = tableTopY - currentY;
    if (actualHeight < minTableHeight) {
      currentY = tableTopY - minTableHeight;
    }

    // Vertical lines across all table rows
    for (let i = 1; i < colX.length - 1; i++) {
      drawLine(colX[i], tableTopY, colX[i], currentY, 0.75);
    }
    drawLine(margin, currentY, width - margin, currentY, 1);

    // 5. SUMMARY TOTALS & BANK DETAILS
    const summaryTopY = currentY;
    const summaryHeight = 110;
    const totalsSplitX = colX[4]; // Align totals to PCS column

    // Bank Details on Left
    let bankY = summaryTopY - 14;
    drawText("BANK ACCOUNT DETAILS FOR PAYMENT:", margin + 10, bankY, { font: fontBold, size: 8 });
    bankY -= 12;
    drawText(`Bank Name: ${tpl.bankName || "ICICI BANK"}`, margin + 10, bankY, { size: 8 });
    bankY -= 11;
    drawText(`Account No: ${tpl.accountNo || "750705000692"}`, margin + 10, bankY, { font: fontBold, size: 8 });
    bankY -= 11;
    drawText(`IFSC Code: ${tpl.ifscCode || "ICIC0007507"}`, margin + 10, bankY, { size: 8 });
    bankY -= 11;
    drawText(`Beneficiary: ${tpl.beneficiaryName || tpl.companyName || "KRISH CLOTHING CO."}`, margin + 10, bankY, { size: 8 });
    bankY -= 11;
    drawText(`Branch: ${tpl.branch || "Khokhra Maninagar, Ahmedabad"}`, margin + 10, bankY, { size: 8 });

    // Vertical line between Bank details and Totals
    drawLine(totalsSplitX, summaryTopY, totalsSplitX, summaryTopY - summaryHeight, 0.75);

    // Totals on Right
    let totY = summaryTopY - 14;
    drawText("Total Sets:", totalsSplitX + 8, totY, { size: 8 });
    drawText(String(resolvedTotalSets), colX[6] + 8, totY, { font: fontBold, size: 8 });

    totY -= 13;
    drawText("Total Pieces (PCS):", totalsSplitX + 8, totY, { size: 8 });
    drawText(String(resolvedTotalPcs), colX[6] + 8, totY, { font: fontBold, size: 8 });

    totY -= 13;
    drawText("Subtotal (Taxable):", totalsSplitX + 8, totY, { size: 8 });
    drawText(`Rs. ${resolvedSubtotal.toLocaleString("en-IN")}`, colX[6] + 8, totY, { font: fontBold, size: 8 });

    totY -= 13;
    const halfGst = Math.round((resolvedGst / 2) * 100) / 100;
    drawText("CGST (2.5%):", totalsSplitX + 8, totY, { size: 8 });
    drawText(`Rs. ${halfGst.toLocaleString("en-IN")}`, colX[6] + 8, totY, { size: 8 });

    totY -= 13;
    drawText("SGST (2.5%):", totalsSplitX + 8, totY, { size: 8 });
    drawText(`Rs. ${halfGst.toLocaleString("en-IN")}`, colX[6] + 8, totY, { size: 8 });

    totY -= 16;
    drawLine(totalsSplitX, totY + 12, width - margin, totY + 12, 1);
    page.drawRectangle({
      x: totalsSplitX,
      y: totY - 4,
      width: width - margin - totalsSplitX,
      height: 18,
      color: rgb(0.92, 0.94, 0.96),
    });
    drawText("GRAND TOTAL:", totalsSplitX + 8, totY + 1, { font: fontBold, size: 9 });
    drawText(`Rs. ${resolvedGrandTotal.toLocaleString("en-IN")}`, colX[6] + 8, totY + 1, {
      font: fontBold,
      size: 10,
      color: rgb(0.1, 0.4, 0.1),
    });

    currentY = summaryTopY - summaryHeight;
    drawLine(margin, currentY, width - margin, currentY, 1);

    // 6. TERMS & SIGNATURE SECTION
    const footerTopY = currentY;
    const footerHeight = 70;
    const sigSplitX = margin + contentWidth * 0.65;

    // Terms on Left
    let termY = footerTopY - 14;
    drawText("TERMS & CONDITIONS:", margin + 10, termY, { font: fontBold, size: 7.5 });
    termY -= 10;
    drawText(String(tpl.terms1 || "1. Goods once sold will not be taken back without valid Return Invoice.").slice(0, 80), margin + 10, termY, { size: 7 });
    termY -= 9;
    drawText(String(tpl.terms2 || `2. Payment strictly due within ${creditTerms}. Weekly payments expected.`).slice(0, 80), margin + 10, termY, { size: 7 });
    termY -= 9;
    drawText(String(tpl.terms3 || "3. Interest @ 18% p.a. will be charged on overdue payments beyond credit limit.").slice(0, 80), margin + 10, termY, { size: 7 });
    termY -= 9;
    drawText(String(tpl.terms4 || "4. Subject to Ahmedabad jurisdiction only.").slice(0, 80), margin + 10, termY, { size: 7 });

    // Signature on Right
    drawLine(sigSplitX, footerTopY, sigSplitX, margin, 0.75);
    drawText(String(tpl.signatoryLabel || "For, KRISH CLOTHING CO.").slice(0, 32), sigSplitX + 15, footerTopY - 16, { font: fontBold, size: 8 });
    drawText(String(tpl.signatoryTitle || "(Authorised Signatory)").slice(0, 32), sigSplitX + 22, margin + 10, { size: 8 });

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
