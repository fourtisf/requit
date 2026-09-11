import { NextResponse, type NextRequest } from "next/server";
import { REFERRAL_COOKIE, REFERRAL_COOKIE_MAX_AGE_SECONDS } from "@/lib/referral-cookie";

/**
 * Two jobs, both of which have to happen before a page renders.
 *
 * 1. A coarse gate on signed-in routes. This runs on the edge and cannot reach
 *    the database, so it only asks "is there a session cookie". The
 *    authoritative check — is the session real, is the user suspended — is
 *    `requireUser()` in the page. This exists so that a page added later which
 *    forgets that call is still not served to an anonymous visitor.
 *
 * 2. A per-request CSP nonce. Next puts inline bootstrap scripts on every page,
 *    so a script-src without a nonce means falling back to 'unsafe-inline',
 *    which is not a policy at all. Next reads the nonce out of the CSP header on
 *    the request and stamps it onto the scripts it emits.
 *
 * 3. Parking a ?ref= code. Someone arrives on a shared link and signs up
 *    minutes or days later, on a different page. The code has to survive that
 *    gap, and the cookie is the only thing that does.
 */
// /admin is here for the cheap redirect only. The real gate is requireAdmin()
// in the page and again in every action — middleware runs on the edge and
// cannot read the allowlist decision against a session.
const PROTECTED = ["/dashboard", "/settings", "/withdraw", "/tasks", "/disputes", "/admin"];

// Auth.js prefixes the cookie with __Secure- when it is issued over HTTPS.
const SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  const needsAuth = PROTECTED.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (needsAuth && !SESSION_COOKIES.some((name) => request.cookies.has(name))) {
    const signIn = new URL("/signin", request.url);
    return NextResponse.redirect(signIn);
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", contentSecurityPolicy(nonce));

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("content-security-policy", contentSecurityPolicy(nonce));
  captureReferral(request, response);
  return response;
}

function captureReferral(request: NextRequest, response: NextResponse): void {
  const code = request.nextUrl.searchParams.get("ref")?.trim();
  if (!code) return;

  // First link wins. Overwriting would let anyone hijack an existing referral by
  // getting the visitor to click one more link before they sign up.
  if (request.cookies.has(REFERRAL_COOKIE)) return;

  // Length-capped because it is attacker-supplied and goes into a cookie; the
  // real format check is normaliseReferralCode at signup.
  response.cookies.set(REFERRAL_COOKIE, code.slice(0, 32), {
    maxAge: REFERRAL_COOKIE_MAX_AGE_SECONDS,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

function contentSecurityPolicy(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";

  return [
    "default-src 'self'",
    // 'strict-dynamic' lets the nonced bootstrap load the chunks it needs
    // without every chunk being listed. Dev needs eval for React Refresh.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${isDev ? "'unsafe-eval'" : ""}`,
    // Tailwind ships a stylesheet, but Next still inlines a little CSS and
    // React sets style attributes. Nonces do not cover style attributes, so
    // this stays 'unsafe-inline' — it is the weakest line here and it is why
    // script-src is kept strict.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    // Offer networks get added here in Phase 1, one origin per approved network.
    // Never widen it to https: — that is the whole attack surface of an iframe.
    "frame-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    // Replaces X-Frame-Options. Our own pages are never framed: the withdrawal
    // screen inside someone else's iframe is a clickjacked payout.
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ]
    .filter(Boolean)
    .join("; ");
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and the image optimiser. The auth routes
     * ARE matched — they set cookies and need the same headers.
     */
    {
      source: "/((?!_next/static|_next/image|icon.svg|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
