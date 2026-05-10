import { proxyAuditRequest } from "@/lib/audit-backend";

export async function GET(): Promise<Response> {
  return proxyAuditRequest("/audit/stats");
}
