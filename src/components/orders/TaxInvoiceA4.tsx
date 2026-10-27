"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  formatCurrency,
  formatColorAlphabetLines,
  formatProductNameWithMrp,
  expandOrderItemsForInvoice,
  type ExpandedInvoiceRow,
} from "@/lib/utils";
import {
  DEFAULT_INVOICE_TEMPLATE,
  type InvoiceTemplateSettings,
} from "@/lib/invoice-template-types";
import {
  Edit3,
  Check,
  RotateCcw,
  Plus,
  Trash2,
  Save,
  Printer,
  Sparkles,
} from "lucide-react";

export interface TaxInvoiceItem {
  id?: number;
  productName: string;
  mrp?: number | null;
  product?: any;
  colorSets?: any;
  colorMapping?: string | null;
  colorsAvailable?: string | null;
  sizeRatio?: string;
  pcsPerSet?: number;
  totalSets?: number;
  totalPcs?: number;
  unitPrice?: number;
  itemSubtotal?: number;
  hsnCode?: string;
  notes?: string | null;
  mixSizes?: string | null;
  mixPcs?: number | null;
  colorMixPcs?: any;
  isMixRow?: boolean;
  particularSize?: string;
}

export interface TaxInvoiceOrder {
  orderNumber: string;
  orderDate: string | Date;
  status?: string;
  taxInvoiceNumber?: string | null;
  taxInvoiceDate?: string | Date | null;
  customerName: string;
  customerGstPan?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  customerCity?: string | null;
  customerState?: string | null;
  businessType?: string | null;
  customer?: any;
  creditDays?: number;
  subtotal: number;
  gstRate?: number;
  gstAmount: number;
  grandTotal: number;
  totalPcs: number;
  totalSets: number;
  placedBy?: string | null;
  notes?: string | null;
  transportName?: string | null;
  templateOverrides?: any;
  items: TaxInvoiceItem[];
}

interface TaxInvoiceA4Props {
  order: TaxInvoiceOrder;
  copyTitle?: string;
  formatType?: "ORDER_FORM" | "TAX_INVOICE";
  allowInlineEdit?: boolean;
  onSaveOverrides?: (overrides: Record<string, any>) => Promise<void> | void;
}

