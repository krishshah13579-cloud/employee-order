/**
 * Comprehensive Color Palette & Resolver for Trouser and Apparel E-Commerce Store.
 * Maps exact names, multi-word fashion names (e.g., "Classic Black", "Vibrant Navy Blue", "Deep Navy"),
 * keywords, hex values, and provides a deterministic hue fallback so no two different color names look identical.
 */

export interface ColorInfo {
  hex: string;
  isLight: boolean;
}

// Exact dictionary for common menswear, formal, and casual trouser colors
const COLOR_MAP: Record<string, string> = {
  // Blacks & Near-Blacks
  "black": "#121212",
  "jet black": "#0a0a0a",
  "classic black": "#121212",
  "midnight black": "#0a0a0a",
  "pitch black": "#050505",
  "matte black": "#1a1a1a",
  "deep black": "#0d0d0d",
  "pure black": "#000000",
  "onyx": "#171717",
  "ebony": "#1c1c1c",
  "carbon": "#262626",

  // Navies & Blues
  "navy": "#172554",
  "navy blue": "#172554",
  "deep navy": "#0f172a",
  "dark navy": "#0a1128",
  "classic navy": "#1e293b",
  "vibrant navy": "#1d4ed8",
  "vibrant navy blue": "#1e40af",
  "royal navy": "#1e3a8a",
  "midnight blue": "#0f172a",
  "royal blue": "#2563eb",
  "slate blue": "#475569",
  "steel blue": "#4682b4",
  "denim": "#2b4c7e",
  "denim blue": "#2b4c7e",
  "dark denim": "#1a2538",
  "light denim": "#5c7fa8",
  "blue": "#2563eb",
  "light blue": "#93c5fd",
  "sky blue": "#7dd3fc",
  "ice blue": "#bfdbfe",
  "teal": "#0f766e",
  "petrol blue": "#164e63",
  "dark indigo": "#1a2538",
  "deep indigo": "#151e2e",
  "raw indigo": "#121926",
  "indigo": "#23334d",
  "indigo blue": "#1d2e50",
  "washed indigo": "#3b537d",
  "light indigo": "#4d6b9c",
  "indigo denim": "#23334d",

  // Greys & Grays
  "charcoal": "#334155",
  "charcoal grey": "#334155",
  "charcoal gray": "#334155",
  "dark grey": "#374151",
  "dark gray": "#374151",
  "medium grey": "#64748b",
  "medium gray": "#64748b",
  "mid grey": "#64748b",
  "mid gray": "#64748b",
  "slate grey": "#525e6f",
  "slate gray": "#525e6f",
  "slate": "#64748b",
  "grey": "#6b7280",
  "gray": "#6b7280",
  "light grey": "#cbd5e1",
  "light gray": "#cbd5e1",
  "ice grey": "#e2e8f0",
  "ice gray": "#e2e8f0",
  "silver": "#d1d5db",
  "ash grey": "#9ca3af",
  "anthracite": "#27272a",
  "smoke": "#71717a",

  // Browns, Khakis, Tans & Earth Tones
  "dark brown": "#452a1a",
  "deep brown": "#3b2219",
  "chocolate": "#3b2219",
  "chocolate brown": "#3b2219",
  "espresso": "#362218",
  "coffee": "#4a2c1d",
  "brown": "#5c3a21",
  "earthy brown": "#5c3a21",
  "mocha": "#634735",
  "mocha brown": "#634735",
  "chestnut": "#744229",
  "light brown": "#854d0e",
  "caramel": "#9a5b28",
  "tan": "#c19a6b",
  "camel": "#c19a6b",
  "cognac": "#9c572b",
  "khaki": "#c2b280",
  "dark khaki": "#b0a068",
  "light khaki": "#d4c89e",
  "beige": "#e7dbc8",
  "cream": "#fef3c7",
  "sand": "#e2d9cc",
  "stone": "#d6d3d1",
  "taupe": "#8b8589",
  "ecru": "#f3eee3",
  "biscuit": "#e8dcbe",

  // Greens
  "dark green": "#14532d",
  "bottle green": "#0f381e",
  "olive": "#3f4f34",
  "olive green": "#3f4f34",
  "dark olive": "#2e3a27",
  "army green": "#4b5320",
  "military green": "#4b5320",
  "forest green": "#14532d",
  "pine green": "#164e2e",
  "deep green": "#14532d",
  "green": "#166534",
  "sage": "#84a98c",
  "sage green": "#84a98c",
  "emerald": "#047857",
  "mint": "#a7f3d0",
  "pista": "#93c572",
  "pista green": "#93c572",
  "mehendi": "#4a5320",

  // Reds, Maroons & Burgundies
  "burgundy": "#581c24",
  "maroon": "#6b1d2f",
  "wine": "#581c24",
  "bordeaux": "#521620",
  "oxblood": "#4a121a",
  "crimson": "#991b1b",
  "rust": "#b45309",
  "brick": "#9a3412",
  "copper": "#b45309",
  "terracotta": "#c25438",
  "red": "#dc2626",
  "ruby": "#be123c",

  // Whites & Off-Whites
  "white": "#ffffff",
  "pure white": "#ffffff",
  "snow white": "#fafafa",
  "off white": "#f8fafc",
  "off-white": "#f8fafc",
  "ivory": "#fffff0",
  "chalk": "#f5f5f5",

  // Purples & Pinks
  "purple": "#6b21a8",
  "plum": "#581c87",
  "violet": "#7c3aed",
  "lavender": "#c084fc",
  "pink": "#f43f5e",
  "rose": "#e11d48",
  "peach": "#fdba74",
  "coral": "#fb7185",
  "salmon": "#f87171",

  // Yellows & Oranges
  "yellow": "#eab308",
  "mustard": "#d97706",
  "gold": "#ca8a04",
  "amber": "#d97706",
  "orange": "#ea580c",
};

