/**
 * Client Session ID Manager
 * Generates and persists a unique session ID for the employee's browser tab/device.
 */
export function getClientSessionId(): string {
  if (typeof window === "undefined") {
    return "server_session";
  }

  let sessionId = localStorage.getItem("garmentpro_session_id");
  if (!sessionId || !sessionId.startsWith("sess_")) {
    sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    localStorage.setItem("garmentpro_session_id", sessionId);
  }

  return sessionId;
}
