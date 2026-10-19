export interface InvoiceTemplateSettings {
  companyName: string;
  addressLine1: string;
  addressLine2: string;
  phone: string;
  email: string;
  gstNo: string;
  panNo: string;
  placeOfSupply: string;
  bankName: string;
  accountNo: string;
  ifscCode: string;
  beneficiaryName: string;
  branch: string;
  terms1: string;
  terms2: string;
  terms3: string;
  terms4: string;
  terms5: string;
  creditNotePrefix: string;
  signatoryLabel: string;
  signatoryTitle: string;
  defaultTransport: string;
  defaultHsn: string;
}

export const DEFAULT_INVOICE_TEMPLATE: InvoiceTemplateSettings = {
  companyName: "KRISH CLOTHING CO.",
  addressLine1: "2ND FLOOR, Q-8,SAMET BUSINESS PARK,NEAR PARISHKAR-2,KHOKHARA CIRCLE,MANINAGAR,",
  addressLine2: "AHMEDABAD - 380008 (M) : 8128756632",
  phone: "+91 8128756632",
  email: "krishclothingco3@gmail.com",
  gstNo: "24LAAPS9916E1ZD",
  panNo: "LAAPS9916E",
  placeOfSupply: "24-Gujarat",
  bankName: "ICICI BANK",
  accountNo: "750705000692",
  ifscCode: "ICIC0007507",
  beneficiaryName: "KRISH CLOTHING CO.",
  branch: "Khokhra Maninagar, Ahmedabad",
  terms1: "1. Goods once sold will not be taken back.",
  terms2: "2. Interest @18% p.a. will be charged if payment is not made within due date.",
  terms3: "3. Our risk and responsibility ceases as soon as the goods leave our premises.",
  terms4: '4. "Subject to \'AHMEDABAD\' Jurisdiction only. E.&.O.E"',
  terms5: "5. Any damages or problem in any products should be informed within 7 days of purchase.",
  creditNotePrefix: "PAYMENT EVERY WEEK AND SHOULD BE COMPLETED WITHIN",
  signatoryLabel: "For, KRISH CLOTHING CO.",
  signatoryTitle: "(Authorised Signatory)",
  defaultTransport: "Patel Transport Co.",
  defaultHsn: "6203",
};
