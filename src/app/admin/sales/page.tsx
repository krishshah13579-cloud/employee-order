"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  BadgePercent,
  Search,
  Plus,
  Eye,
  MessageCircle,
  IndianRupee,
  Calendar,
  Building,
  Phone,
  CheckCircle2,
  Clock,
  Printer,
  Trash2,
  RefreshCw,
  X,
  CreditCard,
  Banknote,
  Boxes,
  FileText,
  AlertCircle,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { shareOrOpenWhatsAppWithPdf } from "@/lib/whatsapp-client";

interface SalesInvoiceItem {
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
}

interface SalesInvoiceRecord {
  id: number;
  invoiceNumber: string;
  orderId?: number | null;
  orderNumber?: string | null;
  customerId?: number | null;
  customerName: string;
  customerPhone?: string | null;
  customerGstPan?: string | null;
  customerAddress?: string | null;
  businessType?: string | null;
  invoiceDate: string | Date;
  paymentType: string;
  paymentStatus: string;
  subtotal: number;
  gstRate: number;
  gstAmount: number;
  grandTotal: number;
  paidAmount: number;
  balanceAmount: number;
  totalSets: number;
  totalPcs: number;
  items: string;
  creditDays: number;
  notes?: string | null;
  placedBy?: string | null;
  customer?: {
    id: number;
    shopName: string;
    phoneNumber: string;
    city: string;
    gstPanNo: string;
  } | null;
}

interface ProductOption {
  id: number;
  name: string;
  price: number;
  retailerPrice?: number | null;
  wholesalerPrice?: number | null;
  colorsAvailable: string;
  sizesRatio: string;
  pcsPerSet: number;
}

interface CustomerOption {
  id: number;
  shopName: string;
  phoneNumber: string;
  gstPanNo: string;
  city?: string | null;
  address?: string | null;
  businessType?: string | null;
  creditDays?: number;
  specialDiscount?: number | null;
}

