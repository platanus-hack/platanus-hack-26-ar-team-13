import { type NextRequest } from "next/server";
import { proxyAuditRequest } from "@/lib/audit-backend";

export async function GET(request: NextRequest): Promise<Response> {
  return proxyAuditRequest("/audit", request.nextUrl.search);
}
