import fs from "fs";
import path from "path";

export type DayOfWeek =
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday"
  | "Sunday";

export interface WhatsAppSettings {
  weeklyReminderEnabled: boolean;
  weeklyReminderDay: DayOfWeek;
  weeklyReminderTime: string; // e.g. "10:00"
  autoOrderStatusMessage: boolean;
  lastDispatchedDate?: string | null;
  lastDispatchedCount?: number;
}

const SETTINGS_FILE = path.resolve(process.cwd(), "prisma", "whatsapp-settings.json");

export const DEFAULT_WHATSAPP_SETTINGS: WhatsAppSettings = {
  weeklyReminderEnabled: true,
  weeklyReminderDay: "Saturday",
  weeklyReminderTime: "10:00",
  autoOrderStatusMessage: true,
  lastDispatchedDate: null,
  lastDispatchedCount: 0,
};

export function getWhatsAppSettings(): WhatsAppSettings {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const content = fs.readFileSync(SETTINGS_FILE, "utf-8");
      const parsed = JSON.parse(content);
      return { ...DEFAULT_WHATSAPP_SETTINGS, ...parsed };
    }
  } catch (err) {
    console.error("Error reading WhatsApp settings:", err);
  }
  return { ...DEFAULT_WHATSAPP_SETTINGS };
}

export function updateWhatsAppSettings(patch: Partial<WhatsAppSettings>): WhatsAppSettings {
  try {
    const current = getWhatsAppSettings();
    const updated = { ...current, ...patch };
    const dir = path.dirname(SETTINGS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2), "utf-8");
    return updated;
  } catch (err) {
    console.error("Error writing WhatsApp settings:", err);
    return { ...DEFAULT_WHATSAPP_SETTINGS, ...patch };
  }
}
