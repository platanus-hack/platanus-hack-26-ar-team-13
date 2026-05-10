const API = "http://localhost:3000";

export interface AuditLog {
  id: number;
  timestamp: string;
  company: string;
  tool_name: string;
  command: string | null;
  verdict: "allow" | "warn" | "block";
  risk_score: number;
}

export interface CompanyStat {
  company: string;
  allow: number;
  warn: number;
  block: number;
  avgRiskScore: number;
}

export interface LogsResponse {
  data: AuditLog[];
  total: number;
}

export interface LogFilters {
  company?: string;
  verdict?: string;
  page?: number;
  limit?: number;
}

export async function fetchLogs(filters: LogFilters = {}): Promise<LogsResponse> {
  const params = new URLSearchParams();
  if (filters.company) params.set("company", filters.company);
  if (filters.verdict) params.set("verdict", filters.verdict);
  if (filters.page) params.set("page", String(filters.page));
  if (filters.limit) params.set("limit", String(filters.limit));
  const res = await fetch(`${API}/audit?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch logs");
  return res.json();
}

export async function fetchStats(): Promise<CompanyStat[]> {
  const res = await fetch(`${API}/audit/stats`);
  if (!res.ok) throw new Error("Failed to fetch stats");
  return res.json();
}
