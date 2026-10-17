import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { getAdminSession, getEmployeeSession } from "@/lib/auth-security";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit
const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".pdf"]);
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

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

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // 1. File Size Validation
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum allowed file size is 10MB." },
        { status: 400 }
      );
    }

    // 2. Extension & MIME Validation
    let ext = (path.extname(file.name) || "").toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        {
          error:
            "Invalid file format. Only JPG, PNG, WEBP images and PDF documents are allowed.",
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
    const buffer = Buffer.from(bytes);

    // 3. Strict Filename Sanitization
    const rawBase = path.basename(file.name, path.extname(file.name));
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
      const mime = file.type || "image/jpeg";
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
