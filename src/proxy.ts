import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

import { buildCsp } from "@/server/http/csp";

/**
 * 1. Content Security Policy with a fresh nonce for every page request.
 * 2. Optimistic auth check for /konto and /admin (real authorisation happens server-side in
 *    layouts, pages and actions – CLAUDE.md §3.6).
 */
export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const protectedArea =
    path === "/konto" ||
    path.startsWith("/konto/") ||
    path === "/admin" ||
    path.startsWith("/admin/");
  if (protectedArea && !getSessionCookie(request)) {
    const url = new URL("/anmelden", request.url);
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp({
    nonce,
    isDev: process.env.NODE_ENV === "development",
    s3Endpoint: process.env.STORAGE_DRIVER === "s3" ? process.env.S3_ENDPOINT : undefined,
    s3Bucket: process.env.S3_BUCKET,
    statisticsScriptUrl: process.env.NEXT_PUBLIC_STATISTICS_SCRIPT_URL,
  });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api/|_next/static|_next/image|favicon.ico|icon|robots.txt|sitemap.xml).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
