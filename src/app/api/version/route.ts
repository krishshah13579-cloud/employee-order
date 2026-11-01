import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";
export const revalidate = 0;

declare global {
  var __APP_STARTUP_TIME__: string | undefined;
}

let cachedBuildId: string | null = null;

function getBuildId(): string {
  if (cachedBuildId) return cachedBuildId;
  try {
    const buildIdPath = path.join(process.cwd(), ".next", "BUILD_ID");
    if (fs.existsSync(buildIdPath)) {
      cachedBuildId = fs.readFileSync(buildIdPath, "utf8").trim();
      return cachedBuildId;
    }
  } catch {}
  if (!globalThis.__APP_STARTUP_TIME__) {
    globalThis.__APP_STARTUP_TIME__ = String(Date.now());
  }
  return globalThis.__APP_STARTUP_TIME__;
}

export async function GET() {
  const version = getBuildId();
  return NextResponse.json(
    {
      version,
      timestamp: Date.now(),
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    }
  );
}