export default function TaxInvoiceA4({
  order,
  copyTitle = "Original",
  formatType,
  allowInlineEdit = true,
  onSaveOverrides,
}: TaxInvoiceA4Props) {
  // Determine whether this document should render as TAX INVOICE or ORDER FORM
  const isTaxInvoice =
    formatType === "TAX_INVOICE" ||
    (!formatType &&
      (order.status === "Ready" ||
        order.status === "Dispatched" ||
        order.status === "Delivered" ||
        Boolean(order.taxInvoiceNumber)));

  const defaultTitle = isTaxInvoice ? "TAX INVOICE" : "ORDER FORM";
  const defaultNumberLabel = isTaxInvoice ? "Invoice No." : "Order No.";
  const defaultDocNumber = isTaxInvoice
    ? order.taxInvoiceNumber || order.orderNumber
    : order.orderNumber;

  // Active Date formatted as DD/MM/YYYY
  const activeDate = isTaxInvoice && order.taxInvoiceDate ? order.taxInvoiceDate : order.orderDate;
  const dateObj = activeDate ? new Date(activeDate) : new Date();
  const defaultFormattedDate = !isNaN(dateObj.getTime())
    ? `${String(dateObj.getDate()).padStart(2, "0")}/${String(dateObj.getMonth() + 1).padStart(
        2,
        "0"
      )}/${dateObj.getFullYear()}`
    : "";

  let defaultTransport = order.transportName || "";
  if (!defaultTransport && order.notes) {
    const match = order.notes.match(/\[TRANSPORT:\s*([^\]|]+)/i);
    if (match && match[1]) {
      defaultTransport = match[1].trim();
    }
  }

  // Edit Mode state
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Template / Header states
  const [template, setTemplate] = useState<InvoiceTemplateSettings>(DEFAULT_INVOICE_TEMPLATE);
  const [companyName, setCompanyName] = useState(DEFAULT_INVOICE_TEMPLATE.companyName);
  const [addressLine1, setAddressLine1] = useState(DEFAULT_INVOICE_TEMPLATE.addressLine1);
  const [addressLine2, setAddressLine2] = useState(DEFAULT_INVOICE_TEMPLATE.addressLine2);
  const [phone, setPhone] = useState(DEFAULT_INVOICE_TEMPLATE.phone);
  const [email, setEmail] = useState(DEFAULT_INVOICE_TEMPLATE.email);
  const [gstNo, setGstNo] = useState(DEFAULT_INVOICE_TEMPLATE.gstNo);
  const [panNo, setPanNo] = useState(DEFAULT_INVOICE_TEMPLATE.panNo);
  const [debitMemoText, setDebitMemoText] = useState("Debit Memo");
  const [docTitleText, setDocTitleText] = useState(defaultTitle);
  const [copyTitleText, setCopyTitleText] = useState(copyTitle);

  // Buyer / Customer states
  const [customerName, setCustomerName] = useState(order.customerName || "WALK-IN CUSTOMER");
  const [customerAddress, setCustomerAddress] = useState(order.customerAddress || "Direct Delivery");
  const [customerCity, setCustomerCity] = useState(order.customerCity || "AHMEDABAD");
  const [customerState, setCustomerState] = useState(order.customerState || "Gujarat");
  const [placeOfSupply, setPlaceOfSupply] = useState(DEFAULT_INVOICE_TEMPLATE.placeOfSupply);
  const [customerPhone, setCustomerPhone] = useState(order.customerPhone || "");
  const [customerGstPan, setCustomerGstPan] = useState(order.customerGstPan || "URP (Unregistered)");

  // Invoice Meta states
  const [numberLabel, setNumberLabel] = useState(defaultNumberLabel);
  const [docNumber, setDocNumber] = useState(defaultDocNumber);
  const [dateStr, setDateStr] = useState(defaultFormattedDate);
  const [transportName, setTransportName] = useState(defaultTransport || DEFAULT_INVOICE_TEMPLATE.defaultTransport);

  // Bank & Terms states
  const [bankName, setBankName] = useState(DEFAULT_INVOICE_TEMPLATE.bankName);
  const [accountNo, setAccountNo] = useState(DEFAULT_INVOICE_TEMPLATE.accountNo);
  const [ifscCode, setIfscCode] = useState(DEFAULT_INVOICE_TEMPLATE.ifscCode);
  const [creditDaysVal, setCreditDaysVal] = useState(order.creditDays !== undefined ? order.creditDays : 45);
  const [creditNotePrefix, setCreditNotePrefix] = useState(DEFAULT_INVOICE_TEMPLATE.creditNotePrefix);
  const [terms1, setTerms1] = useState(DEFAULT_INVOICE_TEMPLATE.terms1);
  const [terms2, setTerms2] = useState(DEFAULT_INVOICE_TEMPLATE.terms2);
  const [terms3, setTerms3] = useState(DEFAULT_INVOICE_TEMPLATE.terms3);
  const [terms4, setTerms4] = useState(DEFAULT_INVOICE_TEMPLATE.terms4);
  const [terms5, setTerms5] = useState(DEFAULT_INVOICE_TEMPLATE.terms5);
  const [signatoryLabel, setSignatoryLabel] = useState(DEFAULT_INVOICE_TEMPLATE.signatoryLabel);

  // Line items state
  const [items, setItems] = useState<TaxInvoiceItem[]>(order.items || []);

  // Fetch initial global template settings and order overrides
  useEffect(() => {
    fetch("/api/admin/invoice-settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setTemplate(data);
          let overrides: any = {};
          if (order.templateOverrides) {
            try {
              overrides =
                typeof order.templateOverrides === "string"
                  ? JSON.parse(order.templateOverrides)
                  : order.templateOverrides;
            } catch {}
          }
          const merged = { ...data, ...overrides };
          setCompanyName(merged.companyName || data.companyName);
          setAddressLine1(merged.addressLine1 || data.addressLine1);
          setAddressLine2(merged.addressLine2 || data.addressLine2);
          setPhone(merged.phone || data.phone);
          setEmail(merged.email || data.email);
          setGstNo(merged.gstNo || data.gstNo);
          setPanNo(merged.panNo || data.panNo);
          setPlaceOfSupply(merged.placeOfSupply || data.placeOfSupply);
          setBankName(merged.bankName || data.bankName);
          setAccountNo(merged.accountNo || data.accountNo);
          setIfscCode(merged.ifscCode || data.ifscCode);
          setTerms1(merged.terms1 || data.terms1);
          setTerms2(merged.terms2 || data.terms2);
          setTerms3(merged.terms3 || data.terms3);
          setTerms4(merged.terms4 || data.terms4);
          setTerms5(merged.terms5 || data.terms5);
          setCreditNotePrefix(merged.creditNotePrefix || data.creditNotePrefix);
          setSignatoryLabel(merged.signatoryLabel || data.signatoryLabel);
        }
      })
      .catch(() => {});
  }, [order.orderNumber, order.templateOverrides]);

  // Recalculate Totals
  const displayRows = useMemo(() => expandOrderItemsForInvoice(items), [items]);
  const totalPcs = useMemo(() => {
    return isEditing
      ? items.reduce((acc, it) => acc + (Number(it.totalPcs) || (Number(it.totalSets) || 0) * (it.pcsPerSet || 5)), 0)
      : displayRows.reduce((acc, it) => acc + (Number(it.totalPcs) || 0), 0);
  }, [isEditing, items, displayRows]);

  const totalSets = useMemo(() => {
    return isEditing
      ? items.reduce((acc, it) => acc + (Number(it.totalSets) || 0), 0)
      : displayRows.reduce((acc, it) => acc + (Number(it.totalSets) || 0), 0);
  }, [isEditing, items, displayRows]);

  const rawSubtotal = useMemo(() => {
    return isEditing
      ? items.reduce((acc, it) => acc + (Number(it.itemSubtotal) || (Number(it.totalPcs) || 0) * (Number(it.unitPrice) || 0)), 0)
      : displayRows.reduce((acc, it) => acc + (Number(it.itemSubtotal) || 0), 0);
  }, [isEditing, items, displayRows]);

  const isCashCustomer = Boolean(
    (order.customerName || order.customer?.shopName || "").toUpperCase().includes("CASH") ||
    String(order.businessType || order.customer?.businessType || "").toUpperCase().includes("CASH")
  );

  const isWithoutGst =
    order.gstRate === 0 ||
    order.businessType === "WHOLESALER WITHOUT GST" ||
    order.businessType === "WHOLESALE WITHOUT GST" ||
    order.businessType === "RETAILER WITHOUT GST" ||
    order.businessType === "RETAILER (WITHOUT GST)" ||
    String(order.businessType || "").toUpperCase().includes("WITHOUT GST") ||
    order.customer?.businessType === "WHOLESALER WITHOUT GST" ||
    order.customer?.businessType === "WHOLESALE WITHOUT GST" ||
    order.customer?.businessType === "RETAILER WITHOUT GST" ||
    order.customer?.businessType === "RETAILER (WITHOUT GST)" ||
    String(order.customer?.businessType || "").toUpperCase().includes("WITHOUT GST");

  let subtotal = Math.round(rawSubtotal);
  let gstAmount = 0;
  let grandTotal = subtotal;

  if (isCashCustomer) {
    // For Cash Customer: GST is inclusive inside the 600
    subtotal = Math.round(rawSubtotal / 1.05);
    gstAmount = Math.round(rawSubtotal) - subtotal;
    grandTotal = Math.round(rawSubtotal);
  } else if (!isWithoutGst) {
    gstAmount = Math.round(subtotal * 0.05);
    grandTotal = subtotal + gstAmount;
  }

  const cgst = Math.round(gstAmount / 2);
  const sgst = gstAmount - cgst;

  // No artificial filler rows to prevent stretching table height
  const emptyRowsCount = 0;

  // Handle Item Field Edit
  const handleItemChange = (index: number, field: keyof TaxInvoiceItem, value: any) => {
    const updated = [...items];
    const it = { ...updated[index], [field]: value };

    if (field === "unitPrice" || field === "totalPcs" || field === "totalSets" || field === "pcsPerSet") {
      const uPrice = Number(it.unitPrice) || 0;
      const pcs = Number(it.totalPcs) || (Number(it.totalSets) || 0) * (Number(it.pcsPerSet) || 5);
      it.totalPcs = pcs;
      it.itemSubtotal = Math.round(pcs * uPrice);
    }

    updated[index] = it;
    setItems(updated);
  };

  const handleAddItem = () => {
    const newItem: TaxInvoiceItem = {
      productName: "IMP - NEW ITEM",
      sizeRatio: "30 to 38",
      pcsPerSet: 5,
      totalSets: 1,
      totalPcs: 5,
      unitPrice: 490,
      itemSubtotal: 2450,
      hsnCode: template.defaultHsn || "6203",
    };
    setItems([...items, newItem]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      alert("At least one item must remain in invoice.");
      return;
    }
    setItems(items.filter((_, idx) => idx !== index));
  };

  const handleResetToTemplate = () => {
    if (confirm("Reset invoice header, bank, and terms to saved template defaults?")) {
      setCompanyName(template.companyName);
      setAddressLine1(template.addressLine1);
      setAddressLine2(template.addressLine2);
      setPhone(template.phone);
      setEmail(template.email);
      setGstNo(template.gstNo);
      setPanNo(template.panNo);
      setPlaceOfSupply(template.placeOfSupply);
      setBankName(template.bankName);
      setAccountNo(template.accountNo);
      setIfscCode(template.ifscCode);
      setTerms1(template.terms1);
      setTerms2(template.terms2);
      setTerms3(template.terms3);
      setTerms4(template.terms4);
      setTerms5(template.terms5);
      setCreditNotePrefix(template.creditNotePrefix);
      setSignatoryLabel(template.signatoryLabel);
      setTransportName(template.defaultTransport);
    }
  };

  const handleSaveEdits = async () => {
    const overrides = {
      companyName,
      addressLine1,
      addressLine2,
      phone,
      email,
      gstNo,
      panNo,
      placeOfSupply,
      bankName,
      accountNo,
      ifscCode,
      terms1,
      terms2,
      terms3,
      terms4,
      terms5,
      creditNotePrefix,
      signatoryLabel,
      transportName,
    };

    setIsSaving(true);
    try {
      if (onSaveOverrides) {
        await onSaveOverrides(overrides);
      } else {
        await fetch(`/api/orders/${order.orderNumber}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            templateOverrides: overrides,
            customerName,
            customerAddress,
            customerPhone,
            customerGstPan,
            items: items.map((it) => ({
              productId: it.id || 1,
              productName: it.productName,
              sizeRatio: it.sizeRatio,
              pcsPerSet: it.pcsPerSet || 5,
              totalSets: it.totalSets || 1,
              totalPcs: it.totalPcs || 5,
              unitPrice: it.unitPrice || 0,
              itemSubtotal: it.itemSubtotal || 0,
              colorSets: it.colorSets || "[]",
            })),
          }),
        });
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      setIsEditing(false);
    } catch (err: any) {
      alert("Error saving customization: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="a4-invoice-wrapper font-sans text-black leading-tight text-[11px] print:text-[10px]">
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 5mm 7mm;
          }
          html,
          body {
            background: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          nav,
          header,
          footer,
          aside,
          .print\\:hidden,
          #toast-container,
          .toast-container {
            display: none !important;
          }
          .a4-invoice-wrapper {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            margin: 0 auto !important;
            padding: 0 !important;
          }
          .a4-invoice-box {
            border: 1.5px solid #000 !important;
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            box-shadow: none !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      {/* ═══════════════════════════════════════════
          INTERACTIVE LIVE EDITOR TOOLBAR (print:hidden)
          ═══════════════════════════════════════════ */}
      {allowInlineEdit && (
        <div className="print:hidden mb-4 p-3 bg-slate-900 text-white rounded-xl shadow-lg border border-slate-700 flex flex-wrap items-center justify-between gap-3 max-w-[780px] mx-auto">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-orange-500/20 text-orange-400 rounded-lg">
              <Edit3 size={16} />
            </span>
            <div>
              <div className="text-xs font-bold flex items-center gap-2">
                <span>{isEditing ? "Live Invoice Editor Active" : "Invoice / Order Form Template"}</span>
                {isEditing && (
                  <span className="px-1.5 py-0.2 bg-amber-400 text-slate-950 font-black text-[9px] rounded uppercase animate-pulse">
                    Editing
                  </span>
                )}
                {saveSuccess && (
                  <span className="px-2 py-0.5 bg-emerald-500 text-white font-bold text-[10px] rounded flex items-center gap-1">
                    <Check size={12} /> Saved!
                  </span>
                )}
              </div>
              <div className="text-[10px] text-slate-300">
                {isEditing
                  ? "Click into any text, header, address, item, rate, bank details, or terms below to edit live."
                  : "Previewing physical A4 document. Click 'Edit Live' to modify details directly on screen."}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={handleResetToTemplate}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1 border border-slate-600 transition cursor-pointer"
                  title="Reset header, bank, and terms back to global template defaults"
                >
                  <RotateCcw size={13} />
                  <span>Reset Defaults</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdits}
                  disabled={isSaving}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm transition cursor-pointer disabled:opacity-50"
                  title="Save customized details to this order"
                >
                  <Save size={13} />
                  <span>{isSaving ? "Saving..." : "Save to Order"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded-lg flex items-center gap-1 transition cursor-pointer"
                >
                  <Check size={14} />
                  <span>Finish Editing</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                >
                  <Edit3 size={13} />
                  <span>Edit Live</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 border border-slate-600 transition cursor-pointer"
                >
                  <Printer size={13} />
                  <span>Print A4</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Main Single Border Box matching physical invoice */}
      <div
        className={`a4-invoice-box mx-auto bg-white ${
          isEditing ? "ring-2 ring-orange-400 ring-offset-2" : ""
        }`}
        style={{
          border: "1.5px solid #000000",
          maxWidth: "780px",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {/* 1. TOP HEADER: COMPANY NAME & ADDRESS */}
        <div
          style={{
            borderBottom: "1px solid #000000",
            textAlign: "center",
            padding: "6px 12px",
            backgroundColor: isEditing ? "#fffbeb" : "transparent",
          }}
        >
          {isEditing ? (
            <div className="space-y-1">
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full text-center font-black uppercase text-xl border-b border-orange-300 bg-amber-50/50 outline-none focus:bg-white"
                placeholder="COMPANY NAME"
              />
              <input
                type="text"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                className="w-full text-center text-xs font-bold border-b border-orange-200 bg-amber-50/50 outline-none focus:bg-white"
                placeholder="ADDRESS LINE 1"
              />
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={addressLine2}
                  onChange={(e) => setAddressLine2(e.target.value)}
                  className="w-full text-center text-xs font-bold border-b border-orange-200 bg-amber-50/50 outline-none focus:bg-white"
                  placeholder="CITY, PINCODE & PHONE"
                />
              </div>
            </div>
          ) : (
            <>
              <h1
                style={{
                  fontFamily: "'Times New Roman', Times, serif",
                  fontSize: "22px",
                  fontWeight: "900",
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                  margin: 0,
                  lineHeight: "1.1",
                }}
              >
                {companyName || "KRISH CLOTHING CO."}
              </h1>
              <p
                style={{
                  fontSize: "10px",
                  fontWeight: "700",
                  margin: "2px 0 0 0",
                  letterSpacing: "-0.2px",
                }}
              >
                {addressLine1 || "2ND FLOOR, Q-8,SAMET BUSINESS PARK,NEAR PARISHKAR-2,KHOKHARA CIRCLE,MANINAGAR,"}
              </p>
              <p
                style={{
                  fontSize: "10px",
                  fontWeight: "700",
                  margin: "1px 0 0 0",
                  letterSpacing: "-0.2px",
                }}
              >
                {addressLine2 || "AHMEDABAD - 380008 (M) : 8128756632"}
              </p>
            </>
          )}
        </div>

        {/* 2. SUB-HEADER BAR: Debit Memo | TAX INVOICE | Duplicate */}
        <div
          style={{
            borderBottom: "1px solid #000000",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "3px 10px",
            fontSize: "11px",
            fontWeight: "bold",
          }}
        >
          <div style={{ width: "25%", textAlign: "left" }}>
            {isEditing ? (
              <input
                type="text"
                value={debitMemoText}
                onChange={(e) => setDebitMemoText(e.target.value)}
                className="w-24 px-1 py-0.5 border border-orange-300 bg-amber-50/50 rounded text-xs outline-none"
              />
            ) : (
              debitMemoText
            )}
          </div>
          <div
            style={{
              width: "50%",
              textAlign: "center",
              fontWeight: "900",
              fontSize: "13px",
              letterSpacing: "2px",
              textTransform: "uppercase",
            }}
          >
            {isEditing ? (
              <input
                type="text"
                value={docTitleText}
                onChange={(e) => setDocTitleText(e.target.value)}
                className="text-center font-black tracking-widest uppercase border border-orange-300 bg-amber-50/50 rounded px-2 py-0.5 outline-none text-xs"
              />
            ) : (
              docTitleText
            )}
          </div>
          <div style={{ width: "25%", textAlign: "right" }}>
            {isEditing ? (
              <input
                type="text"
                value={copyTitleText}
                onChange={(e) => setCopyTitleText(e.target.value)}
                className="w-24 text-right px-1 py-0.5 border border-orange-300 bg-amber-50/50 rounded text-xs outline-none"
              />
            ) : (
              copyTitleText
            )}
          </div>
        </div>

        {/* 3. RECEIVER (LEFT ~58%) & INVOICE / TRANSPORT DETAILS (RIGHT ~42%) */}
        <div
          style={{
            borderBottom: "1px solid #000000",
            display: "flex",
            minHeight: "86px",
          }}
        >
          {/* Left Column: Receiver / Customer Info */}
          <div
            style={{
              width: "58%",
              borderRight: "1px solid #000000",
              padding: "5px 10px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              fontSize: "10.5px",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
                <span style={{ fontWeight: "bold", flexShrink: 0 }}>M/s. :</span>
                {isEditing ? (
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full font-black uppercase text-xs px-1 border border-orange-300 bg-amber-50/50 rounded outline-none"
                    placeholder="BUYER SHOP / FIRM NAME"
                  />
                ) : (
                  <span
                    style={{
                      fontWeight: "900",
                      fontSize: "12px",
                      textTransform: "uppercase",
                      letterSpacing: "0.3px",
                    }}
                  >
                    {customerName || "WALK-IN CUSTOMER"}
                  </span>
                )}
              </div>

              {/* Address */}
              <div
                style={{
                  paddingLeft: isEditing ? "0" : "34px",
                  fontSize: "10px",
                  lineHeight: "1.25",
                  color: "#111",
                  marginTop: "1px",
                  textTransform: "uppercase",
                }}
              >
                {isEditing ? (
                  <input
                    type="text"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    className="w-full text-[10px] uppercase px-1 border border-orange-300 bg-amber-50/50 rounded outline-none mt-1"
                    placeholder="BUYER FULL ADDRESS"
                  />
                ) : (
                  customerAddress || "Direct Delivery"
                )}
              </div>

              {/* City & State */}
              <div
                style={{
                  paddingLeft: isEditing ? "0" : "34px",
                  fontSize: "10px",
                  fontWeight: "600",
                  marginTop: "1px",
                  textTransform: "uppercase",
                }}
              >
                {isEditing ? (
                  <div className="flex gap-1 mt-1">
                    <input
                      type="text"
                      value={customerCity}
                      onChange={(e) => setCustomerCity(e.target.value)}
                      className="w-1/2 text-[10px] uppercase px-1 border border-orange-300 bg-amber-50/50 rounded outline-none"
                      placeholder="CITY"
                    />
                    <input
                      type="text"
                      value={customerState}
                      onChange={(e) => setCustomerState(e.target.value)}
                      className="w-1/2 text-[10px] uppercase px-1 border border-orange-300 bg-amber-50/50 rounded outline-none"
                      placeholder="STATE"
                    />
                  </div>
                ) : (
                  `${customerCity || "AHMEDABAD"} - ${customerState || "Gujarat"}`
                )}
              </div>
            </div>

            <div style={{ marginTop: "4px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "10px",
                }}
              >
                <div>
                  <span style={{ fontWeight: "600" }}>Place of Supply :</span>{" "}
                  {isEditing ? (
                    <input
                      type="text"
                      value={placeOfSupply}
                      onChange={(e) => setPlaceOfSupply(e.target.value)}
                      className="w-24 text-[10px] px-1 border border-orange-300 bg-amber-50/50 rounded outline-none"
                    />
                  ) : (
                    <strong>{placeOfSupply || "24-Gujarat"}</strong>
                  )}
                </div>

                <div
                  style={{
                    fontWeight: "bold",
                    fontFamily: "monospace",
                    fontSize: "11px",
                    color: "#000",
                  }}
                >
                  {isEditing ? (
                    <input
                      type="text"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-28 text-[10px] font-mono px-1 border border-orange-300 bg-amber-50/50 rounded outline-none"
                      placeholder="Mob No."
                    />
                  ) : (
                    customerPhone && `Mob No. ${customerPhone}`
                  )}
                </div>
              </div>

              <div style={{ fontSize: "10px", marginTop: "1px" }}>
                <span style={{ fontWeight: "600" }}>GSTIN No. :</span>{" "}
                {isEditing ? (
                  <input
                    type="text"
                    value={customerGstPan}
                    onChange={(e) => setCustomerGstPan(e.target.value)}
                    className="w-40 font-mono text-[10px] px-1 border border-orange-300 bg-amber-50/50 rounded outline-none uppercase"
                    placeholder="GSTIN/PAN"
                  />
                ) : (
                  <span style={{ fontFamily: "monospace", fontWeight: "bold" }}>
                    {customerGstPan || "URP (Unregistered)"}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Order No / Invoice No, Date, Transport */}
          <div
            style={{
              width: "42%",
              display: "flex",
              flexDirection: "column",
              fontSize: "10.5px",
            }}
          >
            <div
              style={{
                borderBottom: "1px solid #000000",
                padding: "5px 10px",
                display: "flex",
                alignItems: "center",
              }}
            >
              <span style={{ fontWeight: "bold", width: "95px" }}>
                {isEditing ? (
                  <input
                    type="text"
                    value={numberLabel}
                    onChange={(e) => setNumberLabel(e.target.value)}
                    className="w-20 px-1 border border-orange-300 bg-amber-50/50 rounded text-xs outline-none font-bold"
                  />
                ) : (
                  numberLabel
                )}
              </span>
              <span style={{ fontFamily: "monospace", fontWeight: "bold" }}>
                :{" "}
                {isEditing ? (
                  <input
                    type="text"
                    value={docNumber}
                    onChange={(e) => setDocNumber(e.target.value)}
                    className="w-32 font-mono px-1 border border-orange-300 bg-amber-50/50 rounded text-xs outline-none font-bold"
                  />
                ) : (
                  docNumber
                )}
              </span>
            </div>

            <div
              style={{
                borderBottom: "1px solid #000000",
                padding: "5px 10px",
                display: "flex",
                alignItems: "center",
              }}
            >
              <span style={{ fontWeight: "bold", width: "95px" }}>Date</span>
              <span style={{ fontFamily: "monospace", fontWeight: "600" }}>
                :{" "}
                {isEditing ? (
                  <input
                    type="text"
                    value={dateStr}
                    onChange={(e) => setDateStr(e.target.value)}
                    className="w-28 font-mono px-1 border border-orange-300 bg-amber-50/50 rounded text-xs outline-none"
                    placeholder="DD/MM/YYYY"
                  />
                ) : (
                  dateStr
                )}
              </span>
            </div>

            <div
              style={{
                padding: "5px 10px",
                display: "flex",
                flex: 1,
                alignItems: "center",
              }}
            >
              <span style={{ fontWeight: "bold", width: "95px" }}>TRANSPORT</span>
              <span
                style={{
                  fontWeight: "900",
                  textTransform: "uppercase",
                  color: "#000",
                  flex: 1,
                }}
              >
                :{" "}
                {isEditing ? (
                  <input
                    type="text"
                    value={transportName}
                    onChange={(e) => setTransportName(e.target.value)}
                    className="w-full text-xs font-bold uppercase px-1 border border-orange-300 bg-amber-50/50 rounded outline-none"
                  />
                ) : (
                  transportName || "Patel Transport Co."
                )}
              </span>
            </div>
          </div>
        </div>

        {/* 4. PRODUCT DETAILS TABLE (Exact 10 columns matching physical sample) */}
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "10.5px",
          }}
        >
          <thead>
            <tr
              style={{
                borderBottom: "1px solid #000000",
                fontSize: "10px",
                fontWeight: "bold",
                textAlign: "center",
                backgroundColor: "#fafafa",
              }}
            >
              <th style={{ borderRight: "1px solid #000000", padding: "4px 2px", width: "4%" }}>
                Sr
              </th>
              <th
                style={{
                  borderRight: "1px solid #000000",
                  padding: "4px 6px",
                  width: "25%",
                  textAlign: "left",
                }}
              >
                Product Design No.
              </th>
              <th style={{ borderRight: "1px solid #000000", padding: "4px 2px", width: "8%" }}>
                HSN/SAC
              </th>
              <th style={{ borderRight: "1px solid #000000", padding: "4px 2px", width: "9%" }}>
                Size Ratio
              </th>
              <th
                style={{
                  borderRight: "1px solid #000000",
                  padding: "4px 4px",
                  width: "20%",
                  textAlign: "left",
                }}
              >
                Color Wise Sets
              </th>
              <th style={{ borderRight: "1px solid #000000", padding: "4px 2px", width: "7%" }}>
                SET
              </th>
              <th style={{ borderRight: "1px solid #000000", padding: "4px 4px", width: "9%" }}>
                PCS
              </th>
              <th
                style={{
                  borderRight: "1px solid #000000",
                  padding: "4px 4px",
                  width: "9%",
                  textAlign: "right",
                }}
              >
                Rate
              </th>
              <th style={{ borderRight: "1px solid #000000", padding: "4px 2px", width: "5%" }}>
                GST %
              </th>
              <th style={{ padding: "4px 6px", width: "10%", textAlign: "right" }}>
                Amount
              </th>
              {isEditing && (
                <th className="print:hidden bg-orange-100 p-1 w-6 text-center text-[10px]">
                  Del
                </th>
              )}
            </tr>
          </thead>

          <tbody>
            {isEditing
              ? items.map((it, idx) => {
                  const colorLines = formatColorAlphabetLines(
                    it.colorSets,
                    it.colorMapping,
                    it.colorsAvailable
                  );

                  const totalPcsVal = Number(it.totalPcs) || (Number(it.totalSets) || 0) * (it.pcsPerSet || 5);
                  const unitPriceVal = Number(it.unitPrice) || 0;
                  const itemAmountVal = Number(it.itemSubtotal) || totalPcsVal * unitPriceVal;

                  return (
                    <tr key={idx} style={{ verticalAlign: "top" }}>
                      <td
                        style={{
                          borderRight: "1px solid #000000",
                          padding: "4px 2px",
                          textAlign: "center",
                          fontFamily: "monospace",
                        }}
                      >
                        {idx + 1}
                      </td>
                      <td style={{ borderRight: "1px solid #000000", padding: "4px 6px" }}>
                        <input
                          type="text"
                          value={it.productName}
                          onChange={(e) => handleItemChange(idx, "productName", e.target.value)}
                          className="w-full font-bold text-xs px-1 border border-orange-300 bg-amber-50/50 rounded outline-none"
                        />
                      </td>
                      <td
                        style={{
                          borderRight: "1px solid #000000",
                          padding: "4px 2px",
                          textAlign: "center",
                          fontFamily: "monospace",
                          fontSize: "10px",
                        }}
                      >
                        <input
                          type="text"
                          value={it.hsnCode || "6203"}
                          onChange={(e) => handleItemChange(idx, "hsnCode", e.target.value)}
                          className="w-full text-center font-mono text-[10px] px-0.5 border border-orange-300 bg-amber-50/50 rounded outline-none"
                        />
                      </td>
                      <td
                        style={{
                          borderRight: "1px solid #000000",
                          padding: "4px 2px",
                          textAlign: "center",
                          fontFamily: "monospace",
                        }}
                      >
                        <input
                          type="text"
                          value={it.sizeRatio || "30 to 38"}
                          onChange={(e) => handleItemChange(idx, "sizeRatio", e.target.value)}
                          className="w-full text-center font-mono text-[10px] px-0.5 border border-orange-300 bg-amber-50/50 rounded outline-none"
                        />
                      </td>
                      <td
                        style={{
                          borderRight: "1px solid #000000",
                          padding: "4px 4px",
                          fontSize: "10px",
                          fontWeight: "600",
                          lineHeight: "1.3",
                        }}
                      >
                        {colorLines.length > 0 ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            {colorLines.map((line, lIdx) => (
                              <div key={lIdx} style={{ whiteSpace: "nowrap" }}>
                                {line}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: "#666" }}>—</span>
                        )}
                      </td>
                      <td
                        style={{
                          borderRight: "1px solid #000000",
                          padding: "4px 2px",
                          textAlign: "center",
                          fontWeight: "bold",
                          fontFamily: "monospace",
                        }}
                      >
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={it.totalSets || 0}
                          onChange={(e) => handleItemChange(idx, "totalSets", parseFloat(e.target.value) || 0)}
                          className="w-full text-center font-mono text-[10px] font-bold px-0.5 border border-orange-300 bg-amber-50/50 rounded outline-none"
                        />
                      </td>
                      <td
                        style={{
                          borderRight: "1px solid #000000",
                          padding: "4px 4px",
                          textAlign: "center",
                          fontWeight: "bold",
                          fontFamily: "monospace",
                        }}
                      >
                        <input
                          type="number"
                          min="0"
                          value={it.totalPcs || 0}
                          onChange={(e) => handleItemChange(idx, "totalPcs", parseInt(e.target.value) || 0)}
                          className="w-full text-center font-mono text-[10px] font-bold px-0.5 border border-orange-300 bg-amber-50/50 rounded outline-none"
                        />
                      </td>
                      <td
                        style={{
                          borderRight: "1px solid #000000",
                          padding: "4px 4px",
                          textAlign: "right",
                          fontFamily: "monospace",
                        }}
                      >
                        <input
                          type="number"
                          min="0"
                          value={it.unitPrice || 0}
                          onChange={(e) => handleItemChange(idx, "unitPrice", parseFloat(e.target.value) || 0)}
                          className="w-full text-right font-mono text-[10px] px-0.5 border border-orange-300 bg-amber-50/50 rounded outline-none font-bold"
                        />
                      </td>
                      <td
                        style={{
                          borderRight: "1px solid #000000",
                          padding: "4px 2px",
                          textAlign: "center",
                          fontFamily: "monospace",
                        }}
                      >
                        {isWithoutGst ? "0.00" : "5.00"}
                      </td>
                      <td
                        style={{
                          padding: "4px 6px",
                          textAlign: "right",
                          fontWeight: "bold",
                          fontFamily: "monospace",
                        }}
                      >
                        {itemAmountVal.toFixed(2)}
                      </td>
                      <td className="print:hidden text-center p-1">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                          title="Remove Item"
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              : displayRows.map((row, idx) => {
                  return (
                    <tr key={idx} style={{ verticalAlign: "top" }}>
                      <td
                        style={{
                          borderRight: "1px solid #000000",
                          padding: "4px 2px",
                          textAlign: "center",
                          fontFamily: "monospace",
                        }}
                      >
                        {idx + 1}
                      </td>
                      <td style={{ borderRight: "1px solid #000000", padding: "4px 6px" }}>
                        <div style={{ fontWeight: "bold", color: "#000" }}>
                          {formatProductNameWithMrp(
                            row.productName,
                            row.mrp || (row as any).product?.mrp,
                            row.unitPrice
                          )}
                        </div>
                        {row.showRatioBelowName && !row.isMixRow && row.sizeRatio && (
                          <div
                            style={{
                              fontSize: "9px",
                              color: "#444",
                              fontFamily: "monospace",
                            }}
                          >
                            Ratio: {row.sizeRatio}
                          </div>
                        )}
                      </td>
                      <td
                        style={{
                          borderRight: "1px solid #000000",
                          padding: "4px 2px",
                          textAlign: "center",
                          fontFamily: "monospace",
                          fontSize: "10px",
                        }}
                      >
                        {row.hsnCode || template.defaultHsn || "6203"}
                      </td>
                      <td
                        style={{
                          borderRight: "1px solid #000000",
                          padding: "4px 2px",
                          textAlign: "center",
                          fontFamily: "monospace",
                        }}
                      >
                        {row.isMixRow
                          ? (row.sizeRatio && row.sizeRatio !== "Mix Sizes"
                              ? row.sizeRatio
                              : (row.particularSize || row.originalItem?.sizeRatio || "30 to 38"))
                          : (row.sizeRatio || "30 to 38")}
                      </td>
                      <td
                        style={{
                          borderRight: "1px solid #000000",
                          padding: "4px 4px",
                          fontSize: "10px",
                          fontWeight: "600",
                          lineHeight: "1.3",
                        }}
                      >
                        {row.colorWiseLines.length > 0 ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            {row.colorWiseLines.map((line, lIdx) => (
                              <div key={lIdx} style={{ whiteSpace: "nowrap" }}>
                                {line}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: "#666" }}>—</span>
                        )}
                      </td>
                      <td
                        style={{
                          borderRight: "1px solid #000000",
                          padding: "4px 2px",
                          textAlign: "center",
                          fontWeight: "bold",
                          fontFamily: "monospace",
                        }}
                      >
                        {row.isMixRow || row.totalSets === null || row.totalSets === 0
                          ? "—"
                          : Number(row.totalSets).toFixed(2)}
                      </td>
                      <td
                        style={{
                          borderRight: "1px solid #000000",
                          padding: "4px 4px",
                          textAlign: "center",
                          fontWeight: "bold",
                          fontFamily: "monospace",
                        }}
                      >
                        {`${Number(row.totalPcs || 0).toFixed(2)} PCS`}
                      </td>
                      <td
                        style={{
                          borderRight: "1px solid #000000",
                          padding: "4px 4px",
                          textAlign: "right",
                          fontFamily: "monospace",
                        }}
                      >
                        {Number(row.unitPrice || 0).toFixed(2)}
                      </td>
                      <td
                        style={{
                          borderRight: "1px solid #000000",
                          padding: "4px 2px",
                          textAlign: "center",
                          fontFamily: "monospace",
                        }}
                      >
                        {isWithoutGst ? "0.00" : "5.00"}
                      </td>
                      <td
                        style={{
                          padding: "4px 6px",
                          textAlign: "right",
                          fontWeight: "bold",
                          fontFamily: "monospace",
                        }}
                      >
                        {Number(row.itemSubtotal || 0).toFixed(2)}
                      </td>
                    </tr>
                  );
                })}

            {/* Add Item Row in Edit Mode */}
            {isEditing && (
              <tr className="print:hidden bg-orange-50/60">
                <td colSpan={11} className="p-2 text-center">
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="px-3 py-1 bg-white border border-orange-300 hover:bg-orange-100 text-orange-800 text-xs font-bold rounded-lg inline-flex items-center gap-1 shadow-xs cursor-pointer"
                  >
                    <Plus size={13} />
                    <span>Add New Line Item</span>
                  </button>
                </td>
              </tr>
            )}

            {/* Empty filler rows with vertical grid borders to match physical tax invoice layout */}
            {Array.from({ length: emptyRowsCount }).map((_, emptyIdx) => (
              <tr key={`empty-${emptyIdx}`} style={{ height: "24px" }}>
                <td style={{ borderRight: "1px solid #000000" }}>&nbsp;</td>
                <td style={{ borderRight: "1px solid #000000" }}>&nbsp;</td>
                <td style={{ borderRight: "1px solid #000000" }}>&nbsp;</td>
                <td style={{ borderRight: "1px solid #000000" }}>&nbsp;</td>
                <td style={{ borderRight: "1px solid #000000" }}>&nbsp;</td>
                <td style={{ borderRight: "1px solid #000000" }}>&nbsp;</td>
                <td style={{ borderRight: "1px solid #000000" }}>&nbsp;</td>
                <td style={{ borderRight: "1px solid #000000" }}>&nbsp;</td>
                <td style={{ borderRight: "1px solid #000000" }}>&nbsp;</td>
                <td>&nbsp;</td>
                {isEditing && <td className="print:hidden">&nbsp;</td>}
              </tr>
            ))}
          </tbody>

          {/* 5. SUB TOTAL ROW (Aligned perfectly with table columns) */}
          <tfoot>
            <tr
              style={{
                borderTop: "1px solid #000000",
                borderBottom: "1px solid #000000",
                fontWeight: "bold",
                backgroundColor: "#fafafa",
                fontSize: "10px",
              }}
            >
              <td
                colSpan={6}
                style={{
                  borderRight: "1px solid #000000",
                  padding: "4px 8px",
                  fontFamily: "monospace",
                  textAlign: "left",
                }}
              >
                <span style={{ fontWeight: "bold" }}>GSTIN No.:</span> {gstNo || template.gstNo}
              </td>
              <td
                style={{
                  borderRight: "1px solid #000000",
                  padding: "4px 4px",
                  textAlign: "center",
                  fontFamily: "monospace",
                  fontWeight: "bold",
                }}
              >
                {totalPcs.toFixed(3)}
              </td>
              <td
                colSpan={2}
                style={{
                  borderRight: "1px solid #000000",
                  padding: "4px 6px",
                  textAlign: "right",
                  textTransform: "uppercase",
                  fontWeight: "bold",
                }}
              >
                SUB TOTAL
              </td>
              <td
                style={{
                  padding: "4px 6px",
                  textAlign: "right",
                  fontFamily: "monospace",
                  fontWeight: "bold",
                  fontSize: "10.5px",
                }}
              >
                {subtotal.toFixed(2)}
              </td>
              {isEditing && <td className="print:hidden">&nbsp;</td>}
            </tr>
          </tfoot>
        </table>

        {/* 6. BANK DETAILS (LEFT ~58%) & TAX BREAKDOWN (RIGHT ~42%) */}
        <div
          style={{
            borderBottom: "1px solid #000000",
            display: "flex",
            fontSize: "10px",
          }}
        >
          {/* Left Column: Bank Details */}
          <div
            style={{
              width: "58%",
              borderRight: "1px solid #000000",
              padding: "6px 10px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-around",
              minHeight: "70px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center" }}>
              <span style={{ fontWeight: "bold", width: "110px" }}>Bank Name</span>
              <span style={{ fontFamily: "monospace", fontWeight: "600", flex: 1 }}>
                :{" "}
                {isEditing ? (
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-48 font-mono text-[10px] px-1 border border-orange-300 bg-amber-50/50 rounded outline-none"
                  />
                ) : (
                  bankName || template.bankName
                )}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center" }}>
              <span style={{ fontWeight: "bold", width: "110px" }}>Bank A/c. No.</span>
              <span style={{ fontFamily: "monospace", fontWeight: "bold", flex: 1 }}>
                :{" "}
                {isEditing ? (
                  <input
                    type="text"
                    value={accountNo}
                    onChange={(e) => setAccountNo(e.target.value)}
                    className="w-48 font-mono text-[10px] font-bold px-1 border border-orange-300 bg-amber-50/50 rounded outline-none"
                  />
                ) : (
                  accountNo || template.accountNo
                )}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center" }}>
              <span style={{ fontWeight: "bold", width: "110px" }}>RTGS/IFSC Code</span>
              <span style={{ fontFamily: "monospace", fontWeight: "bold", flex: 1 }}>
                :{" "}
                {isEditing ? (
                  <input
                    type="text"
                    value={ifscCode}
                    onChange={(e) => setIfscCode(e.target.value)}
                    className="w-48 font-mono text-[10px] font-bold uppercase px-1 border border-orange-300 bg-amber-50/50 rounded outline-none"
                  />
                ) : (
                  ifscCode || template.ifscCode
                )}
              </span>
            </div>
          </div>

          {/* Right Column: Tax Breakdown */}
          <div
            style={{
              width: "42%",
              display: "flex",
              flexDirection: "column",
              fontSize: "10px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "3px 10px",
              }}
            >
              <span>Taxable Amount</span>
              <span style={{ fontFamily: "monospace", fontWeight: "bold" }}>
                {subtotal.toFixed(2)}
              </span>
            </div>
            {isWithoutGst ? (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "2px 10px",
                  color: "#222",
                }}
              >
                <span>GST (0%)</span>
                <span style={{ fontFamily: "monospace" }}>0.00</span>
              </div>
            ) : (
              <>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "2px 10px",
                    color: "#222",
                  }}
                >
                  <span>Central Tax 2.50%</span>
                  <span style={{ fontFamily: "monospace" }}>{cgst.toFixed(2)}</span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "2px 10px",
                    color: "#222",
                  }}
                >
                  <span>State/UT Tax 2.50%</span>
                  <span style={{ fontFamily: "monospace" }}>{sgst.toFixed(2)}</span>
                </div>
              </>
            )}
            <div
              style={{
                borderTop: "1px solid #000000",
                display: "flex",
                justifyContent: "space-between",
                padding: "4px 10px",
                fontWeight: "900",
                fontSize: "11.5px",
              }}
            >
              <span style={{ textTransform: "uppercase", letterSpacing: "1px" }}>
                Grand Total
              </span>
              <span style={{ fontFamily: "monospace", fontSize: "13px" }}>
                {formatCurrency(grandTotal)}
              </span>
            </div>
          </div>
        </div>

        {/* 7. NOTE: PAYMENT TERMS */}
        <div
          style={{
            borderBottom: "1px solid #000000",
            padding: "4px 10px",
            fontSize: "10px",
            fontWeight: "bold",
          }}
        >
          <span style={{ textTransform: "uppercase" }}>Note : </span>
          <span style={{ textTransform: "uppercase", letterSpacing: "0.4px" }}>
            {creditNotePrefix || template.creditNotePrefix}{" "}
            {isEditing ? (
              <input
                type="number"
                min="0"
                value={creditDaysVal}
                onChange={(e) => setCreditDaysVal(parseInt(e.target.value) || 0)}
                className="w-16 text-center font-mono text-[10px] px-1 border border-orange-300 bg-amber-50/50 rounded outline-none font-bold"
              />
            ) : (
              creditDaysVal > 0 ? `${creditDaysVal} DAYS` : "45 DAYS"
            )}
            .
          </span>
        </div>

        {/* 8. TERMS & CONDITIONS (LEFT ~65%) & SIGNATURE (RIGHT ~35%) */}
        <div
          style={{
            display: "flex",
            minHeight: "95px",
          }}
        >
          {/* Terms & Conditions */}
          <div
            style={{
              width: "65%",
              borderRight: "1px solid #000000",
              padding: "5px 10px",
              fontSize: "9px",
              lineHeight: "1.35",
            }}
          >
            <div
              style={{
                fontWeight: "bold",
                textDecoration: "underline",
                textTransform: "uppercase",
                fontSize: "9.5px",
                marginBottom: "2px",
              }}
            >
              Terms &amp; Condition :
            </div>
            {isEditing ? (
              <div className="space-y-1">
                <input
                  type="text"
                  value={terms1}
                  onChange={(e) => setTerms1(e.target.value)}
                  className="w-full text-[9px] px-1 border border-orange-300 bg-amber-50/50 rounded outline-none"
                />
                <input
                  type="text"
                  value={terms2}
                  onChange={(e) => setTerms2(e.target.value)}
                  className="w-full text-[9px] px-1 border border-orange-300 bg-amber-50/50 rounded outline-none"
                />
                <input
                  type="text"
                  value={terms3}
                  onChange={(e) => setTerms3(e.target.value)}
                  className="w-full text-[9px] px-1 border border-orange-300 bg-amber-50/50 rounded outline-none"
                />
                <input
                  type="text"
                  value={terms4}
                  onChange={(e) => setTerms4(e.target.value)}
                  className="w-full text-[9px] px-1 border border-orange-300 bg-amber-50/50 rounded outline-none"
                />
                <input
                  type="text"
                  value={terms5}
                  onChange={(e) => setTerms5(e.target.value)}
                  className="w-full text-[9px] px-1 border border-orange-300 bg-amber-50/50 rounded outline-none font-bold"
                />
              </div>
            ) : (
              <>
                <div>{terms1 || template.terms1}</div>
                <div>{terms2 || template.terms2}</div>
                <div>{terms3 || template.terms3}</div>
                <div>{terms4 || template.terms4}</div>
                <div style={{ fontWeight: "700", textDecoration: "underline" }}>
                  {terms5 || template.terms5}
                </div>
              </>
            )}
          </div>

          {/* Signature Area */}
          <div
            style={{
              width: "35%",
              padding: "5px 10px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              textAlign: "right",
            }}
          >
            <div
              style={{
                fontWeight: "bold",
                fontSize: "11px",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              {isEditing ? (
                <input
                  type="text"
                  value={signatoryLabel}
                  onChange={(e) => setSignatoryLabel(e.target.value)}
                  className="w-full text-right text-[10px] font-bold uppercase px-1 border border-orange-300 bg-amber-50/50 rounded outline-none"
                />
              ) : (
                signatoryLabel || template.signatoryLabel
              )}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", padding: "1px 0" }}>
              <img
                src="/images/krish-clothing-signature.png"
                alt="Authorised Signatory"
                style={{ height: "45px", objectFit: "contain" }}
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            </div>
            <div style={{ fontSize: "10px", fontWeight: "bold", color: "#111" }}>
              {template.signatoryTitle || "(Authorised Signatory)"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