export default function AdminSalesPage() {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<SalesInvoiceRecord[]>([]);
  const [summary, setSummary] = useState({
    totalInvoices: 0,
    totalRevenue: 0,
    cashSalesRevenue: 0,
    creditSalesRevenue: 0,
    totalPcs: 0,
    totalSets: 0,
  });

  const [search, setSearch] = useState("");
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<"ALL" | "CASH" | "CREDIT">("ALL");

  // View Invoice Modal
  const [viewInvoice, setViewInvoice] = useState<SalesInvoiceRecord | null>(null);

  // New Invoice Modal
  const [isNewInvoiceOpen, setIsNewInvoiceOpen] = useState(false);
  const [submittingInvoice, setSubmittingInvoice] = useState(false);

  // Form State
  const [formPaymentType, setFormPaymentType] = useState<"Cash" | "Credit">("Cash");
  const [customerSelectionType, setCustomerSelectionType] = useState<"existing" | "walkin">("existing");
  const [availableCustomers, setAvailableCustomers] = useState<CustomerOption[]>([]);
  const [availableProducts, setAvailableProducts] = useState<ProductOption[]>([]);

  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerGstPan, setCustomerGstPan] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [businessType, setBusinessType] = useState<
    "RETAILER" | "WHOLESALER" | "WHOLESALER WITHOUT GST" | "CASH" | "RETAILER WITH SPECIAL DISCOUNT"
  >("CASH");
  const [creditDays, setCreditDays] = useState(0);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");

  // Invoice Items in Form
  const [formItems, setFormItems] = useState<
    {
      productId: number;
      productName: string;
      color: string;
      sizeRatio: string;
      pcsPerSet: number;
      totalSets: number;
      totalPcs: number;
      unitPrice: number;
      itemSubtotal: number;
    }[]
  >([]);

  // Load Sales Invoices
  const loadInvoices = async () => {
    try {
      setLoading(true);
      const url = new URL("/api/admin/sales", window.location.origin);
      if (paymentTypeFilter !== "ALL") {
        url.searchParams.set("paymentType", paymentTypeFilter);
      }
      if (search.trim()) {
        url.searchParams.set("search", search.trim());
      }

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Failed to load sales register");
      const data = await res.json();
      setInvoices(data.invoices || []);
      setSummary(
        data.summary || {
          totalInvoices: 0,
          totalRevenue: 0,
          cashSalesRevenue: 0,
          creditSalesRevenue: 0,
          totalPcs: 0,
          totalSets: 0,
        }
      );
    } catch (err: any) {
      toast(err.message || "Error loading sales data", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, [paymentTypeFilter]);

  // Load auxiliary data for creating invoices (Customers & Products)
  const loadAuxData = async () => {
    try {
      const [custRes, prodRes] = await Promise.all([
        fetch("/api/customers"),
        fetch("/api/products?active_only=1"),
      ]);
      if (custRes.ok) {
        const custs = await custRes.json();
        setAvailableCustomers(Array.isArray(custs) ? custs : custs.customers || []);
      }
      if (prodRes.ok) {
        const prods = await prodRes.json();
        setAvailableProducts(Array.isArray(prods) ? prods : prods.products || []);
      }
    } catch (err) {
      console.error("Failed to load auxiliary options:", err);
    }
  };

  useEffect(() => {
    loadAuxData();
  }, []);

  // Filtered invoices client-side if searching rapidly
  const filteredInvoices = useMemo(() => {
    if (!search.trim()) return invoices;
    const s = search.toLowerCase();
    return invoices.filter(
      (inv) =>
        inv.invoiceNumber.toLowerCase().includes(s) ||
        (inv.orderNumber && inv.orderNumber.toLowerCase().includes(s)) ||
        inv.customerName.toLowerCase().includes(s) ||
        (inv.customerPhone && inv.customerPhone.includes(s)) ||
        (inv.customerGstPan && inv.customerGstPan.toLowerCase().includes(s))
    );
  }, [invoices, search]);

  // Add Item to Form
  const handleAddItem = () => {
    if (availableProducts.length === 0) {
      toast("No active products available to add.", "error");
      return;
    }
    const defaultProd = availableProducts[0];
    const colors = defaultProd.colorsAvailable.split(",").map((c) => c.trim());
    const initialSets = 1;
    const initialPcsPerSet = defaultProd.pcsPerSet || 5;
    const initialPrice = defaultProd.price || 490;

    setFormItems((prev) => [
      ...prev,
      {
        productId: defaultProd.id,
        productName: defaultProd.name,
        color: colors[0] || "Standard",
        sizeRatio: defaultProd.sizesRatio || "30 to 38",
        pcsPerSet: initialPcsPerSet,
        totalSets: initialSets,
        totalPcs: initialSets * initialPcsPerSet,
        unitPrice: initialPrice,
        itemSubtotal: initialSets * initialPcsPerSet * initialPrice,
      },
    ]);
  };

  const handleUpdateItem = (index: number, field: string, value: any) => {
    setFormItems((prev) => {
      const copy = [...prev];
      const item = { ...copy[index] };

      if (field === "productId") {
        const prod = availableProducts.find((p) => p.id === Number(value));
        if (prod) {
          item.productId = prod.id;
          item.productName = prod.name;
          const colors = prod.colorsAvailable.split(",").map((c) => c.trim());
          item.color = colors[0] || "Standard";
          item.sizeRatio = prod.sizesRatio || "30 to 38";
          item.pcsPerSet = prod.pcsPerSet || 5;
          const isWholesaler = (businessType || "").toUpperCase().includes("WHOLESAL");
          const customerObj = availableCustomers.find((c) => c.id === selectedCustomerId);
          const splDisc = Number(customerObj?.specialDiscount) || 0;
          const isSpecialDiscount = splDisc > 0 || businessType === "RETAILER WITH SPECIAL DISCOUNT";
          const ret = prod.retailerPrice || prod.price;
          const who = prod.wholesalerPrice || Math.max(0, ret - 100);
          item.unitPrice = isWholesaler
            ? (isSpecialDiscount ? Math.max(0, who - splDisc) : who)
            : (isSpecialDiscount ? Math.max(0, ret - splDisc) : ret);
          item.totalPcs = item.totalSets * item.pcsPerSet;
          item.itemSubtotal = item.totalPcs * item.unitPrice;
        }
      } else if (field === "totalSets") {
        const sets = Math.max(1, parseInt(value, 10) || 1);
        item.totalSets = sets;
        item.totalPcs = sets * item.pcsPerSet;
        item.itemSubtotal = item.totalPcs * item.unitPrice;
      } else if (field === "unitPrice") {
        const price = Math.max(0, parseFloat(value) || 0);
        item.unitPrice = price;
        item.itemSubtotal = item.totalPcs * price;
      } else if (field === "color") {
        item.color = value;
      }

      copy[index] = item;
      return copy;
    });
  };

  const handleRemoveItem = (index: number) => {
    setFormItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Calculations for new invoice form
  const calculatedSubtotal = useMemo(() => {
    return formItems.reduce((sum, it) => sum + it.itemSubtotal, 0);
  }, [formItems]);

  const isWithoutGst = businessType === "WHOLESALER WITHOUT GST";

  const calculatedGst = useMemo(() => {
    if (isWithoutGst) return 0;
    return Math.round(calculatedSubtotal * 0.05 * 100) / 100;
  }, [calculatedSubtotal, isWithoutGst]);

  const calculatedGrandTotal = useMemo(() => {
    return Math.round(calculatedSubtotal + calculatedGst);
  }, [calculatedSubtotal, calculatedGst]);

  const calculatedTotalSets = useMemo(() => {
    return formItems.reduce((sum, it) => sum + it.totalSets, 0);
  }, [formItems]);

  const calculatedTotalPcs = useMemo(() => {
    return formItems.reduce((sum, it) => sum + it.totalPcs, 0);
  }, [formItems]);

  // Open New Invoice Modal
  const handleOpenNewInvoice = (type: "Cash" | "Credit" = "Cash") => {
    setFormPaymentType(type);
    setCustomerSelectionType(type === "Cash" ? "walkin" : "existing");
    setSelectedCustomerId(null);
    setCustomerName(type === "Cash" ? "Cash Counter Sale" : "");
    setCustomerPhone("");
    setCustomerGstPan("");
    setCustomerAddress("");
    setBusinessType(type === "Cash" ? "CASH" : "RETAILER");
    setCreditDays(0);
    setInvoiceDate(new Date().toISOString().split("T")[0]);
    setNotes("");

    // Initialize with 1 item
    if (availableProducts.length > 0) {
      const defaultProd = availableProducts[0];
      const colors = defaultProd.colorsAvailable.split(",").map((c) => c.trim());
      const pps = defaultProd.pcsPerSet || 5;
      const rate = defaultProd.price || 490;
      setFormItems([
        {
          productId: defaultProd.id,
          productName: defaultProd.name,
          color: colors[0] || "Standard",
          sizeRatio: defaultProd.sizesRatio || "30 to 38",
          pcsPerSet: pps,
          totalSets: 1,
          totalPcs: pps,
          unitPrice: rate,
          itemSubtotal: pps * rate,
        },
      ]);
    } else {
      setFormItems([]);
    }

    setIsNewInvoiceOpen(true);
  };

  // When an existing customer is selected in the modal
  const handleSelectCustomer = (cid: number) => {
    setSelectedCustomerId(cid);
    const c = availableCustomers.find((cust) => cust.id === cid);
    if (c) {
      setCustomerName(c.shopName);
      setCustomerPhone(c.phoneNumber || "");
      setCustomerGstPan(c.gstPanNo || "");
      setCustomerAddress(c.address || "");
      setBusinessType((c.businessType as any) || "RETAILER");
      setCreditDays(c.creditDays || 0);

      // Recalculate prices if wholesaler or retailer with special discount
      const isWholesaler = (c.businessType || "").toUpperCase().includes("WHOLESAL");
      const splDisc = Number(c.specialDiscount) || 0;
      const isSpecialDiscount = splDisc > 0 || c.businessType === "RETAILER WITH SPECIAL DISCOUNT";

      setFormItems((prev) =>
        prev.map((it) => {
          const prod = availableProducts.find((p) => p.id === it.productId);
          const ret = prod?.retailerPrice || prod?.price || it.unitPrice;
          const who = prod?.wholesalerPrice || Math.max(0, ret - 100);
          const price = isWholesaler
            ? (isSpecialDiscount ? Math.max(0, who - splDisc) : who)
            : (isSpecialDiscount ? Math.max(0, ret - splDisc) : ret);
          return {
            ...it,
            unitPrice: price,
            itemSubtotal: it.totalPcs * price,
          };
        })
      );
    }
  };

  // Submit New Sales Invoice
  const handleSubmitInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      toast("Please enter or select a customer name.", "error");
      return;
    }
    if (formItems.length === 0) {
      toast("Please add at least one product item to the invoice.", "error");
      return;
    }

    setSubmittingInvoice(true);
    try {
      const res = await fetch("/api/admin/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customerSelectionType === "existing" ? selectedCustomerId : null,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim() || null,
          customerGstPan: customerGstPan.trim() || null,
          customerAddress: customerAddress.trim() || null,
          businessType,
          invoiceDate,
          paymentType: formPaymentType,
          creditDays: formPaymentType === "Credit" ? creditDays : 0,
          items: formItems,
          subtotal: calculatedSubtotal,
          gstRate: isWithoutGst ? 0 : 5.0,
          notes: notes.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create sales invoice");

      toast(data.message || "Sales invoice created successfully!", "success");
      setIsNewInvoiceOpen(false);
      loadInvoices();
    } catch (err: any) {
      toast(err.message || "Error creating sales invoice", "error");
    } finally {
      setSubmittingInvoice(false);
    }
  };

  // Parse items helper for viewing
  const getInvoiceItems = (inv: SalesInvoiceRecord): SalesInvoiceItem[] => {
    try {
      if (!inv.items) return [];
      const parsed = JSON.parse(inv.items);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  // Handle WhatsApp Invoice Dispatch
  const [sendingInvoiceId, setSendingInvoiceId] = useState<number | null>(null);
  const handleSendWhatsAppInvoice = async (inv: SalesInvoiceRecord) => {
    const phone = inv.customerPhone || inv.customer?.phoneNumber;
    if (!phone) {
      toast("No phone number associated with this invoice.", "error");
      return;
    }

    try {
      setSendingInvoiceId(inv.id);
      const res = await fetch(`/api/admin/sales/${inv.id}/whatsapp`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to dispatch invoice via WhatsApp");

      if (data.automated) {
        toast(
          `✅ Tax Invoice PDF generated & dispatched directly to ${data.customerName || inv.customerName} (${data.customerPhone || phone}) via WhatsApp!`,
          "success"
        );
      } else {
        await shareOrOpenWhatsAppWithPdf({
          whatsappUrl: data.whatsappUrl,
          nativeUrl: data.nativeUrl,
          pdfUrl: data.pdfUrl,
          filename: data.fileName,
          text: data.message,
          onToast: toast,
        });
      }
    } catch (err: any) {
      toast(err.message || "Failed to send WhatsApp invoice", "error");
    } finally {
      setSendingInvoiceId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-200">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-orange-600 mb-1">
              <BadgePercent size={14} /> Sales Register & Invoicing
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              Sales Invoices & Cash Counter Register
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              All wholesale confirmed orders are automatically sent here. Register counter cash sales and monitor revenue.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => handleOpenNewInvoice("Cash")}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <Banknote size={15} />
              <span>+ New Cash Sale</span>
            </button>

            <button
              onClick={() => handleOpenNewInvoice("Credit")}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <Plus size={15} />
              <span>+ New Credit Invoice</span>
            </button>

            <button
              onClick={loadInvoices}
              className="p-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-slate-700 rounded-xl transition cursor-pointer"
              title="Refresh Sales"
            >
              <RefreshCw size={15} className={loading ? "animate-spin text-orange-600" : ""} />
            </button>
          </div>
        </div>

        {/* Financial KPI Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Total Sales Revenue</span>
              <IndianRupee size={16} className="text-orange-600" />
            </div>
            <div className="text-2xl font-black text-slate-900 font-mono">
              {formatCurrency(summary.totalRevenue)}
            </div>
            <p className="text-[11px] text-slate-500 mt-1 font-medium">
              {summary.totalInvoices} Invoices ({summary.totalPcs.toLocaleString("en-IN")} Pcs / {summary.totalSets.toLocaleString("en-IN")} Sets)
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
            <div className="flex items-center justify-between text-emerald-600 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Direct Cash Sales</span>
              <Banknote size={16} />
            </div>
            <div className="text-2xl font-black text-emerald-700 font-mono">
              {formatCurrency(summary.cashSalesRevenue)}
            </div>
            <p className="text-[11px] text-emerald-600 mt-1 font-semibold">
              Pre-settled immediate cash counter sales
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
            <div className="flex items-center justify-between text-blue-600 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Credit Sales Billed</span>
              <CreditCard size={16} />
            </div>
            <div className="text-2xl font-black text-blue-700 font-mono">
              {formatCurrency(summary.creditSalesRevenue)}
            </div>
            <p className="text-[11px] text-blue-600 mt-1 font-semibold">
              Tracked in customer outstanding ledger
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
            <div className="flex items-center justify-between text-purple-600 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Volume Dispatched</span>
              <Boxes size={16} />
            </div>
            <div className="text-2xl font-black text-purple-700 font-mono">
              {summary.totalPcs.toLocaleString("en-IN")} <span className="text-sm font-semibold text-purple-500">Pcs</span>
            </div>
            <p className="text-[11px] text-purple-600 mt-1 font-semibold">
              Across {summary.totalSets.toLocaleString("en-IN")} Wholesale Sets
            </p>
          </div>
        </div>

        {/* Toolbar: Search and Filter Pills */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3.5 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search by Invoice #, Order #, Firm Name, GST..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-orange-500 outline-none transition"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Type:</span>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setPaymentTypeFilter("ALL")}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  paymentTypeFilter === "ALL"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                All Sales
              </button>
              <button
                type="button"
                onClick={() => setPaymentTypeFilter("CASH")}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  paymentTypeFilter === "CASH"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-emerald-700"
                }`}
              >
                Cash Sales
              </button>
              <button
                type="button"
                onClick={() => setPaymentTypeFilter("CREDIT")}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  paymentTypeFilter === "CREDIT"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-blue-700"
                }`}
              >
                Credit Sales
              </button>
            </div>
          </div>
        </div>

        {/* Sales Invoices Table */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900 text-white text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4 font-bold">Invoice #</th>
                  <th className="py-3 px-4 font-bold">Date</th>
                  <th className="py-3 px-4 font-bold">Customer / Firm</th>
                  <th className="py-3 px-4 font-bold">Payment Type</th>
                  <th className="py-3 px-4 font-bold text-right">Volume</th>
                  <th className="py-3 px-4 font-bold text-right">Grand Total (₹)</th>
                  <th className="py-3 px-4 font-bold text-right">Balance Due (₹)</th>
                  <th className="py-3 px-4 font-bold text-center">Status</th>
                  <th className="py-3 px-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center text-slate-500">
                      <div className="w-7 h-7 border-3 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      Loading sales invoices register...
                    </td>
                  </tr>
                ) : filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center text-slate-500">
                      <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <BadgePercent size={24} />
                      </div>
                      <p className="text-sm font-bold text-slate-700">No Sales Invoices Found</p>
                      <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                        Once an order is confirmed, it will appear here automatically. You can also click "+ New Cash Sale" to bill a walk-in sale.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((inv) => {
                    const isCash = inv.paymentType === "Cash";
                    const isFullyPaid = inv.balanceAmount <= 0 || isCash;

                    return (
                      <tr key={inv.id} className="hover:bg-slate-50/80 transition">
                        {/* Invoice Number */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col">
                            <span className="font-mono font-bold text-slate-900 text-xs">
                              {inv.invoiceNumber}
                            </span>
                            {inv.orderNumber && (
                              <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                                Order: {inv.orderNumber}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Date */}
                        <td className="py-3.5 px-4 font-medium text-slate-600">
                          {formatDate(inv.invoiceDate)}
                        </td>

                        {/* Customer */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900">{inv.customerName}</span>
                            <div className="flex items-center gap-2 text-[10px] text-slate-500">
                              {inv.customerPhone && <span>{inv.customerPhone}</span>}
                              {inv.customerGstPan && (
                                <span className="font-mono text-orange-600 font-semibold">
                                  {inv.customerGstPan}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Payment Type */}
                        <td className="py-3.5 px-4">
                          {isCash ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-[10px] font-bold">
                              <Banknote size={11} /> CASH SALE
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-800 rounded-lg text-[10px] font-bold">
                              <CreditCard size={11} /> CREDIT ({inv.creditDays}d)
                            </span>
                          )}
                        </td>

                        {/* Volume */}
                        <td className="py-3.5 px-4 text-right font-medium text-slate-700">
                          <span>{inv.totalPcs} pcs</span>
                          <span className="text-[10px] text-slate-400 block font-normal">
                            ({inv.totalSets} sets)
                          </span>
                        </td>

                        {/* Grand Total */}
                        <td className="py-3.5 px-4 text-right font-black font-mono text-slate-900 text-sm">
                          {formatCurrency(inv.grandTotal)}
                        </td>

                        {/* Balance Due */}
                        <td className="py-3.5 px-4 text-right font-black font-mono text-xs">
                          {isFullyPaid ? (
                            <span className="text-emerald-600">₹0</span>
                          ) : (
                            <span className="text-rose-600">{formatCurrency(inv.balanceAmount)}</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 text-center">
                          {isFullyPaid ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-bold">
                              <CheckCircle2 size={10} /> Paid
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[10px] font-bold">
                              <Clock size={10} /> Outstanding
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setViewInvoice(inv)}
                              className="p-1.5 bg-slate-900 hover:bg-black text-white rounded-lg transition cursor-pointer"
                              title="View and Print Invoice"
                            >
                              <Eye size={13} />
                            </button>

                            {inv.customerPhone && (
                              <button
                                type="button"
                                disabled={sendingInvoiceId === inv.id}
                                onClick={() => handleSendWhatsAppInvoice(inv)}
                                className="p-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg transition cursor-pointer"
                                title="Generate PDF & send via WhatsApp directly"
                              >
                                {sendingInvoiceId === inv.id ? (
                                  <RefreshCw size={13} className="animate-spin" />
                                ) : (
                                  <MessageCircle size={13} />
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ═══════════════════════════════════════════
            VIEW / PRINT SALES INVOICE MODAL
            ═══════════════════════════════════════════ */}
        {viewInvoice && (
          <Modal
            isOpen={!!viewInvoice}
            onClose={() => setViewInvoice(null)}
            title={`Sales Invoice — ${viewInvoice.invoiceNumber}`}
            size="lg"
            footer={
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer size={14} />
                    <span>Print Invoice</span>
                  </button>
                  {viewInvoice.customerPhone && (
                    <button
                      type="button"
                      disabled={sendingInvoiceId === viewInvoice.id}
                      onClick={() => handleSendWhatsAppInvoice(viewInvoice)}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                    >
                      {sendingInvoiceId === viewInvoice.id ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" />
                          <span>Sending PDF...</span>
                        </>
                      ) : (
                        <>
                          <MessageCircle size={14} />
                          <span>WhatsApp PDF</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setViewInvoice(null)}
                  className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-black transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            }
          >
            <div className="p-4 space-y-6 text-slate-900 print:p-0">
              {/* Invoice Header */}
              <div className="flex items-start justify-between pb-4 border-b border-gray-200">
                <div>
                  <h2 className="text-xl font-black uppercase text-slate-900">IQ TROUSERS</h2>
                  <p className="text-xs text-orange-600 font-bold uppercase tracking-wider">
                    Premium Menswear & Boys Garments
                  </p>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs">
                    Plot 501-504, Textile Tower, Ring Road, Surat, Gujarat - 395002
                  </p>
                  <p className="text-xs font-mono text-slate-700 font-semibold mt-0.5">
                    GSTIN: 24AAACI1357Q1Z2
                  </p>
                </div>

                <div className="text-right">
                  <div className="inline-block px-3 py-1 bg-slate-900 text-white text-xs font-bold rounded-lg uppercase tracking-wider">
                    {viewInvoice.paymentType === "Cash" ? "Cash Sale Memo" : "Tax / Credit Invoice"}
                  </div>
                  <div className="mt-2 font-mono font-bold text-sm text-slate-900">
                    {viewInvoice.invoiceNumber}
                  </div>
                  <div className="text-xs text-slate-500">Date: {formatDate(viewInvoice.invoiceDate)}</div>
                  {viewInvoice.orderNumber && (
                    <div className="text-[11px] text-slate-500 font-mono">
                      Ref Order: {viewInvoice.orderNumber}
                    </div>
                  )}
                </div>
              </div>

              {/* Customer / Billed To Section */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Billed To (Customer Details)
                  </span>
                  <div className="font-bold text-slate-900 text-sm mt-0.5">{viewInvoice.customerName}</div>
                  {viewInvoice.customerAddress && (
                    <div className="text-slate-600 mt-0.5">{viewInvoice.customerAddress}</div>
                  )}
                  {viewInvoice.customerPhone && (
                    <div className="text-slate-600 mt-0.5">Phone: {viewInvoice.customerPhone}</div>
                  )}
                  {viewInvoice.customerGstPan && (
                    <div className="text-orange-600 font-mono font-semibold mt-0.5">
                      GST/PAN: {viewInvoice.customerGstPan}
                    </div>
                  )}
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Payment Terms
                  </span>
                  <div className="font-bold text-slate-900 mt-0.5 capitalize">
                    {viewInvoice.paymentType} {viewInvoice.paymentType === "Cash" ? "(Fully Paid)" : `Credit (${viewInvoice.creditDays} Days)`}
                  </div>
                  {viewInvoice.placedBy && (
                    <div className="text-slate-500 mt-1">Billed By: {viewInvoice.placedBy}</div>
                  )}
                </div>
              </div>

              {/* Items Table */}
              <div className="overflow-x-auto border border-gray-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 text-[10px] uppercase font-bold">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Product Description</th>
                      <th className="py-2.5 px-3">Color / Ratio</th>
                      <th className="py-2.5 px-3 text-right">Sets</th>
                      <th className="py-2.5 px-3 text-right">Pcs</th>
                      <th className="py-2.5 px-3 text-right">Rate (₹)</th>
                      <th className="py-2.5 px-3 text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {getInvoiceItems(viewInvoice).map((it, idx) => (
                      <tr key={idx}>
                        <td className="py-2 px-3 text-slate-400">{idx + 1}</td>
                        <td className="py-2 px-3 font-semibold text-slate-900">{it.productName}</td>
                        <td className="py-2 px-3 text-slate-600">
                          {it.color || "—"} {it.sizeRatio ? `(${it.sizeRatio})` : ""}
                        </td>
                        <td className="py-2 px-3 text-right font-medium">{it.totalSets}</td>
                        <td className="py-2 px-3 text-right font-medium">{it.totalPcs}</td>
                        <td className="py-2 px-3 text-right font-mono">₹{it.unitPrice}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold">
                          {formatCurrency(it.itemSubtotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t border-gray-200 text-xs">
                    <tr>
                      <td colSpan={3} className="py-2 px-3 font-bold text-slate-700">
                        Total Volume
                      </td>
                      <td className="py-2 px-3 text-right font-bold">{viewInvoice.totalSets}</td>
                      <td className="py-2 px-3 text-right font-bold">{viewInvoice.totalPcs}</td>
                      <td className="py-2 px-3 text-right font-bold">Subtotal:</td>
                      <td className="py-2 px-3 text-right font-mono font-bold">
                        {formatCurrency(viewInvoice.subtotal)}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={6} className="py-1.5 px-3 text-right text-slate-600">
                        GST ({viewInvoice.gstRate}%):
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono text-slate-700">
                        {formatCurrency(viewInvoice.gstAmount)}
                      </td>
                    </tr>
                    <tr className="border-t border-slate-300 text-sm">
                      <td colSpan={6} className="py-2.5 px-3 text-right font-black text-slate-900">
                        Grand Total:
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900 text-base">
                        {formatCurrency(viewInvoice.grandTotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {viewInvoice.notes && (
                <div className="text-xs text-slate-500 bg-amber-50/60 p-3 rounded-lg border border-amber-200">
                  <span className="font-bold text-amber-900">Notes: </span>
                  {viewInvoice.notes}
                </div>
              )}
            </div>
          </Modal>
        )}

        {/* ═══════════════════════════════════════════
            CREATE NEW SALES INVOICE / CASH SALE MODAL
            ═══════════════════════════════════════════ */}
        {isNewInvoiceOpen && (
          <Modal
            isOpen={isNewInvoiceOpen}
            onClose={() => setIsNewInvoiceOpen(false)}
            title="Create Sales Invoice & Cash Register Entry"
            size="xl"
            footer={
              <div className="flex items-center justify-between w-full">
                <div className="text-xs text-slate-500">
                  Total: <strong className="text-slate-900 text-sm font-mono">{formatCurrency(calculatedGrandTotal)}</strong> ({calculatedTotalPcs} Pcs)
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsNewInvoiceOpen(false)}
                    className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-semibold hover:bg-gray-50 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitInvoice}
                    disabled={submittingInvoice || formItems.length === 0}
                    className="px-5 py-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition disabled:opacity-50 cursor-pointer"
                  >
                    {submittingInvoice ? "Saving Invoice..." : "Save & Register Invoice"}
                  </button>
                </div>
              </div>
            }
          >
            <form onSubmit={handleSubmitInvoice} className="p-4 space-y-5">
              {/* 1. Payment Type Selector */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  1. Select Payment Sale Category
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setFormPaymentType("Cash");
                      setCustomerSelectionType("walkin");
                      if (customerName === "") setCustomerName("Cash Counter Sale");
                    }}
                    className={`p-3.5 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                      formPaymentType === "Cash"
                        ? "bg-emerald-50 border-emerald-500 text-emerald-900 shadow-xs"
                        : "bg-white border-gray-200 text-slate-700 hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`p-2 rounded-lg ${formPaymentType === "Cash" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                        <Banknote size={18} />
                      </div>
                      <div>
                        <span className="font-black text-xs block">Cash Sale (Counter / Direct)</span>
                        <span className="text-[10px] text-slate-500">Immediate cash receipt, pre-settled 0 dues</span>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormPaymentType("Credit");
                      setCustomerSelectionType("existing");
                      if (customerName === "Cash Counter Sale") setCustomerName("");
                    }}
                    className={`p-3.5 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                      formPaymentType === "Credit"
                        ? "bg-blue-50 border-blue-500 text-blue-900 shadow-xs"
                        : "bg-white border-gray-200 text-slate-700 hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`p-2 rounded-lg ${formPaymentType === "Credit" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                        <CreditCard size={18} />
                      </div>
                      <div>
                        <span className="font-black text-xs block">Credit Sale (Wholesale Account)</span>
                        <span className="text-[10px] text-slate-500">Tracked in customer outstanding ledger</span>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* 2. Customer Information */}
              <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    2. Customer Information
                  </label>
                  <div className="flex items-center gap-2 text-xs">
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name="custType"
                        checked={customerSelectionType === "existing"}
                        onChange={() => setCustomerSelectionType("existing")}
                        className="text-orange-600"
                      />
                      <span>Select Existing Firm</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name="custType"
                        checked={customerSelectionType === "walkin"}
                        onChange={() => {
                          setCustomerSelectionType("walkin");
                          setSelectedCustomerId(null);
                        }}
                        className="text-orange-600"
                      />
                      <span>Walk-in / Cash Customer</span>
                    </label>
                  </div>
                </div>

                {customerSelectionType === "existing" ? (
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">
                      Registered Customer Firm *
                    </label>
                    <select
                      value={selectedCustomerId || ""}
                      onChange={(e) => handleSelectCustomer(Number(e.target.value))}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-orange-500 outline-none"
                    >
                      <option value="">-- Choose Registered Customer --</option>
                      {availableCustomers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.shopName} {c.city ? `(${c.city})` : ""} — {c.phoneNumber}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">
                        Customer / Firm Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Cash Counter Sale or Client Name"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-orange-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">
                        Phone Number
                      </label>
                      <input
                        type="text"
                        placeholder="10-digit mobile number"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-orange-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">
                        GST / PAN No. (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 24AAACI1234Q1Z5"
                        value={customerGstPan}
                        onChange={(e) => setCustomerGstPan(e.target.value.toUpperCase())}
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-mono uppercase focus:ring-2 focus:ring-orange-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">
                        Address / City
                      </label>
                      <input
                        type="text"
                        placeholder="City, State"
                        value={customerAddress}
                        onChange={(e) => setCustomerAddress(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-orange-500 outline-none"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Invoice Date</label>
                    <input
                      type="date"
                      value={invoiceDate}
                      onChange={(e) => setInvoiceDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-orange-500 outline-none"
                    />
                  </div>

                  {formPaymentType === "Credit" && (
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">Credit Days</label>
                      <input
                        type="number"
                        min="0"
                        value={creditDays}
                        onChange={(e) => setCreditDays(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-orange-500 outline-none"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* 3. Product Items */}
              <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    3. Billed Garment Items ({formItems.length})
                  </label>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    <Plus size={13} />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {formItems.map((item, index) => {
                    const prod = availableProducts.find((p) => p.id === item.productId);
                    const colors = prod?.colorsAvailable.split(",").map((c) => c.trim()) || [item.color];

                    return (
                      <div
                        key={index}
                        className="p-3 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-12 gap-2 items-center text-xs"
                      >
                        <div className="col-span-12 sm:col-span-4">
                          <label className="text-[10px] text-slate-400 font-bold uppercase block">Product</label>
                          <select
                            value={item.productId}
                            onChange={(e) => handleUpdateItem(index, "productId", e.target.value)}
                            className="w-full px-2 py-1.5 bg-white border border-gray-300 rounded-lg text-xs"
                          >
                            {availableProducts.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} (₹{p.price}/pc)
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="col-span-6 sm:col-span-2">
                          <label className="text-[10px] text-slate-400 font-bold uppercase block">Color</label>
                          <select
                            value={item.color}
                            onChange={(e) => handleUpdateItem(index, "color", e.target.value)}
                            className="w-full px-2 py-1.5 bg-white border border-gray-300 rounded-lg text-xs"
                          >
                            {colors.map((c, i) => (
                              <option key={i} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="col-span-6 sm:col-span-2">
                          <label className="text-[10px] text-slate-400 font-bold uppercase block">Sets</label>
                          <input
                            type="number"
                            min="1"
                            value={item.totalSets}
                            onChange={(e) => handleUpdateItem(index, "totalSets", e.target.value)}
                            className="w-full px-2 py-1.5 bg-white border border-gray-300 rounded-lg text-xs text-center font-bold"
                          />
                        </div>

                        <div className="col-span-6 sm:col-span-2">
                          <label className="text-[10px] text-slate-400 font-bold uppercase block">Rate (₹/pc)</label>
                          <input
                            type="number"
                            min="0"
                            value={item.unitPrice}
                            onChange={(e) => handleUpdateItem(index, "unitPrice", e.target.value)}
                            className="w-full px-2 py-1.5 bg-white border border-gray-300 rounded-lg text-xs text-right font-mono font-bold"
                          />
                        </div>

                        <div className="col-span-5 sm:col-span-1 text-right">
                          <label className="text-[10px] text-slate-400 font-bold uppercase block">Subtotal</label>
                          <span className="font-mono font-black text-slate-900 block text-xs mt-1">
                            ₹{item.itemSubtotal.toLocaleString("en-IN")}
                          </span>
                        </div>

                        <div className="col-span-1 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            className="text-slate-400 hover:text-rose-600 transition p-1 mt-3"
                            title="Remove Item"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Totals Summary Card */}
                <div className="bg-slate-900 text-white p-4 rounded-xl flex items-center justify-between text-xs mt-3">
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">
                      Total Volume
                    </span>
                    <span className="font-bold text-sm">
                      {calculatedTotalSets} Sets ({calculatedTotalPcs} Pcs)
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">
                      Subtotal: ₹{calculatedSubtotal.toLocaleString("en-IN")} + 5% GST: ₹{calculatedGst.toLocaleString("en-IN")}
                    </span>
                    <span className="text-xl font-black font-mono text-orange-400">
                      ₹{calculatedGrandTotal.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              </div>

              {/* 4. Notes */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  Invoice Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Additional order terms, transport details, or payment receipt notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-orange-500 outline-none"
                />
              </div>
            </form>
          </Modal>
        )}
    </div>
  );
}