/**
 * Checks if a hex color code is perceptually light (luminance > 0.7)
 * to decide whether to draw a border and use dark checkmark.
 */
export function isLightHex(hexStr: string): boolean {
  let hex = hexStr.replace("#", "").trim();
  if (hex.length === 3) {
    hex = hex.split("").map((c) => c + c).join("");
  }
  if (hex.length !== 6) return false;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return false;
  // Perceived luminance formula (ITU-R BT.601)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.72;
}

/**
 * Generates a deterministic, aesthetically pleasing color from a string hash
 * for rare or custom brand color names that don't match any keyword.
 */
function getDeterministicHue(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  // HSL with 35% lightness and 40% saturation provides tasteful fabric-like tones
  return `hsl(${h}, 40%, 35%)`;
}

/**
 * Resolves any color string (exact name, descriptive name, compound name, or hex)
 * into a valid CSS color string and determines if it is a light color.
 */
export function getColorHex(colorName: string): ColorInfo {
  if (!colorName) {
    return { hex: "#1e293b", isLight: false };
  }

  const raw = colorName.trim();

  // 1. Direct hex or CSS color function input
  if (raw.startsWith("#") || raw.startsWith("rgb") || raw.startsWith("hsl")) {
    return { hex: raw, isLight: isLightHex(raw) };
  }

  // 1b. Check for embedded hex codes inside parenthesis or text (e.g. "Dark Indigo (#1a2538)")
  const embeddedHex = raw.match(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/);
  if (embeddedHex) {
    return { hex: embeddedHex[0], isLight: isLightHex(embeddedHex[0]) };
  }

  const norm = raw.toLowerCase().replace(/[-_]/g, " ").replace(/\s+/g, " ");

  // 2. Direct dictionary match
  if (COLOR_MAP[norm]) {
    const hex = COLOR_MAP[norm];
    return { hex, isLight: isLightHex(hex) };
  }

  // 3. Keyword / Substring match (e.g. "Classic Black", "Vibrant Navy Blue", "Dark Indigo", "Medium Grey")
  if (norm.includes("black") || norm.includes("onyx") || norm.includes("ebony") || norm.includes("carbon")) {
    return { hex: "#121212", isLight: false };
  }
  if (norm.includes("indigo")) {
    if (norm.includes("dark") || norm.includes("deep") || norm.includes("raw") || norm.includes("black")) {
      return { hex: "#1a2538", isLight: false };
    }
    if (norm.includes("light") || norm.includes("washed") || norm.includes("sky") || norm.includes("ice")) {
      return { hex: "#4d6b9c", isLight: false };
    }
    return { hex: "#23334d", isLight: false };
  }
  if (norm.includes("navy")) {
    if (norm.includes("vibrant") || norm.includes("royal") || norm.includes("bright")) {
      return { hex: "#1d4ed8", isLight: false };
    }
    if (norm.includes("deep") || norm.includes("dark") || norm.includes("midnight")) {
      return { hex: "#0f172a", isLight: false };
    }
    return { hex: "#172554", isLight: false };
  }
  if (norm.includes("blue")) {
    if (norm.includes("slate") || norm.includes("steel")) return { hex: "#475569", isLight: false };
    if (norm.includes("royal") || norm.includes("electric")) return { hex: "#2563eb", isLight: false };
    if (norm.includes("light") || norm.includes("sky") || norm.includes("ice")) return { hex: "#93c5fd", isLight: true };
    return { hex: "#1d4ed8", isLight: false };
  }
  if (norm.includes("charcoal")) {
    return { hex: "#334155", isLight: false };
  }
  if (norm.includes("grey") || norm.includes("gray") || norm.includes("silver") || norm.includes("ash")) {
    if (norm.includes("light") || norm.includes("ice") || norm.includes("silver")) return { hex: "#cbd5e1", isLight: true };
    if (norm.includes("dark") || norm.includes("anthracite")) return { hex: "#374151", isLight: false };
    if (norm.includes("slate")) return { hex: "#525e6f", isLight: false };
    if (norm.includes("medium") || norm.includes("mid")) return { hex: "#64748b", isLight: false };
    return { hex: "#6b7280", isLight: false };
  }
  if (
    norm.includes("brown") ||
    norm.includes("chocolate") ||
    norm.includes("espresso") ||
    norm.includes("coffee") ||
    norm.includes("mocha")
  ) {
    if (norm.includes("dark") || norm.includes("chocolate") || norm.includes("espresso")) return { hex: "#3b2219", isLight: false };
    if (norm.includes("light") || norm.includes("caramel")) return { hex: "#854d0e", isLight: false };
    if (norm.includes("mocha") || norm.includes("earthy")) return { hex: "#5c3a21", isLight: false };
    return { hex: "#5c3a21", isLight: false };
  }
  if (norm.includes("tan") || norm.includes("camel") || norm.includes("cognac")) {
    return { hex: "#c19a6b", isLight: isLightHex("#c19a6b") };
  }
  if (norm.includes("khaki")) {
    return { hex: "#c2b280", isLight: isLightHex("#c2b280") };
  }
  if (
    norm.includes("beige") ||
    norm.includes("sand") ||
    norm.includes("cream") ||
    norm.includes("stone") ||
    norm.includes("taupe") ||
    norm.includes("ecru")
  ) {
    if (norm.includes("cream") || norm.includes("ivory")) return { hex: "#fef3c7", isLight: true };
    if (norm.includes("sand") || norm.includes("stone")) return { hex: "#d6d3d1", isLight: true };
    return { hex: "#e7dbc8", isLight: true };
  }
  if (norm.includes("olive")) {
    return { hex: "#3f4f34", isLight: false };
  }
  if (norm.includes("green") || norm.includes("pista") || norm.includes("mehendi")) {
    if (norm.includes("pista")) return { hex: "#93c572", isLight: true };
    if (norm.includes("mehendi")) return { hex: "#4a5320", isLight: false };
    if (
      norm.includes("forest") ||
      norm.includes("pine") ||
      norm.includes("deep") ||
      norm.includes("dark") ||
      norm.includes("bottle") ||
      norm.includes("army")
    ) {
      return { hex: "#14532d", isLight: false };
    }
    if (norm.includes("sage") || norm.includes("mint")) return { hex: "#84a98c", isLight: true };
    return { hex: "#166534", isLight: false };
  }
  if (norm.includes("burgundy") || norm.includes("wine") || norm.includes("maroon") || norm.includes("bordeaux")) {
    return { hex: "#581c24", isLight: false };
  }
  if (norm.includes("rust") || norm.includes("brick") || norm.includes("copper") || norm.includes("terracotta")) {
    return { hex: "#b45309", isLight: false };
  }
  if (norm.includes("white")) {
    return { hex: "#ffffff", isLight: true };
  }
  if (norm.includes("red")) {
    return { hex: "#dc2626", isLight: false };
  }
  if (norm.includes("yellow") || norm.includes("mustard") || norm.includes("gold")) {
    return { hex: "#d97706", isLight: false };
  }
  if (norm.includes("purple") || norm.includes("plum") || norm.includes("violet")) {
    return { hex: "#581c87", isLight: false };
  }
  if (norm.includes("pink") || norm.includes("rose") || norm.includes("coral")) {
    return { hex: "#f43f5e", isLight: false };
  }
  if (norm.includes("orange")) {
    return { hex: "#ea580c", isLight: false };
  }

  // 4. Check individual word matches in case of compound names (e.g. "Vintage Charcoal", "Cotton Denim")
  const words = norm.split(/[\s,]+/);
  for (const w of words) {
    if (w && COLOR_MAP[w]) {
      const hex = COLOR_MAP[w];
      return { hex, isLight: isLightHex(hex) };
    }
  }

  // 5. Deterministic unique hue fallback so different unknown names NEVER look identical
  const fallbackHex = getDeterministicHue(norm);
  return { hex: fallbackHex, isLight: false };
}

/** Convenience helper returning just the hex/CSS string directly */
export function getColorHexCode(colorName: string): string {
  return getColorHex(colorName).hex;
}
