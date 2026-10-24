"use client";

import React, { useState, useEffect, useMemo, useRef, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FilePlus,
  Users,
  Building,
  CreditCard,
  Phone,
  MapPin,
  Plus,
  Trash2,
  Edit3,
  Layers,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  FileText,
  Lock,
  Clock,
  User,
  Printer,
  RotateCcw,
  ShoppingBag,
  ExternalLink,
  ChevronDown,
  Search,
  X,
  Upload,
  Loader2,
  Truck,
  Image as ImageIcon,
  MessageCircle,
} from "lucide-react";
import { UserHeader } from "@/components/user/UserHeader";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency, formatDate, isGstPanRegistered } from "@/lib/utils";
import { openWhatsAppDirectly, shareOrOpenWhatsAppWithPdf } from "@/lib/whatsapp-client";
import { getColorHex } from "@/lib/colors";
import type { CustomerData, ColorSetEntry } from "@/lib/types";
import { useEmployee } from "@/components/providers/EmployeeProvider";
import { isEmployeeTeamLeader } from "@/lib/time";
import { getProductMixSizesInfo, getColorShadeLetter, parseMixSizesForDisplay } from "@/lib/stock";
import { getClientSessionId } from "@/lib/session";
import {
  PARAM_CUSTOMER_ID,
  PARAM_BUSINESS_TYPE,
  PARAM_RETURN_TO,
  STORAGE_KEY_ORDER_DRAFT,
  STORAGE_KEY_SELECTED_CUSTOMER,
  STORAGE_KEY_EMPLOYEE_NAME,
  APP_ROUTES,
  sanitizeInternalReturnTo,
  sanitizePositiveInt,
  sanitizeBusinessType,
  buildOrderFormReturnUrl,
} from "@/lib/navigation";

interface DraftOrderItem {
  productId: number;
  productName: string;
  category?: string;
  imageUrl?: string;
  colorSets: ColorSetEntry[];
  sizeRatio: string;
  sizesList?: string;
  pcsPerSet: number;
  totalSets: number;
  totalPcs: number;
  retailerPrice?: number;
  wholesalerPrice?: number;
  unitPrice: number;
  mixPcs?: number;
  mixSizes?: string;
  colorMixPcs?: Record<string, Record<string, number>>;
  itemSubtotal: number;
  notes?: string;
}

interface ConfirmedOrder {
  id: number;
  orderNumber: string;
  customerName: string;
  customerPhone?: string;
  customerGstPan: string;
  grandTotal: number;
  totalPcs: number;
  totalSets: number;
  orderDate: string;
  transportName?: string;
  whatsAppSent?: boolean;
}

function OrderFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const customerIdParam = searchParams.get(PARAM_CUSTOMER_ID);
  const businessTypeParam = sanitizeBusinessType(searchParams.get(PARAM_BUSINESS_TYPE));

  // Employee Name
  const [placedBy, setPlacedBy] = useState<string>("");

  // Customers
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState<boolean>(true);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const fromUrl = sanitizePositiveInt(urlParams.get(PARAM_CUSTOMER_ID));
      if (fromUrl) return fromUrl;

      try {
        const raw = localStorage.getItem(STORAGE_KEY_ORDER_DRAFT);
        if (raw) {
          const draft = JSON.parse(raw);
          const cId = sanitizePositiveInt(draft?.customerId || draft?.customer?.id);
          if (cId) return cId;
        }
      } catch {}
      try {
        const savedId = sanitizePositiveInt(localStorage.getItem(STORAGE_KEY_SELECTED_CUSTOMER));
        if (savedId) return savedId;
      } catch {}
    }
    return null;
  });
  const [customerSearchQuery, setCustomerSearchQuery] = useState<string>("");
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState<boolean>(false);

  // Customer GST/PAN Inline Edit State (for unregistered customers)
  const [isEditingGstPan, setIsEditingGstPan] = useState<boolean>(false);
  const [customGstPan, setCustomGstPan] = useState<string>("");
  const [isSavingGstPan, setIsSavingGstPan] = useState<boolean>(false);

  // Credit Days on Order Form (Locks permanently if 45 days is selected)
  const [orderCreditDays, setOrderCreditDays] = useState<number>(0);
  const [isCreditLocked, setIsCreditLocked] = useState<boolean>(false);
  const [orderBusinessType, setOrderBusinessType] = useState<string>("");

  // Order Items in Draft
  const [items, setItems] = useState<DraftOrderItem[]>([]);
  const [orderNotes, setOrderNotes] = useState<string>("");
  const [customOrderNumber, setCustomOrderNumber] = useState<string>("");
  const [productsMap, setProductsMap] = useState<Record<number, any>>({});

  useEffect(() => {
    fetch("/api/products?active_only=1")
      .then((res) => res.json())
      .then((prods: any[]) => {
        if (Array.isArray(prods)) {
          const map: Record<number, any> = {};
          for (const p of prods) {
            map[p.id] = p;
          }
          setProductsMap(map);
        }
      })
      .catch(() => {});
  }, []);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Transport Popup Modal State
  const [isTransportModalOpen, setIsTransportModalOpen] = useState<boolean>(false);
  const [transportName, setTransportName] = useState<string>("");
  const [transportStation, setTransportStation] = useState<string>("");

  // Confirmation state
  const [confirmedOrder, setConfirmedOrder] = useState<ConfirmedOrder | null>(null);

  // Visiting Card Modal State
  const [viewVisitingCard, setViewVisitingCard] = useState<string | null>(null);

  // Authenticated employee & Admin
  const { employee } = useEmployee();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetch("/api/auth/check")
      .then((r) => r.json())
      .then((d) => {
        if (d?.authenticated) setIsAdmin(true);
      })
      .catch(() => {});
  }, []);

  const isTL = isEmployeeTeamLeader(employee);
  const canAdjustSpecialDiscount = isAdmin || isTL;

  // React to URL customerId query parameter changes (e.g. clicking Book on dashboard)
  useEffect(() => {
    const fromUrl = searchParams.get("customerId");
    if (fromUrl) {
      const p = parseInt(fromUrl, 10);
      if (!isNaN(p) && p !== selectedCustomerId) {
        setSelectedCustomerId(p);
      }
    }
  }, [searchParams]);

  // Load employee name from session or localStorage
  useEffect(() => {
    if (employee?.name) {
      setPlacedBy(employee.name);
      return;
    }
    try {
      const savedEmp = localStorage.getItem("garmentpro_employee_name");
      if (savedEmp) {
        setPlacedBy(savedEmp);
      }
    } catch {}
  }, [employee]);

  // Fetch customers
  const fetchCustomers = async () => {
    try {
      setLoadingCustomers(true);
      const res = await fetch("/api/customers");
      if (res.ok) {
        const data: CustomerData[] = await res.json();
        setCustomers(data);
      }
    } catch (err) {
      console.error("Failed to load customers:", err);
    } finally {
      setLoadingCustomers(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  // Load active draft from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("garmentpro_order_draft");
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft) {
          if (Array.isArray(draft.items)) {
            setItems(draft.items);
          }
          if (draft.notes) {
            setOrderNotes(draft.notes);
          }
          if (draft.placedBy && !placedBy) {
            setPlacedBy(draft.placedBy);
          }
          if (draft.creditDays !== undefined) {
            const cd = parseInt(draft.creditDays, 10) || 0;
            setOrderCreditDays(cd);
            if (cd === 45) {
              setIsCreditLocked(true);
            }
          }
          if (draft.businessType || draft.customer?.businessType) {
            setOrderBusinessType(draft.businessType || draft.customer?.businessType);
          }
          // Restore customer from active draft if not explicitly provided via URL query param
          const cidFromUrl = searchParams.get("customerId");
          if (!cidFromUrl) {
            const draftCustId = draft.customerId || draft.customer?.id;
            if (draftCustId) {
              const p = parseInt(draftCustId, 10);
              if (!isNaN(p)) {
                setSelectedCustomerId(p);
              }
            }
          }
        }
      }
    } catch (err) {
      console.error("Error reading order draft:", err);
    }
  }, []);

  // Helper for returnTo URL ensuring customerId is carried safely when navigating to products
  const getReturnToUrl = () => {
    return buildOrderFormReturnUrl(selectedCustomerId);
  };

  // Sync draft back to localStorage whenever it changes
  const saveDraft = (
    updatedItems: DraftOrderItem[],
    customerId: number | null,
    notes: string,
    employee: string,
    creditDaysVal?: number,
    customBType?: string
  ) => {
    try {
      const cust = customers.find((c) => c.id === customerId);
      const cd = creditDaysVal !== undefined ? creditDaysVal : orderCreditDays;
      const bType = customBType || orderBusinessType || cust?.businessType || "RETAILER";
      const draftObj = {
        customerId,
        businessType: bType,
        customer: cust
          ? {
              id: cust.id,
              shopName: cust.shopName,
              gstPanNo: cust.gstPanNo,
              phoneNumber: cust.phoneNumber,
              contactPerson: cust.contactPerson,
              address: cust.address,
              city: cust.city,
              state: cust.state,
              businessType: bType,
              specialDiscount: cust.specialDiscount || 0,
              creditDays: cust.creditDays || 0,
              visitingCardUrl: cust.visitingCardUrl,
            }
          : undefined,
        creditDays: cd,
        items: updatedItems,
        notes,
        placedBy: employee,
      };
      localStorage.setItem(STORAGE_KEY_ORDER_DRAFT, JSON.stringify(draftObj));
      window.dispatchEvent(new Event("garmentpro_draft_updated"));
    } catch (err) {
      console.error("Error saving draft to localStorage:", err);
    }
  };

  // Selected customer object (with strict customer isolation to prevent IDOR parameter tampering)
  const selectedCustomer = useMemo(() => {
    if (!selectedCustomerId || customers.length === 0) return null;
    const activeEmpName = (employee?.name || placedBy || "").trim().toLowerCase();
    const activeEmpId = employee?.id;
    const isKrishShah = isTL && activeEmpName.includes("krish");

    const found = customers.find((c) => c.id === selectedCustomerId) || null;
    if (!found) return null;

    // Security check: non-admin, non-KrishShah employees are isolated strictly to their allocated customers
    if (!isAdmin && !isKrishShah) {
      const matchesId = activeEmpId && found.allocatedEmployeeId === activeEmpId;
      const matchesName =
        activeEmpName &&
        found.allocatedEmployeeName &&
        found.allocatedEmployeeName.trim().toLowerCase() === activeEmpName;
      if (!matchesId && !matchesName) {
        return null;
      }
    }

    return found;
  }, [customers, selectedCustomerId, employee, placedBy, isAdmin, isTL]);

  // Effective Business Type across Order Form & Dynamic Pricing
  const effectiveBusinessType = orderBusinessType || selectedCustomer?.businessType || "RETAILER";

  // Check whether the selected customer is registered with GST/PAN
  const isWithoutGst = useMemo(() => {
    const bt = (effectiveBusinessType || selectedCustomer?.businessType || orderBusinessType || "").toUpperCase();
    return (
      bt.includes("WITHOUT GST") ||
      bt.includes("NO GST") ||
      bt === "WHOLESALER WITHOUT GST" ||
      bt === "WHOLESELLER (WITHOUT GST)" ||
      bt === "WHOLESALE WITHOUT GST"
    );
  }, [effectiveBusinessType, selectedCustomer, orderBusinessType]);

  const isCustomerGstRegistered = useMemo(() => {
    if (!selectedCustomer) return false;
    if (isWithoutGst) {
      return true; // No GST/PAN needed for without GST customers
    }
    return isGstPanRegistered(selectedCustomer.gstPanNo);
  }, [selectedCustomer, isWithoutGst]);

  // Automatically open editable GST/PAN field if customer is NOT registered & synchronize customer metadata
  useEffect(() => {
    if (selectedCustomer) {
      const bType = businessTypeParam || selectedCustomer.businessType || "RETAILER";
      if (!orderBusinessType) {
        setOrderBusinessType(bType);
      }
      if (orderCreditDays === 0 && selectedCustomer.creditDays) {
        setOrderCreditDays(selectedCustomer.creditDays);
        if (selectedCustomer.creditDays === 45) {
          setIsCreditLocked(true);
        }
      }
      try {
        localStorage.setItem("garmentpro_selected_customer_id", String(selectedCustomer.id));
      } catch {}

      if (isWithoutGst) {
        setIsEditingGstPan(false);
        setCustomGstPan(selectedCustomer.gstPanNo || "");
      } else if (!isGstPanRegistered(selectedCustomer.gstPanNo)) {
        setIsEditingGstPan(true);
        setCustomGstPan("");
      } else {
        setCustomGstPan(selectedCustomer.gstPanNo.toUpperCase());
        setIsEditingGstPan(false);
      }

      saveDraft(items, selectedCustomer.id, orderNotes, placedBy, selectedCustomer.creditDays || orderCreditDays, bType);
    } else {
      setIsEditingGstPan(false);
      setCustomGstPan("");
    }
  }, [selectedCustomer, isWithoutGst, businessTypeParam]);

  // Handle Credit Days Change with permanent lock when set to 45 Days
  const handleCreditDaysChange = (days: number) => {
    if (isCreditLocked || orderCreditDays === 45) {
      toast("Credit Days is set to 45 Days and cannot be modified from employee side.", "error");
      return;
    }
    setOrderCreditDays(days);
    if (days === 45) {
      setIsCreditLocked(true);
      toast("Credit terms set to 45 Days — Locked permanently for employee side.", "success");
    }
    saveDraft(items, selectedCustomerId, orderNotes, placedBy, days);
  };

  // Filtered customer list for searchable dropdown (Allocated customers prioritized)
  const filteredCustomers = useMemo(() => {
    const activeEmpName = (employee?.name || placedBy || "").trim().toLowerCase();
    const activeEmpId = employee?.id;
    const isKrishShah = isTL && activeEmpName.includes("krish");

    let list = customers;

    // Strict customer isolation for non-admin, non-KrishShah employees:
    // "IF THERE IS ANY NEW EMPLOYEE AND NO CUSTOMERS ARE ALLOCATED DO NOT SHOW ANY CUSTOMERS PRESENT IN THE CUSTOMERS TAB."
    // "DONT SHOW OTHER EMPLOYEES DATA IN THAT EMPLOYEES PORTAL. FOR EG. KRISH SHAH USER DATA IS SHOWN IN YASH RAVAL (NOT ALLOWED)."
    if (!isAdmin && !isKrishShah) {
      list = list.filter((c) => {
        const matchesId = activeEmpId && c.allocatedEmployeeId === activeEmpId;
        const matchesName =
          activeEmpName &&
          c.allocatedEmployeeName &&
          c.allocatedEmployeeName.trim().toLowerCase() === activeEmpName;
        return matchesId || matchesName;
      });
    }

    if (customerSearchQuery.trim()) {
      const term = customerSearchQuery.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.shopName.toLowerCase().includes(term) ||
          c.gstPanNo.toLowerCase().includes(term) ||
          c.phoneNumber.toLowerCase().includes(term) ||
          (c.contactPerson && c.contactPerson.toLowerCase().includes(term))
      );
    }

    return [...list].sort((a, b) => {
      const aAllocated =
        (activeEmpId && a.allocatedEmployeeId === activeEmpId) ||
        (activeEmpName && a.allocatedEmployeeName && a.allocatedEmployeeName.trim().toLowerCase() === activeEmpName);
      const bAllocated =
        (activeEmpId && b.allocatedEmployeeId === activeEmpId) ||
        (activeEmpName && b.allocatedEmployeeName && b.allocatedEmployeeName.trim().toLowerCase() === activeEmpName);

      if (aAllocated && !bAllocated) return -1;
      if (!aAllocated && bAllocated) return 1;
      return a.shopName.localeCompare(b.shopName);
    });
  }, [customers, customerSearchQuery, employee, placedBy, isAdmin, isTL]);

  // Handle customer unselection / clear
  const handleUnselectCustomer = () => {
    setSelectedCustomerId(null);
    setOrderCreditDays(0);
    setIsCreditLocked(false);
    setIsEditingGstPan(false);
    setCustomGstPan("");
    try {
      localStorage.removeItem("garmentpro_selected_customer_id");
    } catch {}
    saveDraft(items, null, orderNotes, placedBy, 0);
    toast("Customer unselected. Customer selection is mandatory to add products.", "info");
  };

  // Handle customer selection (allows select & unselect)
  const handleSelectCustomer = (c: CustomerData) => {
    if (selectedCustomerId === c.id) {
      handleUnselectCustomer();
      setCustomerDropdownOpen(false);
      return;
    }

    setSelectedCustomerId(c.id);
    setCustomerDropdownOpen(false);
    setCustomerSearchQuery("");

    const custBusinessType = c.businessType || "RETAILER";
    setOrderBusinessType(custBusinessType);

    const isCustWithoutGst =
      custBusinessType.toUpperCase().includes("WITHOUT GST") ||
      custBusinessType.toUpperCase().includes("NO GST") ||
      custBusinessType === "WHOLESALER WITHOUT GST" ||
      custBusinessType === "WHOLESELLER (WITHOUT GST)";

    // GST/PAN check: if not registered AND NOT wholesaler without GST, open the field immediately and warn
    const isRegistered = isGstPanRegistered(c.gstPanNo);
    if (!isCustWithoutGst && !isRegistered) {
      setIsEditingGstPan(true);
      setCustomGstPan("");
      toast(`⚠️ Customer ${c.shopName.toUpperCase()} is NOT GST/PAN registered. Please enter & save GST/PAN details below to unlock product addition.`, "error");
    } else {
      setIsEditingGstPan(false);
      setCustomGstPan(c.gstPanNo ? c.gstPanNo.toUpperCase() : "NOT REQUIRED");
    }

    // Credit Days handling: if set to 45, lock permanently
    const custCredit = c.creditDays || 0;
    setOrderCreditDays(custCredit);
    if (custCredit === 45) {
      setIsCreditLocked(true);
    } else {
      setIsCreditLocked(false);
    }

    // Dynamic Price sync:
    // If selected customer is Retailer or Retailer with Special Discount -> Base Price is Retailer Price (MRP / 2)
    // If selected customer is Retailer with Special Discount -> Base Price is (MRP / 2) - specialDiscount
    // If selected customer is Wholesale -> use Wholesaler Price (MRP / 2 - 100)
    const isWholesaler =
      custBusinessType === "WHOLESALER" ||
      custBusinessType === "WHOLESALER WITHOUT GST" ||
      custBusinessType.toUpperCase().includes("WHOLESAL");
    const specialDiscountAmt = Number(c.specialDiscount) || 0;
    const isSpecialDiscount = specialDiscountAmt > 0 || custBusinessType === "RETAILER WITH SPECIAL DISCOUNT";
    const updatedItems = items.map((it) => {
      const prod = productsMap[it.productId];
      const retPrice = it.retailerPrice ?? prod?.retailerPrice ?? prod?.price ?? it.unitPrice;
      const whoPrice = it.wholesalerPrice ?? prod?.wholesalerPrice ?? Math.max(0, retPrice - 100);

      let applicableUnitPrice = it.unitPrice;
      if (isWholesaler) {
        applicableUnitPrice = isSpecialDiscount ? Math.max(0, whoPrice - specialDiscountAmt) : whoPrice;
      } else {
        applicableUnitPrice = isSpecialDiscount ? Math.max(0, retPrice - specialDiscountAmt) : retPrice;
      }
      return {
        ...it,
        retailerPrice: retPrice,
        wholesalerPrice: whoPrice,
        unitPrice: applicableUnitPrice,
        itemSubtotal: (it.totalPcs || 0) * applicableUnitPrice,
      };
    });

    setItems(updatedItems);
    saveDraft(updatedItems, c.id, orderNotes, placedBy, custCredit, custBusinessType);
    if (isRegistered) {
      toast(`Customer selected: ${c.shopName.toUpperCase()} (${isWholesaler ? "Wholesale" : "Retailer"})`);
    }
  };

  // Immediate Business Type Change & Price Recalculation Handler
  const handleBusinessTypeChange = (newType: string) => {
    // Only Admin or T.L. has capability to adjust business types
    if (!isAdmin && !isTL) {
      toast("Permission Denied: Only Admin can change customer business type.", "error");
      return;
    }

    setOrderBusinessType(newType);

    // Only Admin/Super Admin is authorized to alter customer businessType in the database
    if (isAdmin && selectedCustomerId) {
      setCustomers((prev) =>
        prev.map((c) => (c.id === selectedCustomerId ? { ...c, businessType: newType } : c))
      );
      fetch(`/api/customers/${selectedCustomerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessType: newType }),
      }).catch((err) => console.error("Error updating customer businessType:", err));
    }

    const isWholesaler =
      newType === "WHOLESALER" ||
      newType === "WHOLESALER WITHOUT GST" ||
      newType.toUpperCase().includes("WHOLESAL");
    const specialDiscountAmt = Number(selectedCustomer?.specialDiscount) || 0;
    const isSpecialDiscount = specialDiscountAmt > 0 || newType === "RETAILER WITH SPECIAL DISCOUNT";

    const updatedItems = items.map((it) => {
      const prod = productsMap[it.productId];
      const retPrice = it.retailerPrice ?? prod?.retailerPrice ?? prod?.price ?? it.unitPrice;
      const whoPrice = it.wholesalerPrice ?? prod?.wholesalerPrice ?? Math.max(0, retPrice - 100);

      let applicableUnitPrice = it.unitPrice;
      if (isWholesaler) {
        applicableUnitPrice = isSpecialDiscount ? Math.max(0, whoPrice - specialDiscountAmt) : whoPrice;
      } else {
        applicableUnitPrice = isSpecialDiscount ? Math.max(0, retPrice - specialDiscountAmt) : retPrice;
      }

      return {
        ...it,
        retailerPrice: retPrice,
        wholesalerPrice: whoPrice,
        unitPrice: applicableUnitPrice,
        itemSubtotal: (it.totalPcs || 0) * applicableUnitPrice,
      };
    });

    setItems(updatedItems);
    saveDraft(updatedItems, selectedCustomerId, orderNotes, placedBy, orderCreditDays, newType);

    toast(`Type of Business changed to ${newType === "WHOLESALER" ? "Wholesale" : newType}. Prices updated immediately!`);
  };

  // Handle Save / Register Customer GST/PAN (registers customer and unlocks adding products)
  const handleSaveCustomerGstPan = async () => {
    if (!selectedCustomer) {
      toast("Please select a customer first.", "error");
      return;
    }

    const cleaned = customGstPan.trim().toUpperCase();
    if (!cleaned || !isGstPanRegistered(cleaned)) {
      toast("Mandatory: Please enter a valid GST No. (15 characters) or PAN No. (10 characters)", "error");
      return;
    }
    if (cleaned.length < 10) {
      toast("GST No. / PAN No. must be at least 10 characters long.", "error");
      return;
    }

    try {
      setIsSavingGstPan(true);
      const res = await fetch(`/api/customers/${selectedCustomer.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gstPanNo: cleaned }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update GST/PAN");
      }

      // Update customers state locally
      setCustomers((prev) =>
        prev.map((c) => (c.id === selectedCustomer.id ? { ...c, gstPanNo: cleaned } : c))
      );

      // Update draft in localStorage
      saveDraft(items, selectedCustomer.id, orderNotes, placedBy);

      setIsEditingGstPan(false);
      toast(`Customer GST/PAN saved as ${cleaned}! You can now add products to the form.`, "success");
    } catch (err: any) {
      toast(err.message || "Failed to save GST/PAN", "error");
    } finally {
      setIsSavingGstPan(false);
    }
  };

  // Handle Remove Item
  const handleRemoveItem = (index: number) => {
    const removedItem = items[index];
    const updated = items.filter((_, idx) => idx !== index);
    setItems(updated);
    saveDraft(updated, selectedCustomerId, orderNotes, placedBy);
    if (removedItem?.productId) {
      fetch("/api/stock/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: getClientSessionId(),
          productId: removedItem.productId,
        }),
      }).catch(() => {});
    }
    toast("Item removed from order form");
  };

  // Handle Clear Entire Form / Draft
  const handleClearDraft = () => {
    if (confirm("Are you sure you want to clear this order form?")) {
      setItems([]);
      setSelectedCustomerId(null);
      setOrderNotes("");
      fetch("/api/stock/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: getClientSessionId() }),
      }).catch(() => {});
      localStorage.removeItem("garmentpro_order_draft");
      window.dispatchEvent(new Event("garmentpro_draft_updated"));
      toast("Order form cleared");
    }
  };


  // Mathematical Calculations
  const totalSets = items.reduce((sum, it) => sum + (it.totalSets || 0), 0);
  const totalPcs = items.reduce((sum, it) => sum + (it.totalPcs || 0), 0);
  const subtotal = items.reduce((sum, it) => sum + (it.itemSubtotal || 0), 0);
  const gstRate = isWithoutGst ? 0 : 5.0; // 5% GST or 0% for Wholesaler Without GST
  const gstAmount = isWithoutGst ? 0 : Math.round(subtotal * 0.05 * 100) / 100;
  const grandTotal = Math.round(subtotal + gstAmount);

  // Step 1: Validate and Open Transport Popup Modal
  const handleSubmitOrder = () => {
    // 1. Mandatory Customer Selection Check
    if (!selectedCustomerId || !selectedCustomer) {
      toast("Mandatory: Customer selection is required. Please select a Customer / Shop Name from the dropdown.", "error");
      setCustomerDropdownOpen(true);
      return;
    }

    // 1b. Mandatory GST/PAN Registration Check (skipped for Without GST customers)
    if (!isWithoutGst && !isGstPanRegistered(selectedCustomer.gstPanNo)) {
      toast("Mandatory: Customer is NOT GST/PAN registered. Please enter and save GST/PAN details before booking order.", "error");
      setIsEditingGstPan(true);
      return;
    }

    // 2. Mandatory Items Check
    if (items.length === 0) {
      toast("Mandatory: Please add at least 1 product item to the order form before booking.", "error");
      return;
    }

    // 3. Mandatory Placed By Check
    const finalPlacedBy = (employee?.name || placedBy).trim();
    if (!finalPlacedBy) {
      toast("Mandatory: Employee Name is required. Please log in as an employee to place orders.", "error");
      return;
    }

    // Auto-fill transport station with customer city if available
    if (!transportStation && selectedCustomer.city) {
      setTransportStation(selectedCustomer.city.toUpperCase());
    }

    // Open Transport Popup
    setIsTransportModalOpen(true);
  };

  // Step 2: Final Submit with Transport Name Confirmed
  const handleFinalSubmitOrder = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!transportName.trim()) {
      toast("Mandatory: Transport Name / Courier Service is required to dispatch the order", "error");
      return;
    }

    const finalPlacedBy = (employee?.name || placedBy).trim();
    if (!finalPlacedBy) {
      toast("Mandatory: Please log in as an employee to place orders", "error");
      return;
    }

    try {
      setIsSubmitting(true);
      localStorage.setItem("garmentpro_employee_name", finalPlacedBy);

      // Structure transport info inside order notes
      const transportDetails = transportName.trim()
        ? `[TRANSPORT: ${transportName.trim()}${transportStation.trim() ? ` | Station: ${transportStation.trim()}` : ""}]`
        : "";
      const finalNotes = [transportDetails, orderNotes.trim()].filter(Boolean).join("\n");

      const payload = {
        sessionId: getClientSessionId(),
        orderNumber: customOrderNumber.trim() || undefined,
        customerId: selectedCustomerId,
        placedBy: finalPlacedBy,
        businessType: effectiveBusinessType,
        creditDays: orderCreditDays,
        notes: finalNotes || undefined,
        items: items.map((it) => ({
          productId: it.productId,
          colorSets: it.colorSets,
          sizeRatio: it.sizeRatio,
          sizesList: it.sizesList,
          pcsPerSet: it.pcsPerSet,
          totalSets: it.totalSets,
          totalPcs: it.totalPcs,
          mixPcs: it.mixPcs,
          mixSizes: it.mixSizes,
          colorMixPcs: (it as any).colorMixPcs,
          unitPrice: it.unitPrice,
          notes: it.notes,
        })),
      };

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `Failed to submit order (${res.status})`);
      }

      const result = await res.json();

      // Clear draft
      localStorage.removeItem("garmentpro_order_draft");
      window.dispatchEvent(new Event("garmentpro_draft_updated"));

      setConfirmedOrder({
        id: result.id,
        orderNumber: result.orderNumber,
        customerName: selectedCustomer!.shopName,
        customerPhone: selectedCustomer!.phoneNumber,
        customerGstPan: selectedCustomer!.gstPanNo,
        grandTotal: result.grandTotal || grandTotal,
        totalPcs: result.totalPcs || totalPcs,
        totalSets: result.totalSets || totalSets,
        orderDate: new Date().toISOString(),
        transportName: transportName.trim() || undefined,
        whatsAppSent: result.whatsAppSent,
      });

      setIsTransportModalOpen(false);
      if (result.whatsAppSent) {
        toast(`✅ Order #${result.orderNumber} placed & WhatsApp sent to customer!`, "success");
      } else {
        toast(`Order #${result.orderNumber} placed successfully!`);
      }
    } catch (err: any) {
      console.error("Order submission failed:", err);
      toast(err.message || "Failed to place order", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // If order was confirmed, show Success Confirmation Screen
  if (confirmedOrder) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
        <UserHeader />
        <div className="max-w-2xl mx-auto px-4 pt-12 sm:pt-16">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-8 sm:p-10 text-center space-y-6">
            <div className="w-20 h-20 bg-emerald-100 rounded-3xl flex items-center justify-center text-emerald-600 mx-auto shadow-inner">
              <CheckCircle2 size={44} />
            </div>

            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                Order Booked Successfully
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">
                Wholesale Order Confirmed!
              </h1>
              <p className="text-sm text-slate-500 mt-1 font-mono">
                Order #{confirmedOrder.orderNumber}
              </p>
            </div>

            {/* Order Brief Summary */}
            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 text-left space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Customer Shop Name:</span>
                <span className="font-bold text-slate-900">{confirmedOrder.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">GST / PAN No.:</span>
                <span className="font-mono font-bold text-slate-900">
                  {confirmedOrder.customerGstPan}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Sets & Pieces:</span>
                <span className="font-bold text-slate-900">
                  {confirmedOrder.totalSets} Sets ({confirmedOrder.totalPcs} Pcs)
                </span>
              </div>
              {confirmedOrder.transportName && (
                <div className="flex justify-between text-slate-700">
                  <span className="text-slate-500">Transport:</span>
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Truck size={14} className="text-orange-500" />
                    <span>{confirmedOrder.transportName}</span>
                  </span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-slate-200 text-base">
                <span className="font-bold text-slate-900">Grand Total:</span>
                <span className="font-black text-orange-600">
                  {formatCurrency(confirmedOrder.grandTotal)}
                </span>
              </div>
            </div>

            {/* WhatsApp Direct Dispatch Status Notice */}
            {confirmedOrder.whatsAppSent ? (
              <div className="w-full p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center justify-center gap-2 text-center">
                <span>✅ Tax Invoice & Order confirmation sent directly to customer ({confirmedOrder.customerPhone || "phone"}) via WhatsApp!</span>
              </div>
            ) : (
              <div className="w-full p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-medium flex items-center justify-center gap-2 text-center">
                <span>ℹ️ Automated WhatsApp message ready to send.</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await fetch(`/api/orders/${confirmedOrder.id}/whatsapp`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ type: "ORDER_CONFIRMATION" }),
                    });
                    const data = await res.json();
                    if (!res.ok) {
                      throw new Error(data.error || "Failed to dispatch WhatsApp");
                    }
                    if (data.automated) {
                      toast(`✅ Order Form PDF generated & sent directly to ${data.customerName || "customer"} (${data.customerPhone || ""}) via WhatsApp!`, "success");
                    } else {
                      toast(data.error || "Could not dispatch WhatsApp message. Please check WhatsApp Gateway.", "error");
                    }
                  } catch (err: any) {
                    toast(err.message || "Could not send WhatsApp message", "error");
                  }
                }}
                className="w-full sm:w-auto px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md shadow-emerald-900/20 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <MessageCircle size={16} />
                <span>{confirmedOrder.whatsAppSent ? "Resend on WhatsApp" : "Send on WhatsApp"}</span>
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="w-full sm:w-auto px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Printer size={16} />
                <span>Print A4 Invoice</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setConfirmedOrder(null);
                  setItems([]);
                  setSelectedCustomerId(null);
                  setOrderNotes("");
                }}
                className="w-full sm:w-auto px-5 py-3 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white rounded-xl font-bold text-xs shadow-md transition flex items-center justify-center gap-2"
              >
                <FilePlus size={16} />
                <span>+ Take Another Order</span>
              </button>

              <Link
                href={`/orders/${confirmedOrder.id}`}
                className="w-full sm:w-auto px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs border border-slate-300 transition flex items-center justify-center gap-2"
              >
                <FileText size={16} />
                <span>Open in Order Page</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Page Title: Only keep H1 tag for Order Form */}
        <div className="flex items-center justify-between pb-1">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Order Form
          </h1>
          {items.length > 0 && (
            <button
              type="button"
              onClick={handleClearDraft}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-bold border border-slate-200 transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <RotateCcw size={14} />
              <span>Clear Form</span>
            </button>
          )}
        </div>

        {/* ═══════════════════════════════════════════
            1. CUSTOMER SELECTION (MANDATORY)
            ═══════════════════════════════════════════ */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Users size={20} className="text-orange-600" />
              <h2 className="text-base font-black text-slate-900">
                Customer Selection <span className="text-red-500 text-xs font-bold">(MANDATORY)</span>
              </h2>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              {selectedCustomer && (
                <button
                  type="button"
                  onClick={handleUnselectCustomer}
                  className="text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-xl border border-red-200 transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  title="Unselect customer"
                >
                  <X size={13} />
                  <span>Unselect Customer</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    saveDraft(items, selectedCustomerId, orderNotes, placedBy);
                  }
                  router.push(`/customers/new?returnTo=${encodeURIComponent(getReturnToUrl())}`);
                }}
                className="text-xs font-bold text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 px-3.5 py-1.5 rounded-xl border border-orange-200 transition flex items-center gap-1.5 cursor-pointer shadow-xs hover:border-orange-300"
              >
                <Plus size={14} />
                <span>Add New Customer</span>
              </button>
            </div>
          </div>

          {/* Searchable Customer Dropdown */}
          <div className="relative">
            <div
              onClick={() => setCustomerDropdownOpen(!customerDropdownOpen)}
              className={`w-full p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                selectedCustomer
                  ? "bg-orange-50/40 border-orange-300 ring-1 ring-orange-400/30"
                  : "bg-white border-slate-300 hover:border-slate-400"
              }`}
            >
              {selectedCustomer ? (
                <div className="flex items-center justify-between w-full pr-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-600 text-white flex items-center justify-center font-black text-sm shrink-0">
                      {selectedCustomer.shopName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-black text-slate-900 text-sm uppercase">
                        {selectedCustomer.shopName.toUpperCase()}
                      </div>
                      <div className="text-xs text-slate-600 flex items-center gap-3 uppercase">
                        <span>
                          GST/PAN: <strong className="font-mono text-slate-900">{selectedCustomer.gstPanNo.toUpperCase()}</strong>
                        </span>
                        <span>•</span>
                        <span>Ph: {selectedCustomer.phoneNumber}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUnselectCustomer();
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition text-xs font-bold flex items-center gap-1 cursor-pointer"
                    title="Unselect customer"
                  >
                    <X size={15} />
                    <span className="hidden sm:inline">Unselect</span>
                  </button>
                </div>
              ) : (
                <div className="text-xs font-semibold text-slate-500 flex items-center gap-2">
                  <Search size={16} className="text-slate-400" />
                  <span>Select customer from dropdown (Mandatory to add products)...</span>
                </div>
              )}

              <ChevronDown
                size={18}
                className={`text-slate-400 transition-transform ${
                  customerDropdownOpen ? "rotate-180" : ""
                }`}
              />
            </div>

            {/* Dropdown Menu */}
            {customerDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-slate-200 shadow-2xl z-30 p-3 space-y-2 max-h-72 overflow-y-auto">
                {/* Search Input */}
                <div className="relative">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    autoFocus
                    placeholder="Search customer by shop name or GST/PAN..."
                    value={customerSearchQuery}
                    onChange={(e) => setCustomerSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white uppercase placeholder:normal-case"
                  />
                </div>

                {/* Customers list */}
                <div className="divide-y divide-slate-100 max-h-52 overflow-y-auto">
                  {selectedCustomer && (
                    <div
                      onClick={() => {
                        handleUnselectCustomer();
                        setCustomerDropdownOpen(false);
                      }}
                      className="p-2.5 rounded-xl cursor-pointer hover:bg-red-50 text-red-600 text-xs font-bold flex items-center gap-2 border-b border-red-100 transition"
                    >
                      <X size={14} />
                      <span>✕ Unselect / Clear Customer Selection</span>
                    </div>
                  )}

                  {loadingCustomers ? (
                    <div className="p-4 text-center text-xs text-slate-500">
                      Loading customers...
                    </div>
                  ) : customers.length === 0 ? (
                    <div className="p-4 text-center text-xs text-amber-700 bg-amber-50/50 rounded-xl space-y-1">
                      <div className="font-bold">No Customers Allocated Yet</div>
                      <div className="text-[11px] text-slate-500">
                        You do not have any customers assigned to your account. Please ask the administrator to allocate customer accounts to your portfolio.
                      </div>
                    </div>
                  ) : filteredCustomers.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500">
                      No matching customer found in your allocated portfolio.
                    </div>
                  ) : (
                    filteredCustomers.map((cust) => {
                      const activeEmpName = (employee?.name || placedBy || "").trim().toLowerCase();
                      const isAllocatedToMe =
                        (employee?.id && cust.allocatedEmployeeId === employee.id) ||
                        (activeEmpName && cust.allocatedEmployeeName && cust.allocatedEmployeeName.trim().toLowerCase() === activeEmpName);
                      const isWholesaleNoGst =
                        (cust.businessType || "").toUpperCase().includes("WITHOUT GST") ||
                        (cust.businessType || "").toUpperCase().includes("NO GST");

                      return (
                        <div
                          key={cust.id}
                          onClick={() => handleSelectCustomer(cust)}
                          className={`p-2.5 rounded-xl cursor-pointer hover:bg-orange-50 transition flex items-center justify-between ${
                            selectedCustomerId === cust.id ? "bg-orange-50/70 font-bold" : ""
                          }`}
                        >
                          <div>
                            <div className="text-xs font-bold text-slate-900 uppercase flex items-center gap-1.5 flex-wrap">
                              <span>{cust.shopName.toUpperCase()}</span>
                              {isAllocatedToMe && (
                                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.2 rounded-full">
                                  ⭐ Allocated to you
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono uppercase flex items-center gap-1.5 flex-wrap">
                              {isWholesaleNoGst ? (
                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1 py-0.2 rounded">
                                  WHOLESALER (WITHOUT GST)
                                </span>
                              ) : !isGstPanRegistered(cust.gstPanNo) ? (
                                <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-1 py-0.2 rounded">
                                  ⚠️ NOT GST/PAN REGISTERED
                                </span>
                              ) : (
                                <span>GST/PAN: {cust.gstPanNo.toUpperCase()}</span>
                              )}
                              <span>• Ph: {cust.phoneNumber}</span>
                            </div>
                          </div>

                          {selectedCustomerId === cust.id && (
                            <span className="text-xs font-bold text-orange-600">✓ Selected (Click to unselect)</span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Customer Metadata Card (when selected) */}
          {selectedCustomer && (
            <div className="p-4 bg-orange-50/40 rounded-2xl border border-orange-200/80 text-xs space-y-3">
              <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 flex-1 w-full">
                  <div>
                    <span className="text-slate-400 block font-bold text-[10px] uppercase tracking-wider">
                      FIRM NAME
                    </span>
                    <span className="font-black text-slate-900 text-sm uppercase">
                      {selectedCustomer.shopName.toUpperCase()}
                    </span>
                  </div>

                  <div className="sm:col-span-2 lg:col-span-2">
                    {isWithoutGst ? (
                      <div>
                        <span className="text-slate-400 block font-bold text-[10px] uppercase tracking-wider">
                          GST NO. / PAN NO.
                        </span>
                        <span className="font-mono font-black text-orange-600 text-sm uppercase">
                          {selectedCustomer.gstPanNo && selectedCustomer.gstPanNo !== "NOT REQUIRED" && selectedCustomer.gstPanNo !== "—" ? selectedCustomer.gstPanNo.toUpperCase() : ""}
                        </span>
                      </div>
                    ) : !isCustomerGstRegistered ? (
                      <div className="bg-amber-50/90 border-2 border-amber-400 p-3 rounded-xl space-y-1.5 shadow-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-amber-900 block font-black text-[10px] uppercase tracking-wider flex items-center gap-1">
                            <AlertCircle size={13} className="text-amber-600 shrink-0" />
                            GST NO. / PAN NO. (MANDATORY TO ADD PRODUCTS)
                          </span>
                          <span className="text-[9px] bg-red-100 text-red-700 font-black px-1.5 py-0.5 rounded uppercase">
                            Not Registered
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            autoFocus
                            value={customGstPan}
                            onChange={(e) => setCustomGstPan(e.target.value.toUpperCase())}
                            placeholder="ENTER 15-DIGIT GSTIN OR 10-DIGIT PAN"
                            className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-mono font-black uppercase text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none placeholder:normal-case placeholder:font-normal"
                          />
                          <button
                            type="button"
                            disabled={isSavingGstPan || !customGstPan.trim()}
                            onClick={handleSaveCustomerGstPan}
                            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg text-xs font-black shadow-xs shrink-0 cursor-pointer transition flex items-center gap-1"
                          >
                            {isSavingGstPan ? <Loader2 size={12} className="animate-spin" /> : null}
                            <span>Save &amp; Unlock</span>
                          </button>
                        </div>
                        <p className="text-[10px] text-amber-800 font-medium">
                          ⚠️ This customer does not have a registered GST/PAN. Adding products is locked until GST/PAN is entered &amp; saved above.
                        </p>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 block font-bold text-[10px] uppercase tracking-wider">
                            GST NO. / PAN NO.
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                            <Lock size={10} />
                            <span>Locked</span>
                          </span>
                        </div>
                        <span className="font-mono font-black text-orange-600 text-sm uppercase">
                          {selectedCustomer.gstPanNo.toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>

                  <div>
                    <span className="text-slate-400 block font-bold text-[10px] uppercase tracking-wider">
                      PHONE NUMBER
                    </span>
                    <span className="font-bold text-slate-800 text-sm">
                      {selectedCustomer.phoneNumber}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block font-bold text-[10px] uppercase tracking-wider">
                      Contact PERSON NAME
                    </span>
                    <span className="font-semibold text-slate-800 text-xs uppercase">
                      {(selectedCustomer.contactPerson || "—").toUpperCase()}
                    </span>
                  </div>
                </div>

                {selectedCustomer.visitingCardUrl && (
                  <div className="shrink-0 flex flex-col items-center">
                    <span className="text-slate-400 block font-bold text-[10px] uppercase tracking-wider mb-1">
                      VISITING CARD
                    </span>
                    <button
                      type="button"
                      onClick={() => setViewVisitingCard(selectedCustomer.visitingCardUrl!)}
                      className="group relative block w-16 h-12 rounded-lg overflow-hidden border border-orange-200 shadow-xs hover:ring-2 hover:ring-orange-500 transition cursor-pointer text-left"
                      title="Click to view visiting card full size"
                    >
                      <img
                        src={selectedCustomer.visitingCardUrl}
                        alt="Visiting Card"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[9px] font-bold">
                        View
                      </div>
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2.5 border-t border-orange-100">
                <div className="sm:col-span-2">
                  <span className="text-slate-400 block font-bold text-[10px] uppercase tracking-wider">
                    Shop Address
                  </span>
                  <span className="font-medium text-slate-800 uppercase">
                    {(selectedCustomer.address || "Address on File").toUpperCase()}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-slate-400 block font-bold text-[10px] uppercase tracking-wider">
                      CITY
                    </span>
                    <span className="font-bold text-slate-900 uppercase">
                      {(selectedCustomer.city || "—").toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-bold text-[10px] uppercase tracking-wider">
                      STATE
                    </span>
                    <span className="font-bold text-slate-900 uppercase">
                      {(selectedCustomer.state || "—").toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. Business Type & Order Credit Days Terms */}
              <div className="pt-3 border-t border-orange-200/80 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1.5">
                    <span className="text-slate-400 block font-bold text-[10px] uppercase tracking-wider">
                      Type of Business
                    </span>
                    <div className="flex items-center gap-2">
                      {effectiveBusinessType === "WHOLESALER WITHOUT GST" || effectiveBusinessType === "WHOLESALE WITHOUT GST" ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-fuchsia-50 text-fuchsia-800 border border-fuchsia-300 rounded-xl text-xs font-black uppercase tracking-wide shadow-2xs">
                          <Lock size={12} className="text-fuchsia-600" />
                          <span>
                            Wholesale (Without GST){selectedCustomer?.specialDiscount ? ` (Spl Disc: -₹${selectedCustomer.specialDiscount})` : ""} (Locked)
                          </span>
                        </span>
                      ) : effectiveBusinessType === "RETAILER WITHOUT GST" || effectiveBusinessType === "RETAILER (WITHOUT GST)" ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 text-teal-800 border border-teal-300 rounded-xl text-xs font-black uppercase tracking-wide shadow-2xs">
                          <Lock size={12} className="text-teal-600" />
                          <span>
                            Retailer (Without GST){selectedCustomer?.specialDiscount ? ` (Spl Disc: -₹${selectedCustomer.specialDiscount})` : ""} (Locked)
                          </span>
                        </span>
                      ) : effectiveBusinessType === "WHOLESALER" || effectiveBusinessType === "WHOLESALE" ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-xl text-xs font-black uppercase tracking-wide shadow-2xs">
                          <Lock size={12} className="text-purple-500" />
                          <span>
                            Wholesale{selectedCustomer?.specialDiscount ? ` (Spl Disc: -₹${selectedCustomer.specialDiscount})` : ""} (Locked)
                          </span>
                        </span>
                      ) : effectiveBusinessType === "RETAILER WITH SPECIAL DISCOUNT" || (selectedCustomer?.specialDiscount && selectedCustomer.specialDiscount > 0) ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-black uppercase tracking-wide shadow-2xs">
                          <Lock size={12} className="text-emerald-600" />
                          <span>
                            Retailer (Spl Disc{selectedCustomer?.specialDiscount ? `: -₹${selectedCustomer.specialDiscount}` : ""}) (Locked)
                          </span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl text-xs font-black uppercase tracking-wide shadow-2xs">
                          <Lock size={12} className="text-blue-500" />
                          <span>Retailer (Locked)</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-400 block font-bold text-[10px] uppercase tracking-wider mb-1">
                      Order Credit Terms
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-800 border border-slate-200 rounded-xl text-xs font-bold font-mono">
                      <Clock size={12} className="text-slate-500" />
                      <span>{orderCreditDays > 0 ? `${orderCreditDays} Days` : "Advance (0 Days)"}</span>
                    </span>
                  </div>
                </div>

              </div>
            </div>
          )}
        </section>

        {/* ═══════════════════════════════════════════
            2. ORDER FORM TABLE
            COLUMNS: Customer Name, GST/PAN No., Product Name, Colors, PCS, Price, Total Amount
            ═══════════════════════════════════════════ */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-0">
          {/* Table Header toolbar */}
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70">
            <div>
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <span>Wholesale Product Items</span>
                <span className="text-xs font-bold text-slate-500">
                  ({items.length} {items.length === 1 ? "style" : "styles"} selected)
                </span>
              </h2>
            </div>

            {selectedCustomer && isCustomerGstRegistered && (
              <button
                type="button"
                onClick={() => router.push(`/products?returnTo=${encodeURIComponent(getReturnToUrl())}`)}
                className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white rounded-xl text-xs font-bold shadow-md shadow-orange-500/20 transition flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
              >
                <Plus size={16} />
                <span>Add Product to Form</span>
              </button>
            )}

            {selectedCustomer && !isCustomerGstRegistered && (
              <div className="px-3 py-1.5 bg-amber-50 border border-amber-300 text-amber-900 rounded-xl text-xs font-bold flex items-center gap-1.5">
                <AlertCircle size={14} className="text-amber-600 shrink-0" />
                <span>Enter GST/PAN above to unlock adding products</span>
              </div>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Product Name</th>
                  <th className="py-3.5 px-4">Colors & Sets</th>
                  <th className="py-3.5 px-4 text-center">Mix Sizes</th>
                  <th className="py-3.5 px-4 text-center">PCS</th>
                  <th className="py-3.5 px-4 text-right">Price (₹/pc)</th>
                  <th className="py-3.5 px-4 text-right">Total Amount (₹)</th>
                  <th className="py-3.5 px-4 text-center">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      <div className="max-w-sm mx-auto flex flex-col items-center">
                        <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 mb-3">
                          <ShoppingBag size={28} />
                        </div>
                        <p className="font-bold text-slate-800 text-sm">
                          No Products in Order Form Yet
                        </p>
                        <p className="text-xs text-slate-500 mt-1 max-w-xs">
                          {!selectedCustomer
                            ? "Customer selection is mandatory. Please select a customer above first to view and add products."
                            : !isCustomerGstRegistered
                            ? "Customer is NOT GST/PAN registered. Adding products is disabled until GST/PAN details are entered & saved in the customer card above."
                            : "Click Add Product to Form to browse products, pick multiple colors and sets at once."}
                        </p>
                        {selectedCustomer && isCustomerGstRegistered && (
                          <button
                            type="button"
                            onClick={() => router.push(`/products?returnTo=${encodeURIComponent(getReturnToUrl())}`)}
                            className="mt-4 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer"
                          >
                            <Plus size={14} />
                            <span>Add Product to Form</span>
                          </button>
                        )}
                        {selectedCustomer && !isCustomerGstRegistered && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsEditingGstPan(true);
                              toast("Please enter GST/PAN details in the field opened above.", "info");
                            }}
                            className="mt-4 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer"
                          >
                            <AlertCircle size={14} />
                            <span>Enter GST/PAN Above</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  items.map((item, index) => {
                    const itemTotalPcs = item.totalPcs || ((item.totalSets || 0) * (item.pcsPerSet || 5));
                    const prodData = productsMap[item.productId];

                    return (
                      <tr key={index} className="hover:bg-slate-50/80 transition-colors">
                        {/* 1. Product Name */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2.5">
                            {item.imageUrl && (
                              <img
                                src={item.imageUrl}
                                alt={item.productName}
                                className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0"
                              />
                            )}
                            <div>
                              <Link
                                href={`/products/${item.productId}?returnTo=${encodeURIComponent(getReturnToUrl())}`}
                                className="font-black text-slate-900 hover:text-orange-600 transition"
                              >
                                {item.productName}{prodData?.mrp ? ` (${prodData.mrp})` : ""}
                              </Link>
                              <div className="text-[10px] text-slate-500">
                                Ratio: {item.sizeRatio} • {item.totalSets} Sets ({itemTotalPcs} Pcs)
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 2. Colors & Sets */}
                        <td className="py-4 px-4">
                          <div className="flex flex-wrap gap-1.5 max-w-xs">
                            {item.colorSets && item.colorSets.length > 0 ? (
                              item.colorSets.map((cs, csIdx) => {
                                const letter = getColorShadeLetter(prodData, cs.color, csIdx);
                                return (
                                  <span
                                    key={cs.color}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-900 font-mono"
                                  >
                                    <span
                                      className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                                      style={{ backgroundColor: getColorHex(cs.color).hex }}
                                    />
                                    <span className="font-black text-slate-900">{letter}-{cs.sets}</span>
                                    <span className="text-slate-500 text-[10px] font-sans">({cs.color})</span>
                                  </span>
                                );
                              })
                            ) : (
                              <span className="text-slate-400 italic">No colors</span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-500 font-semibold mt-1 block">
                            Total Sets: {item.totalSets}
                          </span>
                        </td>

                        {/* 3. Mix Sizes (Next Column) */}
                        <td className="py-4 px-4">
                          {(() => {
                            const formattedMix = parseMixSizesForDisplay(item, prodData);
                            if (formattedMix.length === 0) {
                              return (
                                <div className="text-center">
                                  <span className="text-[11px] text-slate-400 font-medium italic">—</span>
                                </div>
                              );
                            }

                            return (
                              <div className="flex flex-col gap-2 min-w-[110px]">
                                {formattedMix.map((entry, eIdx) => (
                                  <div
                                    key={eIdx}
                                    className="bg-amber-50/80 border border-amber-300 rounded-lg p-2 font-mono text-xs shadow-2xs"
                                  >
                                    {/* First line: A - 34-2 */}
                                    <div className="font-black text-slate-900 flex items-center gap-1">
                                      <span className="px-1.5 py-0.2 rounded bg-orange-600 text-white font-black text-[10px]">
                                        {entry.letter}
                                      </span>
                                      <span className="text-slate-400">-</span>
                                      <span className="text-amber-900 font-bold">
                                        {entry.sizes[0].size}-{entry.sizes[0].count}
                                      </span>
                                    </div>

                                    {/* Below it: 36-1 */}
                                    {entry.sizes.slice(1).map((sz, sIdx) => (
                                      <div
                                        key={sIdx}
                                        className="text-amber-900 font-bold pl-7 pt-0.5 text-xs"
                                      >
                                        {sz.size}-{sz.count}
                                      </div>
                                    ))}
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </td>

                        {/* 4. PCS */}
                        <td className="py-4 px-4 text-center">
                          <span className="font-black text-slate-900 text-sm">
                            {itemTotalPcs}
                          </span>
                          <span className="text-[10px] text-slate-500 block">Pcs</span>
                        </td>

                        {/* 6. Price */}
                        <td className="py-4 px-4 text-right font-medium text-slate-800">
                          {selectedCustomer?.businessType === "RETAILER WITH SPECIAL DISCOUNT" && canAdjustSpecialDiscount ? (
                            <div className="flex flex-col items-end gap-1">
                              <div className="flex items-center gap-1">
                                <span className="text-slate-400 font-bold text-xs">₹</span>
                                <input
                                  type="number"
                                  min={0}
                                  step="1"
                                  value={item.unitPrice}
                                  onChange={(e) => {
                                    const newPrice = Math.max(0, parseFloat(e.target.value) || 0);
                                    const copy = [...items];
                                    const itemPcs = copy[index].totalPcs || ((copy[index].totalSets || 0) * (copy[index].pcsPerSet || 5));
                                    copy[index] = {
                                      ...copy[index],
                                      unitPrice: newPrice,
                                      itemSubtotal: itemPcs * newPrice,
                                    };
                                    setItems(copy);
                                    saveDraft(copy, selectedCustomerId, orderNotes, placedBy, orderCreditDays);
                                  }}
                                  className="w-24 px-2 py-1 text-right font-mono font-bold text-sm bg-white border border-teal-400 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                                  title="Custom price / special discount set by Admin/TL"
                                />
                              </div>
                              <span className="text-[10px] text-teal-700 font-semibold">
                                Base (MRP/2): ₹{item.retailerPrice || Math.round((item.unitPrice || 0))}
                                {item.retailerPrice && item.unitPrice < item.retailerPrice && (
                                  <span className="ml-1 text-emerald-600 font-bold">
                                    (-₹{item.retailerPrice - item.unitPrice})
                                  </span>
                                )}
                              </span>
                            </div>
                          ) : (
                            <div>
                              <span className="font-mono">{formatCurrency(item.unitPrice)}</span>
                              {((selectedCustomer?.specialDiscount && selectedCustomer.specialDiscount > 0) || selectedCustomer?.businessType === "RETAILER WITH SPECIAL DISCOUNT") && (
                                <span className="text-[10px] text-teal-600 block font-semibold">
                                  {(effectiveBusinessType || "").toUpperCase().includes("WHOLESAL") ? "Wholesale" : "MRP/2"} (-₹{selectedCustomer?.specialDiscount || 0})
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* 7. Total Amount */}
                        <td className="py-4 px-4 text-right font-black text-slate-900 text-sm">
                          {formatCurrency(item.itemSubtotal)}
                        </td>

                        {/* 8. Actions */}
                        <td className="py-4 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Link
                              href={`/products/${item.productId}?returnTo=${encodeURIComponent(getReturnToUrl())}`}
                              className="p-1.5 text-slate-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition"
                              title="Edit colors and sets"
                            >
                              <Edit3 size={15} />
                            </Link>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(index)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                              title="Remove item"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* ═══════════════════════════════════════════
            3. ORDER DETAILS & SUMMARY (EMPLOYEE, NOTES, TOTALS, ROUNDED)
            ═══════════════════════════════════════════ */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Employee credentials & Notes */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-slate-900">
              Employee & Order Details
            </h3>

            {/* Placed By (Logged-in Employee) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Booked By (Employee Name) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  readOnly
                  disabled
                  value={employee?.name || placedBy || "Sales Representative"}
                  className="w-full pl-9 pr-3.5 py-2.5 text-xs bg-slate-100 border border-slate-300 rounded-xl text-slate-900 font-bold cursor-not-allowed select-none"
                />
              </div>
            </div>

            {/* Written Order Form # */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                <span>Written Order Slip / Book No.</span>
                <span className="text-[10px] text-slate-400 font-normal">Optional (from printed book)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. 1042 or ORD-2024 (leave blank for auto)"
                value={customOrderNumber}
                onChange={(e) => setCustomOrderNumber(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white font-mono font-medium"
              />
            </div>

            {/* Order Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Order Notes / Dispatch Instructions (Optional)
              </label>
              <textarea
                rows={3}
                placeholder="Any special packing instructions, transport details, delivery deadlines..."
                value={orderNotes}
                onChange={(e) => {
                  setOrderNotes(e.target.value);
                  saveDraft(items, selectedCustomerId, e.target.value, placedBy);
                }}
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white"
              />
            </div>
          </div>

          {/* Right: Wholesale Grand Totals Card */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm flex flex-col justify-between space-y-5">
            <div>
              <h3 className="text-sm font-black text-slate-900 pb-3 border-b border-slate-100">
                Order Summary
              </h3>

              <div className="space-y-2.5 pt-3 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Total Ordered Sets:</span>
                  <span className="font-bold text-slate-900">{totalSets} Sets</span>
                </div>

                <div className="flex justify-between text-slate-600">
                  <span>Total Ordered Pieces (PCS):</span>
                  <span className="font-bold text-slate-900">{totalPcs} Pcs</span>
                </div>

                <div className="flex justify-between text-slate-600 pt-2 border-t border-slate-100">
                  <span>Subtotal Amount:</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {formatCurrency(subtotal)}
                  </span>
                </div>

                <div className="flex justify-between text-slate-600">
                  <span>GST (5%):</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {formatCurrency(gstAmount)}
                  </span>
                </div>

                <div className="flex justify-between items-baseline pt-3 border-t-2 border-slate-900 text-sm">
                  <span className="font-black text-slate-900 text-base">Grand Total:</span>
                  <span className="font-black text-2xl text-orange-600">
                    {formatCurrency(grandTotal)}
                  </span>
                </div>
              </div>
            </div>

            {/* Place Order Button */}
            <button
              type="button"
              disabled={isSubmitting || items.length === 0 || !selectedCustomerId}
              onClick={handleSubmitOrder}
              className="w-full py-4 px-4 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-base rounded-2xl shadow-xl shadow-orange-500/25 transition-all flex items-center justify-center gap-2 hover:-translate-y-0.5 active:translate-y-0"
            >
              <FilePlus size={20} />
              <span>
                {isSubmitting
                  ? "Submitting Wholesale Order..."
                  : `Submit Order (${totalPcs} Pcs · ${formatCurrency(grandTotal)})`}
              </span>
            </button>
          </div>
        </section>
      </main>

      {/* ═══════════════════════════════════════════
          TRANSPORT NAME POPUP MODAL
          ═══════════════════════════════════════════ */}
      <Modal
        isOpen={isTransportModalOpen}
        onClose={() => !isSubmitting && setIsTransportModalOpen(false)}
        title="Transport / Dispatch Details"
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setIsTransportModalOpen(false)}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmitting || !transportName.trim()}
              onClick={handleFinalSubmitOrder}
              className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 shadow-md shadow-orange-500/20 transition flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Placing Order...</span>
                </>
              ) : (
                <>
                  <Truck size={14} />
                  <span>Confirm Transport &amp; Submit</span>
                </>
              )}
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-xs py-1">
          {/* Customer Dispatch Card */}
          <div className="p-3.5 bg-orange-50/60 border border-orange-200/80 rounded-2xl flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Truck size={18} />
            </div>
            <div className="space-y-0.5 flex-1 min-w-0">
              <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wider block">
                Wholesale Dispatch To:
              </span>
              <p className="font-extrabold text-slate-900 text-sm truncate">
                {selectedCustomer?.shopName || "Customer Shop"}
              </p>
              <p className="text-[11px] text-slate-600">
                GST/PAN: <strong className="font-mono">{selectedCustomer?.gstPanNo || "—"}</strong>
                {selectedCustomer?.city ? ` • ${selectedCustomer.city}` : ""}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Transport Name / Courier Service <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                autoFocus
                value={transportName}
                onChange={(e) => setTransportName(e.target.value.toUpperCase())}
                placeholder="Enter transport name (e.g. VRL Logistics, TCI, Navkar Roadways...)"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white uppercase placeholder:normal-case"
              />
            </div>

            {/* Quick Transport Chips */}
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                Quick Select Popular Transporters:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  "VRL LOGISTICS",
                  "TCI EXPRESS",
                  "NAVKAR ROADWAYS",
                  "SHREE MARUTI COURIER",
                  "GHATGE PATIL",
                  "SELF DELIVERY / HAND DELIVERY",
                ].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setTransportName(chip.toUpperCase())}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition ${
                      transportName === chip
                        ? "bg-orange-600 text-white border-orange-600 shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:border-orange-300 hover:bg-orange-50/40"
                    }`}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            {/* Booking Station / City */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Booking Station / Destination City
              </label>
              <input
                type="text"
                value={transportStation}
                onChange={(e) => setTransportStation(e.target.value.toUpperCase())}
                placeholder="e.g. Ahmedabad, Mumbai, Surat, Rajkot, Indore..."
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white uppercase placeholder:normal-case"
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* Visiting Card Lightbox Modal */}
      {viewVisitingCard && (
        <Modal
          isOpen={!!viewVisitingCard}
          onClose={() => setViewVisitingCard(null)}
          title={`Visiting Card — ${selectedCustomer?.shopName || "Customer"}`}
          size="md"
        >
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col items-center">
            <img
              src={viewVisitingCard}
              alt="Visiting Card Proof"
              className="max-h-[75vh] w-auto rounded-xl object-contain shadow-xs"
            />
          </div>
        </Modal>
      )}
    </div>
  );
}

export default function OrderFormPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <OrderFormContent />
    </Suspense>
  );
}
