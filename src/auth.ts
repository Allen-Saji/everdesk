// Auth.js (NextAuth v5) — Google sign-in, stateless JWT sessions (no DB
// adapter: company membership lives in KV, see src/lib/members.ts). The Google
// provider reads AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET from the environment;
// AUTH_SECRET signs the session cookie. trustHost is required behind Vercel /
// self-host proxies where the host header is set by the platform.

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  trustHost: true,
  pages: { signIn: "/signin" },
});
