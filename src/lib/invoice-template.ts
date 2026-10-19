import prisma from "@/lib/prisma";
import fs from "fs";
import path from "path";
import {
  type InvoiceTemplateSettings,
  DEFAULT_INVOICE_TEMPLATE,
} from "./invoice-template-types";

export type { InvoiceTemplateSettings };
export { DEFAULT_INVOICE_TEMPLATE };

const JSON_SETTINGS_PATH = path.resolve(process.cwd(), "prisma", "invoice-template-settings.json");

export async function getInvoiceTemplateSettings(): Promise<InvoiceTemplateSettings> {
  // 1. Try to read from Prisma DB
  try {
    const dbRecord = await (prisma as any).invoiceTemplate.findFirst({
      orderBy: { id: "desc" },
    });
    if (dbRecord) {
      return {
        ...DEFAULT_INVOICE_TEMPLATE,
        ...dbRecord,
      };
    }
  } catch (err) {
    // DB not yet populated or offline
  }

  // 2. Try to read from JSON file
  try {
    if (fs.existsSync(JSON_SETTINGS_PATH)) {
      const content = fs.readFileSync(JSON_SETTINGS_PATH, "utf-8");
      const parsed = JSON.parse(content);
      return { ...DEFAULT_INVOICE_TEMPLATE, ...parsed };
    }
  } catch {}

  return { ...DEFAULT_INVOICE_TEMPLATE };
}

export async function saveInvoiceTemplateSettings(
  patch: Partial<InvoiceTemplateSettings>
): Promise<InvoiceTemplateSettings> {
  const current = await getInvoiceTemplateSettings();
  const updated: InvoiceTemplateSettings = {
    ...current,
    ...patch,
  };

  // 1. Save to JSON file
  try {
    const dir = path.dirname(JSON_SETTINGS_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(JSON_SETTINGS_PATH, JSON.stringify(updated, null, 2), "utf-8");
  } catch (err) {
    console.warn("Could not save to JSON file:", err);
  }

  // 2. Save or update Prisma DB
  try {
    const existing = await (prisma as any).invoiceTemplate.findFirst({
      orderBy: { id: "desc" },
    });
    if (existing) {
      await (prisma as any).invoiceTemplate.update({
        where: { id: existing.id },
        data: updated,
      });
    } else {
      await (prisma as any).invoiceTemplate.create({
        data: updated,
      });
    }
  } catch (err) {
    console.warn("Could not save to DB invoiceTemplate:", err);
  }

  return updated;
}
