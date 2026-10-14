import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".avif": "image/avif",
  ".bmp": "image/bmp",
  ".ico": "image/x-icon",
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const resolvedParams = await params;
    const pathSegments = resolvedParams?.path;

    if (!pathSegments || !Array.isArray(pathSegments) || pathSegments.length === 0) {
      return new NextResponse("Not Found", { status: 404 });
    }

    // Sanitize path segments to prevent directory traversal
    const safeSegments = pathSegments.map((s) => path.basename(decodeURIComponent(s)));
    const requestedFileName = safeSegments.join(path.sep);

    // 1. Check in public/uploads/
    let targetPath = path.join(process.cwd(), "public", "uploads", ...safeSegments);

    // 2. If not found directly, check case-insensitively in public/uploads/
    if (!fs.existsSync(targetPath)) {
      const uploadDir = path.join(process.cwd(), "public", "uploads");
      if (fs.existsSync(uploadDir)) {
        try {
          const files = fs.readdirSync(uploadDir);
          const targetLower = requestedFileName.toLowerCase();
          const matched = files.find((f) => f.toLowerCase() === targetLower);
          if (matched) {
            targetPath = path.join(uploadDir, matched);
          }
        } catch {}
      }
    }

    // 3. Fallback: check in public/ or public/images/
    if (!fs.existsSync(targetPath)) {
      const directPublic = path.join(process.cwd(), "public", ...safeSegments);
      if (fs.existsSync(directPublic)) {
        targetPath = directPublic;
      } else {
        const imagePublic = path.join(process.cwd(), "public", "images", ...safeSegments);
        if (fs.existsSync(imagePublic)) {
          targetPath = imagePublic;
        }
      }
    }

    // 4. If still not found, return clean SVG fallback placeholder
    if (!fs.existsSync(targetPath) || fs.statSync(targetPath).isDirectory()) {
      const svgPlaceholder = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
        <rect width="400" height="400" fill="#f1f5f9"/>
        <path d="M160 120 L240 120 L225 280 L205 280 L200 190 L195 280 L175 280 Z" fill="#cbd5e1" stroke="#94a3b8" stroke-width="2"/>
        <text x="50%" y="78%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="13" font-weight="600" fill="#64748b">Garment Preview</text>
      </svg>`;

      return new NextResponse(svgPlaceholder, {
        headers: {
          "Content-Type": "image/svg+xml",
          "Cache-Control": "public, max-age=60",
        },
      });
    }

    const ext = path.extname(targetPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "image/jpeg";
    const fileBuffer = await fs.promises.readFile(targetPath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": fileBuffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error("Error serving uploaded image:", error);
    return new NextResponse("Error serving image", { status: 500 });
  }
}
