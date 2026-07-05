// Next 16 proxy (formerly the "middleware" convention). Redirects
// unauthenticated visitors away from the dashboard and onboarding to the
// sign-in page. This is UX only: the authoritative access control is the
// per-request membership check in each API route (src/lib/session.ts) and the
// dashboard layout, because the proxy does not run in front of every App Router
// data path.

import { NextResponse } from "next/server";
import { auth } from "@/auth";

export default auth((req) => {
  if (!req.auth) {
    const url = new URL("/signin", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*", "/onboarding"],
};
