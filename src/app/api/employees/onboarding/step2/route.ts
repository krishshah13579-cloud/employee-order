import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-security";
import { sendEmployeeStep2Email } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.authorized) {
      return auth.errorResponse!;
    }

    const body = await req.json();
    const { name, email, documentType } = body;

    if (!email || !name) {
      return NextResponse.json(
        { error: "Employee Name and Email address are required to send Step 2 notification." },
        { status: 400 }
      );
    }

    const result = await sendEmployeeStep2Email({
      to: email.trim(),
      name: name.trim(),
      documentType: documentType || "Identity / Address Verification Document",
    });

    return NextResponse.json({ success: true, emailSent: result.success });
  } catch (error: any) {
    console.error("[ONBOARDING_STEP2_EMAIL] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to send Step 2 email" }, { status: 500 });
  }
}
