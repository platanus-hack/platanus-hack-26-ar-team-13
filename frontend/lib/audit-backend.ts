const DEFAULT_BACKEND_API = "http://localhost:3000";

function auditBackendUrl(pathname: string, search = ""): URL {
  const base = process.env.BACKEND_API_URL ?? DEFAULT_BACKEND_API;
  const url = new URL(pathname, base);
  url.search = search;
  return url;
}

function auditHeaders(): HeadersInit {
  const token = process.env.AUDIT_AUTH_TOKEN;
  if (!token) throw new Error("AUDIT_AUTH_TOKEN is required");
  return { authorization: `Bearer ${token}` };
}

export async function proxyAuditRequest(
  pathname: string,
  search = "",
): Promise<Response> {
  try {
    const upstream = await fetch(auditBackendUrl(pathname, search), {
      headers: auditHeaders(),
      cache: "no-store",
    });
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "application/json",
      },
    });
  } catch {
    return Response.json(
      { error: { code: "backend_unavailable", message: "Audit backend unavailable" } },
      { status: 502 },
    );
  }
}
