/**
 * IST (Indian Standard Time, UTC+5:30) Working Hours & Automatic Logout Utility
 * Everyday after 9:00 PM IST (21:00) through 6:00 AM IST, employee sessions are closed.
 */

export function getISTDate(): Date {
  const now = new Date();
  const istString = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  return new Date(istString);
}

export function isNightLogoutTimeIST(): boolean {
  const istDate = getISTDate();
  const hour = istDate.getHours();
  // 9:00 PM IST (21:00) onwards until 6:00 AM IST
  return hour >= 21 || hour < 6;
}

export function getISTFormattedTime(): string {
  const istDate = getISTDate();
  return istDate.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Check if employee is a Team Leader (T.L.) who has 24*7 panel access
 */
export function isEmployeeTeamLeader(
  emp: { isTeamLeader?: boolean | null; designation?: string | null } | null | undefined
): boolean {
  if (!emp) return false;
  if (emp.isTeamLeader) return true;
  const des = (emp.designation || "").trim().toLowerCase();
  return (
    des === "t.l." ||
    des === "tl" ||
    des === "team leader" ||
    des.includes("team leader") ||
    des.includes("t.l.") ||
    des.includes("(t.l.)") ||
    des.startsWith("tl ") ||
    des.endsWith(" tl")
  );
}
