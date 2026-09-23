import { NextResponse, type NextRequest } from "next/server";
import { verifySession } from "@/lib/auth";

const publicPaths = ["/api/auth/login", "/api/line/webhook", "/api/jobs/worker", "/login"];
export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (publicPaths.includes(path)) return NextResponse.next();
  const valid = verifySession(request.cookies.get("lsa_session")?.value);
  if ((path.startsWith("/api/") || path !== "/") && !valid) {
    if (path.startsWith("/api/")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (path.startsWith("/api/") && !["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const origin = request.headers.get("origin");
    if (origin && new URL(origin).host !== request.nextUrl.host) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  return NextResponse.next();
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
