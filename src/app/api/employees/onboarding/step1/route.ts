import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-security";
import { sendEmployeeStep1Email } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.authorized) {
      return auth.errorResponse!;
    }

    const body = await req.json();
    const {
      name,
      email,
      mobileNumber,
      address,
      designation,
      isTeamLeader,
      canEditOrders,
      canUpdateStock,
      canViewOrderForm,
      isActive,
    } = body;

    if (!email || !name) {
      return NextResponse.json(
        { error: "Employee Name and Email address are required to send Step 1 notification." },
        { status: 400 }
      );
    }

    const result = await sendEmployeeStep1Email({
      to: email.trim(),
      name: name.trim(),
      mobileNumber: (mobileNumber || "").trim(),
      address: (address || "").trim(),
      designation: designation || "Sales Representative",
      isTeamLeader: Boolean(isTeamLeader),
      canEditOrders: Boolean(canEditOrders),
      canUpdateStock: Boolean(canUpdateStock),
      canViewOrderForm: canViewOrderForm !== false,
      isActive: isActive !== false,
    });

    return NextResponse.json({ success: true, emailSent: result.success });
  } catch (error: any) {
    console.error("[ONBOARDING_STEP1_EMAIL] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to send Step 1 email" }, { status: 500 });
  }
}
