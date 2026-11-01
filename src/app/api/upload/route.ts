import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { getAdminSession, getEmployeeSession } from "@/lib/auth-security";

// Allow photos up to 25MB (supporting user's 14MB+ requirement)
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".pdf",
  ".heic",
  ".heif",
  ".avif",
  ".svg",
]);
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/avif",
  "image/svg+xml",
  "application/pdf",
]);

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    // Authentication Guard: require logged-in Admin or Employee
    const admin = await getAdminSession(req);
    const employee = !admin ? await getEmployeeSession(req) : null;
    if (!admin && !employee) {
      return NextResponse.json(
        { error: "Unauthorized: Please log in to upload files." },
        { status: 401 }
      );
    }

    let buffer: Buffer;
    let originalName = "";
    let ext = ".jpg";

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const json = await req.json();
      const base64Data = json.base64 || json.fileData || json.dataUrl;
      if (!base64Data) {
        return NextResponse.json({ error: "No image data provided" }, { status: 400 });
      }

      const match = String(base64Data).match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        const mime = match[1].toLowerCase();
        const raw = match[2];
        buffer = Buffer.from(raw, "base64");
        ext = mime.includes("webp")
          ? ".webp"
          : mime.includes("png")
          ? ".png"
          : mime.includes("svg")
          ? ".svg"
          : ".jpg";
        originalName = json.filename || `photo_${Date.now()}`;
      } else {
        return NextResponse.json({ error: "Invalid base64 format" }, { status: 400 });
      }
    } else {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
      }

      // 1. File Size Validation (allows up to 25MB)
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: "File too large. Maximum allowed file size is 25MB." },
          { status: 400 }
        );
      }

      // 2. Extension & MIME Validation
      ext = (path.extname(file.name) || "").toLowerCase();
      if (!ext && file.type) {
        if (file.type.includes("webp")) ext = ".webp";
        else if (file.type.includes("png")) ext = ".png";
        else ext = ".jpg";
      }

      if (!ALLOWED_EXTENSIONS.has(ext)) {
        return NextResponse.json(
          {
            error:
              "Invalid file format. Only JPG, PNG, WEBP, and PDF documents are allowed.",
          },
          { status: 400 }
        );
      }

      if (file.type && !ALLOWED_MIME_TYPES.has(file.type.toLowerCase())) {
        return NextResponse.json(
          { error: "Invalid file content type. Please upload a valid image or PDF." },
          { status: 400 }
        );
      }

      if (ext === ".jpeg") ext = ".jpg";

      const bytes = await file.arrayBuffer();
      buffer = Buffer.from(bytes);
      originalName = path.basename(file.name, path.extname(file.name));
    }

    if (buffer.length > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum allowed file size is 25MB." },
        { status: 400 }
      );
    }

    // 3. Strict Filename Sanitization
    const rawBase = path.basename(originalName);
    const cleanBase = rawBase.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 50);
    const uniqueName = `${Date.now()}_${cleanBase || "file"}${ext}`;

    const uploadDir = path.join(process.cwd(), "public", "uploads");

    try {
      const fs = await import("fs/promises");
      await fs.mkdir(uploadDir, { recursive: true });

      const filePath = path.join(uploadDir, uniqueName);

      // Verify that target path is strictly inside uploadDir (Path Traversal Protection)
      const resolvedPath = path.resolve(filePath);
      const resolvedUploadDir = path.resolve(uploadDir);
      if (!resolvedPath.startsWith(resolvedUploadDir + path.sep)) {
        return NextResponse.json({ error: "Invalid file destination" }, { status: 400 });
      }

      await fs.writeFile(filePath, buffer);

      const fileUrl = `/uploads/${uniqueName}`;
      return NextResponse.json({ url: fileUrl, filename: uniqueName }, { status: 201 });
    } catch {
      // Fallback to Data URL on serverless read-only filesystem
      const mime =
        ext === ".png"
          ? "image/png"
          : ext === ".webp"
          ? "image/webp"
          : "image/jpeg";
      const base64Data = buffer.toString("base64");
      const dataUrl = `data:${mime};base64,${base64Data}`;
      return NextResponse.json({ url: dataUrl, filename: uniqueName }, { status: 201 });
    }
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload file: " + error.message },
      { status: 500 }
    );
  }
}
