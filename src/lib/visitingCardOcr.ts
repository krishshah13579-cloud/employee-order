/**
 * Visiting Card OCR & Intelligent Parser for Indian Wholesale Apparel Businesses
 * Extracts:
 * - Firm / Shop Name
 * - Contact Person
 * - Phone / Mobile Number
 * - GST / PAN Number
 * - Shop Address
 * - City
 * - State
 */

export interface ExtractedCardData {
  shopName: string;
  contactPerson: string;
  phoneNumber: string;
  gstPanNo: string;
  address: string;
  city: string;
  state: string;
  transportName?: string;
  rawText: string;
}

// Common Indian States & Major Textile Hub Cities
const INDIAN_STATES = [
  "Gujarat",
  "Maharashtra",
  "Rajasthan",
  "Delhi",
  "Madhya Pradesh",
  "Uttar Pradesh",
  "Punjab",
  "Haryana",
  "Karnataka",
  "Tamil Nadu",
  "West Bengal",
  "Andhra Pradesh",
  "Telangana",
  "Bihar",
  "Kerala",
  "Odisha",
  "Jharkhand",
  "Chhattisgarh",
  "Uttarakhand",
  "Himachal Pradesh",
  "Assam",
  "Goa",
];

const MAJOR_CITIES_MAP: Record<string, string> = {
  surat: "Gujarat",
  ahmedabad: "Gujarat",
  vadodara: "Gujarat",
  rajkot: "Gujarat",
  bhavnagar: "Gujarat",
  jamnagar: "Gujarat",
  gandhidham: "Gujarat",
  anand: "Gujarat",
  vapi: "Gujarat",
  valsad: "Gujarat",
  navsari: "Gujarat",
  mumbai: "Maharashtra",
  pune: "Maharashtra",
  nagpur: "Maharashtra",
  nashik: "Maharashtra",
  solapur: "Maharashtra",
  kolhapur: "Maharashtra",
  ichalkaranji: "Maharashtra",
  thane: "Maharashtra",
  ulhasnagar: "Maharashtra",
  delhi: "Delhi",
  "new delhi": "Delhi",
  jaipur: "Rajasthan",
  jodhpur: "Rajasthan",
  bhilwara: "Rajasthan",
  kishangarh: "Rajasthan",
  kota: "Rajasthan",
  bikaner: "Rajasthan",
  udaipur: "Rajasthan",
  pali: "Rajasthan",
  indore: "Madhya Pradesh",
  bhopal: "Madhya Pradesh",
  gwalior: "Madhya Pradesh",
  jabalpur: "Madhya Pradesh",
  ujjain: "Madhya Pradesh",
  kanpur: "Uttar Pradesh",
  lucknow: "Uttar Pradesh",
  varanasi: "Uttar Pradesh",
  agra: "Uttar Pradesh",
  meerut: "Uttar Pradesh",
  ghaziabad: "Uttar Pradesh",
  noida: "Uttar Pradesh",
  ludhiana: "Punjab",
  amritsar: "Punjab",
  jalandhar: "Punjab",
  panipat: "Haryana",
  gurugram: "Haryana",
  faridabad: "Haryana",
  bengaluru: "Karnataka",
  bangalore: "Karnataka",
  bellary: "Karnataka",
  chennai: "Tamil Nadu",
  tirupur: "Tamil Nadu",
  coimbatore: "Tamil Nadu",
  erode: "Tamil Nadu",
  salem: "Tamil Nadu",
  madurai: "Tamil Nadu",
  kolkata: "West Bengal",
  hyderabad: "Telangana",
  patna: "Bihar",
  raipur: "Chhattisgarh",
};

/**
 * Parses raw text extracted from a business card and maps into customer fields
 */
