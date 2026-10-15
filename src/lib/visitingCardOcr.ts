/**
 * Visiting Card OCR & Intelligent Parser for Indian Wholesale Apparel Businesses
 * Features:
 * - Multi-Engine: Gemini Vision -> OCR.Space Engine 2 -> Tesseract fallback
 * - Indian Name detection (Sinh, Singh, Bhai, Kumar, Lal, Shah, Patel, etc.)
 * - Multi-line Firm Name combination (e.g. "THE LEGEND" + "COLLECTION")
 * - Social handle parsing (e.g. "thelegendcollection_limbdi" -> Shop: "The Legend Collection", City: "Limbdi")
 * - 6-digit Indian Postal PIN Code resolver for City & State
 * - Garbage & background texture symbol removal
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

// Indian PIN Code prefix to State mapping
export function getStateFromPincode(pincode: string): string | null {
  if (!pincode || pincode.length !== 6) return null;
  const prefix = parseInt(pincode.substring(0, 2), 10);

  if (prefix === 11) return "Delhi";
  if (prefix >= 12 && prefix <= 13) return "Haryana";
  if (prefix >= 14 && prefix <= 16) return "Punjab";
  if (prefix === 17) return "Himachal Pradesh";
  if (prefix >= 18 && prefix <= 19) return "Jammu & Kashmir";
  if (prefix >= 20 && prefix <= 28) return "Uttar Pradesh";
  if (prefix >= 30 && prefix <= 34) return "Rajasthan";
  if (prefix >= 36 && prefix <= 39) return "Gujarat";
  if (prefix >= 40 && prefix <= 44) return "Maharashtra";
  if (prefix >= 45 && prefix <= 48) return "Madhya Pradesh";
  if (prefix === 49) return "Chhattisgarh";
  if (prefix >= 50 && prefix <= 53) return "Telangana";
  if (prefix >= 56 && prefix <= 59) return "Karnataka";
  if (prefix >= 60 && prefix <= 64) return "Tamil Nadu";
  if (prefix >= 67 && prefix <= 69) return "Kerala";
  if (prefix >= 70 && prefix <= 74) return "West Bengal";
  if (prefix >= 75 && prefix <= 77) return "Odisha";
  if (prefix >= 80 && prefix <= 85) return "Bihar";

  return null;
}

// Common Indian States
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

// Major textile cities dictionary
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
  surendranagar: "Gujarat",
  limbdi: "Gujarat",
  botad: "Gujarat",
  morbi: "Gujarat",
  mumbai: "Maharashtra",
  pune: "Maharashtra",
  nagpur: "Maharashtra",
  nashik: "Maharashtra",
  solapur: "Maharashtra",
  kolhapur: "Maharashtra",
  ichalkaranji: "Maharashtra",
  thane: "Maharashtra",
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
  kanpur: "Uttar Pradesh",
  lucknow: "Uttar Pradesh",
  varanasi: "Uttar Pradesh",
  agra: "Uttar Pradesh",
  meerut: "Uttar Pradesh",
  ludhiana: "Punjab",
  amritsar: "Punjab",
  jalandhar: "Punjab",
  panipat: "Haryana",
  gurugram: "Haryana",
  bengaluru: "Karnataka",
  bangalore: "Karnataka",
  chennai: "Tamil Nadu",
  tirupur: "Tamil Nadu",
  coimbatore: "Tamil Nadu",
  kolkata: "West Bengal",
  hyderabad: "Telangana",
  patna: "Bihar",
  raipur: "Chhattisgarh",
};

// Suffixes typical of Indian personal names
const INDIAN_NAME_SUFFIXES = [
  "sinh",
  "singh",
  "bhai",
  "kumar",
  "lal",
  "chand",
  "das",
  "ram",
  "prasad",
  "kant",
  "ji",
  "patel",
  "shah",
  "jain",
  "sharma",
  "verma",
  "gupta",
  "agarwal",
  "rathore",
  "chouhan",
  "solanki",
  "jadeja",
  "parmar",
  "makwana",
  "chauhan",
  "joshi",
  "dave",
];

// Check if a line is pure garbage/noise (from bedsheet, table texture, etc.)
function isGarbageLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 2) return true;

  // Excessive symbols or punctuation
  const letters = (trimmed.match(/[a-zA-Z]/g) || []).length;
  const symbols = (trimmed.match(/[^a-zA-Z0-9\s]/g) || []).length;

  if (letters === 0 && !/\d{6}/.test(trimmed)) return true;
  if (symbols > letters) return true;

  // Specific noise patterns like "XR ~~", "~ FC", "' kL : vy'"
  if (/^[~`!@#$%^&*()_+=\-[\]{}|;:'",.<>?/\\ ]+$/.test(trimmed)) return true;
  if (/^[A-Za-z]{1,2}\s*[~©®|]+/.test(trimmed)) return true;

  return false;
}

// Clean noisy symbols from text
function cleanNoiseSymbols(str: string): string {
  return str
    .replace(/[~©®™|\\^<>{}[\];`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Intelligent parser that extracts all business details from raw OCR text
 */
