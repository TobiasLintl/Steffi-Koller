import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic check only: redirects visitors without a session cookie to the login page.
 * Real authorisation happens server-side in layouts, pages and actions (CLAUDE.md §3.6).
 */
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    const url = new URL("/anmelden", request.url);
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/konto/:path*", "/admin/:path*"],
};