export function parseVisitingCardText(rawText: string): ExtractedCardData {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const result: ExtractedCardData = {
    shopName: "",
    contactPerson: "",
    phoneNumber: "",
    gstPanNo: "",
    address: "",
    city: "",
    state: "",
    transportName: "",
    rawText,
  };

  const addressLines: string[] = [];
  const textJoined = lines.join(" ");

  // 1. EXTRACT GSTIN OR PAN
  // GSTIN format: 2 digits + 10 alphanumeric PAN + 1 digit + 1 alphanumeric + 1 alphanumeric
  const gstRegex = /\b([0-3][0-9][A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[Zz][0-9A-Z]{1})\b/i;
  const panRegex = /\b([A-Z]{5}[0-9]{4}[A-Z]{1})\b/i;

  const gstMatch = rawText.match(gstRegex);
  if (gstMatch) {
    result.gstPanNo = gstMatch[1].toUpperCase();
  } else {
    // Check if PAN alone is found (avoiding words that look like PAN)
    const panMatch = rawText.match(panRegex);
    if (panMatch) {
      result.gstPanNo = panMatch[1].toUpperCase();
    }
  }

  // 2. EXTRACT PHONE / MOBILE NUMBERS
  // Indian 10-digit mobile number patterns (often starting with 6, 7, 8, 9, with optional +91, 0, spaces, dashes)
  const phoneRegexes = [
    /(?:(?:\+|0{0,2})91[\s-]*)?([6-9]\d{4}[\s-]?\d{5})/g,
    /(?:(?:\+|0{0,2})91[\s-]*)?([6-9]\d{9})/g,
    /(?:Mob(?:ile)?\.?|Ph(?:one)?\.?|Call|Tel\.?|M:?|WhatsApp)[\s:]*([6-9]\d{4}[\s-]?\d{5})/gi,
  ];

  const foundPhones: string[] = [];
  for (const regex of phoneRegexes) {
    let match;
    while ((match = regex.exec(rawText)) !== null) {
      const clean = match[1].replace(/[\s-]/g, "");
      if (clean.length === 10 && /^[6-9]\d{9}$/.test(clean)) {
        if (!foundPhones.includes(clean)) {
          foundPhones.push(clean);
        }
      }
    }
  }

  if (foundPhones.length > 0) {
    result.phoneNumber = foundPhones[0];
  } else {
    // Fallback: look for any 10-digit sequence
    const fallbackMatch = rawText.match(/\b([6-9]\d{9})\b/);
    if (fallbackMatch) {
      result.phoneNumber = fallbackMatch[1];
    }
  }

  // 3. EXTRACT CITY & STATE
  const lowerJoined = textJoined.toLowerCase();
  for (const [cityName, stateName] of Object.entries(MAJOR_CITIES_MAP)) {
    const cityWordRegex = new RegExp(`\\b${cityName}\\b`, "i");
    if (cityWordRegex.test(lowerJoined)) {
      result.city = cityName.charAt(0).toUpperCase() + cityName.slice(1);
      result.state = stateName;
      break;
    }
  }

  if (!result.state) {
    for (const stateName of INDIAN_STATES) {
      const stateWordRegex = new RegExp(`\\b${stateName}\\b`, "i");
      if (stateWordRegex.test(textJoined)) {
        result.state = stateName;
        break;
      }
    }
  }

  // 4. EXTRACT TRANSPORT NAME IF PRESENT
  const transportMatch = rawText.match(/(?:Transport|Tpt|Through|Dispatch(?:ed)?\s*by)[\s:]+([A-Za-z0-9\s&.-]+)/i);
  if (transportMatch) {
    const tName = transportMatch[1].split(/\n|,|\./)[0].trim();
    if (tName.length >= 3 && tName.length <= 40) {
      result.transportName = tName;
    }
  }

  // 5. EXTRACT CONTACT PERSON
  // Check lines starting with Prop., Proprietor, Partner, Mr., Contact, etc.
  for (const line of lines) {
    const propMatch = line.match(/^(?:Prop\.?|Proprietor|Partner|Director|Owner|Contact|Mr\.?|Shree)[\s:]+([A-Za-z\s.]{3,35})$/i);
    if (propMatch) {
      result.contactPerson = propMatch[1].trim();
      break;
    }
  }

  // 6. EXTRACT FIRM / SHOP NAME & ADDRESS LINES
  const businessKeywords = [
    "traders",
    "textiles",
    "garments",
    "clothing",
    "cloth",
    "fabrics",
    "fashion",
    "creation",
    "collection",
    "enterprises",
    "agency",
    "dresses",
    "menswear",
    "wear",
    "synthetics",
    "cottons",
    "silks",
    "sarees",
    "boutique",
    "apparels",
    "co.",
    "company",
    "pvt",
    "ltd",
    "store",
    "emporium",
  ];

  const addressKeywords = [
    "shop",
    "road",
    "market",
    "complex",
    "street",
    "plot",
    "opp",
    "near",
    "b/h",
    "behind",
    "floor",
    "tower",
    "building",
    "darwaja",
    "bazaar",
    "bazar",
    "gali",
    "cross",
    "ring road",
    "rasta",
    "nagar",
    "station",
  ];

  let candidateFirmName = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLower = line.toLowerCase();

    // Skip lines that are purely phones, GST, or emails
    if (
      lineLower.includes("gstin") ||
      lineLower.includes("gst") ||
      lineLower.includes("pan") ||
      lineLower.includes("phone") ||
      lineLower.includes("mobile") ||
      lineLower.includes("email") ||
      lineLower.includes("@") ||
      lineLower.includes("www.") ||
      lineLower.includes("http")
    ) {
      continue;
    }

    // Check if line looks like an address
    const hasAddressWord = addressKeywords.some((kw) => lineLower.includes(kw)) || /\d{6}/.test(line);
    if (hasAddressWord) {
      addressLines.push(line);
      continue;
    }

    // Check if line has a business keyword
    const hasBizWord = businessKeywords.some((kw) => lineLower.includes(kw));
    if (hasBizWord && !candidateFirmName) {
      // Remove M/s or Shri prefix if any
      candidateFirmName = line.replace(/^(?:M\/s\.?|M\/S\.?|Shree|Shri)\s*/i, "").trim();
      continue;
    }

    // If candidate firm name not yet found and line is short, clean, capitalized
    if (!candidateFirmName && line.length >= 3 && line.length <= 45 && !line.includes(":")) {
      // Don't pick contact person as firm name
      if (result.contactPerson && line.includes(result.contactPerson)) continue;
      candidateFirmName = line;
    }
  }

  result.shopName = candidateFirmName || (lines[0] ? lines[0].replace(/^(?:M\/s\.?|Shree)\s*/i, "") : "");

  if (addressLines.length > 0) {
    result.address = addressLines.join(", ");
  }

  return result;
}

/**
 * Runs client-side Tesseract OCR on an image file or Data URL
 */
export async function scanVisitingCard(
  imageSource: string | File,
  onProgress?: (progress: number, status: string) => void
): Promise<ExtractedCardData> {
  // Dynamically load Tesseract only when called in browser
  const { createWorker } = await import("tesseract.js");

  onProgress?.(10, "Initializing OCR scanner engine...");
  const worker = await createWorker("eng");

  try {
    onProgress?.(35, "Scanning visiting card text...");
    const ret = await worker.recognize(imageSource);
    onProgress?.(85, "Analyzing business details & GST/Mobile...");

    const rawText = ret.data.text || "";
    const parsed = parseVisitingCardText(rawText);

    onProgress?.(100, "Done!");
    return parsed;
  } finally {
    await worker.terminate();
  }
}