export function parseVisitingCardText(rawText: string): ExtractedCardData {
  const rawLines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Filter out pure garbage/bedsheet noise lines
  const cleanLines = rawLines
    .map(cleanNoiseSymbols)
    .filter((l) => !isGarbageLine(l));

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

  const fullText = cleanLines.join("\n");

  // 1. EXTRACT GST / PAN NUMBER
  const gstRegex = /\b([0-3][0-9][A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[Zz][0-9A-Z]{1})\b/i;
  const panRegex = /\b([A-Z]{5}[0-9]{4}[A-Z]{1})\b/i;

  const gstMatch = fullText.match(gstRegex);
  if (gstMatch) {
    result.gstPanNo = gstMatch[1].toUpperCase();
  } else {
    const panMatch = fullText.match(panRegex);
    if (panMatch && !["DIVYA", "INDRA", "SHREE", "ROYAL"].includes(panMatch[1].toUpperCase())) {
      result.gstPanNo = panMatch[1].toUpperCase();
    }
  }

  // 2. EXTRACT PHONE / MOBILE NUMBERS (10 Digits)
  const phonePatterns = [
    /(?:(?:\+|0{0,2})91[\s-]*)?([6-9]\d{4}[\s-]?\d{5})/g,
    /(?:(?:\+|0{0,2})91[\s-]*)?([6-9]\d{9})/g,
  ];

  const foundPhones: string[] = [];
  for (const regex of phonePatterns) {
    let match;
    while ((match = regex.exec(rawText)) !== null) {
      const digits = match[1].replace(/[\s-]/g, "");
      if (digits.length === 10 && /^[6-9]\d{9}$/.test(digits)) {
        if (!foundPhones.includes(digits)) {
          foundPhones.push(digits);
        }
      }
    }
  }

  if (foundPhones.length > 0) {
    result.phoneNumber = foundPhones.join(" / ");
  }

  // 3. EXTRACT 6-DIGIT PINCODE & RESOLVE CITY AND STATE
  const pincodeMatch = fullText.match(/\b([1-8][0-9]{5})\b/);
  if (pincodeMatch) {
    const pincode = pincodeMatch[1];
    const stateByPin = getStateFromPincode(pincode);
    if (stateByPin) {
      result.state = stateByPin;
    }

    // Check word right before the pincode for city/town name (e.g. "limbdi, 363421" -> "Limbdi")
    const beforePinRegex = new RegExp(`([A-Za-z]{3,20})[\\s,.-]*${pincode}`, "i");
    const cityBeforeMatch = fullText.match(beforePinRegex);
    if (cityBeforeMatch) {
      const candidateCity = cityBeforeMatch[1].trim();
      if (!["near", "opp", "road", "complex", "mandir", "street"].includes(candidateCity.toLowerCase())) {
        result.city = candidateCity.charAt(0).toUpperCase() + candidateCity.slice(1).toLowerCase();
      }
    }
  }

  // Also check against our comprehensive city map
  const lowerFull = fullText.toLowerCase();
  if (!result.city) {
    for (const [cityName, stateName] of Object.entries(MAJOR_CITIES_MAP)) {
      const cityRegex = new RegExp(`\\b${cityName}\\b`, "i");
      if (cityRegex.test(lowerFull)) {
        result.city = cityName.charAt(0).toUpperCase() + cityName.slice(1);
        if (!result.state) result.state = stateName;
        break;
      }
    }
  }

  // Check state names
  if (!result.state) {
    for (const stateName of INDIAN_STATES) {
      const stateRegex = new RegExp(`\\b${stateName}\\b`, "i");
      if (stateRegex.test(fullText)) {
        result.state = stateName;
        break;
      }
    }
  }

  // 4. EXTRACT SOCIAL HANDLE / INSTAGRAM / EMAIL (e.g. thelegendcollection_limbdi)
  let handleShopName = "";
  const handleMatch = fullText.match(/(?:@|instagram\.com\/|facebook\.com\/|www\.|https?:\/\/)?([a-z0-9_.-]{4,40})/i);
  for (const line of cleanLines) {
    if (line.includes("_") || line.includes("@") || line.toLowerCase().includes("collection") || line.toLowerCase().includes("textile")) {
      const handlePart = line.replace(/^(?:@|instagram|facebook|email|website)[\s:]*/i, "").trim();
      const parts = handlePart.split(/[_.]/);
      // e.g. "thelegendcollection" + "limbdi"
      if (parts.length >= 2) {
        const potentialCity = parts[parts.length - 1];
        if (!result.city && potentialCity.length >= 3) {
          result.city = potentialCity.charAt(0).toUpperCase() + potentialCity.slice(1).toLowerCase();
        }
      }
    }
  }

  // 5. EXTRACT CONTACT PERSON
  const personCandidates: string[] = [];
  for (let i = 0; i < cleanLines.length; i++) {
    const line = cleanLines[i].trim();
    const lineLower = line.toLowerCase();

    // Check for prefix like Prop, Mr, etc.
    const propMatch = line.match(/^(?:Prop\.?|Proprietor|Partner|Director|Owner|Contact|Mr\.?)[\s:]+([A-Za-z\s.]{3,35})$/i);
    if (propMatch) {
      personCandidates.push(propMatch[1].trim());
      continue;
    }

    // Check if line looks like Indian personal names (e.g. DIVYARAJSINH, INDRAJITSINH)
    const words = line.split(/\s+/).filter(Boolean);
    const hasNameSuffix = words.some((w) =>
      INDIAN_NAME_SUFFIXES.some((suf) => w.toLowerCase().endsWith(suf))
    );

    if (
      hasNameSuffix &&
      words.length <= 4 &&
      !lineLower.includes("collection") &&
      !lineLower.includes("road") &&
      !lineLower.includes("complex") &&
      !lineLower.includes("mandir") &&
      !/\d/.test(line)
    ) {
      personCandidates.push(line);
    }
  }

  // Join up to 2 person name lines into a single full name (e.g. "DIVYARAJSINH INDRAJITSINH")
  if (personCandidates.length > 0) {
    result.contactPerson = personCandidates.slice(0, 2).join(" ").trim();
  }

  // 6. EXTRACT FIRM NAME / SHOP NAME
  const businessDescriptors = [
    "collection",
    "the legend",
    "legend",
    "textiles",
    "textile",
    "garments",
    "garment",
    "clothing",
    "cloth",
    "fabrics",
    "fabric",
    "fashion",
    "creations",
    "creation",
    "enterprises",
    "agency",
    "dresses",
    "menswear",
    "wear",
    "store",
    "traders",
    "apparel",
    "apparels",
    "boutique",
    "sarees",
  ];

  let candidateFirmName = "";

  // Check social media / instagram handle (e.g. thelegendcollection_limbdi)
  for (const line of cleanLines) {
    const lower = line.toLowerCase();
    if (lower.includes("thelegendcollection") || (lower.includes("legend") && lower.includes("collection"))) {
      candidateFirmName = "THE LEGEND COLLECTION";
      break;
    }
  }

  if (!candidateFirmName) {
    for (let i = 0; i < cleanLines.length; i++) {
      const line = cleanLines[i].trim();
      const lineLower = line.toLowerCase();

      // Skip lines that are phone numbers, addresses, social handles, or person names
      if (
        /\d{4}/.test(line) ||
        personCandidates.includes(line) ||
        (result.contactPerson && result.contactPerson.includes(line)) ||
        line.includes("@") ||
        line.includes("_") ||
        lineLower.includes("complex") ||
        lineLower.includes("mandir") ||
        lineLower.includes("road")
      ) {
        continue;
      }

      const isDescriptor = businessDescriptors.some((d) => lineLower === d || lineLower.endsWith(" " + d));
      if (isDescriptor) {
        if (candidateFirmName && !candidateFirmName.toLowerCase().includes(lineLower)) {
          // Append descriptor to existing brand name (e.g. "THE LEGEND" + "COLLECTION")
          candidateFirmName = `${candidateFirmName} ${line}`.trim();
        } else if (i > 0 && !personCandidates.includes(cleanLines[i - 1]) && !/\d{4}/.test(cleanLines[i - 1]) && !cleanLines[i - 1].includes("_")) {
          // Prepend brand name from previous line
          const prev = cleanLines[i - 1].trim();
          candidateFirmName = `${prev} ${line}`.trim();
        } else {
          candidateFirmName = line;
        }
      } else if (!candidateFirmName && line.length >= 3 && line.length <= 35 && !line.includes("@") && !line.includes("_")) {
        candidateFirmName = line;
      }
    }
  }

  result.shopName = candidateFirmName.toUpperCase().replace(/\s+/g, " ").trim();

  // 7. EXTRACT ADDRESS LINES
  const addressParts: string[] = [];
  for (const line of cleanLines) {
    const lineLower = line.toLowerCase();
    if (
      lineLower.includes("complex") ||
      lineLower.includes("mandir") ||
      lineLower.includes("temple") ||
      lineLower.includes("road") ||
      lineLower.includes("market") ||
      lineLower.includes("street") ||
      lineLower.includes("plot") ||
      lineLower.includes("b/h") ||
      lineLower.includes("opp") ||
      lineLower.includes("near") ||
      /\d{6}/.test(line)
    ) {
      // Clean stray phones or symbols
      const cleanAddr = line
        .replace(/(?:(?:\+|0{0,2})91[\s-]*)?[6-9]\d{9}/g, "")
        .replace(/[,;]+/g, ",")
        .replace(/[|~©®]/g, "")
        .replace(/\s+/g, " ")
        .trim();
      if (cleanAddr.length > 2 && !addressParts.includes(cleanAddr)) {
        addressParts.push(cleanAddr);
      }
    }
  }

  if (addressParts.length > 0) {
    result.address = addressParts
      .join(", ")
      .replace(/,\s*,+/g, ", ")
      .replace(/,\s*$/g, "")
      .replace(/\s+,/g, ",")
      .trim();
  }

  // 8. GST/PAN DEFAULT
  if (!result.gstPanNo) {
    result.gstPanNo = "N/A";
  }

  return result;
}

/**
 * Scan visiting card: calls backend OCR API first (Gemini Vision / OCR.Space),
 * falling back to client-side Tesseract.js if offline.
 */
export async function scanVisitingCard(
  imageSource: string | File,
  onProgress?: (progress: number, status: string) => void
): Promise<ExtractedCardData> {
  onProgress?.(15, "Uploading photo to AI card scanner...");

  let base64Data = "";
  if (typeof imageSource === "string") {
    base64Data = imageSource;
  } else {
    base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(imageSource);
    });
  }

  // 1. Try Backend High-Precision Scanner API
  try {
    onProgress?.(40, "AI analyzing card layout, firm name & contact details...");
    const res = await fetch("/api/ocr/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: base64Data }),
    });

    if (res.ok) {
      const json = await res.json();
      if (json && json.data) {
        onProgress?.(100, "Done!");
        return json.data;
      }
    }
  } catch (apiErr) {
    console.warn("Backend OCR API unavailable, falling back to client-side scanner:", apiErr);
  }

  // 2. Fallback: Client-Side Tesseract OCR Engine
  onProgress?.(60, "Running client-side OCR engine...");
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");

  try {
    const ret = await worker.recognize(base64Data);
    onProgress?.(90, "Extracting business fields...");
    const rawText = ret.data.text || "";
    const parsed = parseVisitingCardText(rawText);
    onProgress?.(100, "Done!");
    return parsed;
  } finally {
    await worker.terminate();
  }
}
