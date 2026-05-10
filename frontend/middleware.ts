import { NextResponse, type NextRequest } from "next/server";

function unauthorized(): Response {
  return new Response("Authentication required", {
    status: 401,
    headers: { "www-authenticate": 'Basic realm="Hackant Dashboard"' },
  });
}

function hasValidBasicAuth(request: NextRequest): boolean {
  const username = process.env.DASHBOARD_AUTH_USER ?? "";
  const password = process.env.DASHBOARD_AUTH_PASSWORD ?? "";
  if (!username || !password) return false;

  const header = request.headers.get("authorization");
  if (!header?.startsWith("Basic ")) return false;

  try {
    const decoded = atob(header.slice("Basic ".length));
    const separator = decoded.indexOf(":");
    if (separator < 0) return false;
    return (
      decoded.slice(0, separator) === username &&
      decoded.slice(separator + 1) === password
    );
  } catch {
    return false;
  }
}

export function middleware(request: NextRequest): Response {
  if (process.env.ALLOW_PUBLIC_AUDIT_DASHBOARD === "true") {
    return NextResponse.next();
  }

  if (!process.env.DASHBOARD_AUTH_USER || !process.env.DASHBOARD_AUTH_PASSWORD) {
    return new Response("Dashboard auth is not configured", { status: 503 });
  }

  if (!hasValidBasicAuth(request)) return unauthorized();
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
