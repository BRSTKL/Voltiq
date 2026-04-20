import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// GATING STRATEGY:
// Hard redirect (-> /login): /dashboard/* - requires authentication
// Soft gate (shows upgrade modal / locked states in-page): /tools/* - middleware does not block these routes
// Public at middleware layer: /, /pricing, /docs, /contact, /privacy, /terms, /login, /api/market/*
// Note: /api/market/sync still keeps its own CRON_SECRET check inside the route handler

type MiddlewareSession = {
  user?: {
    email?: string | null;
  } | null;
} | null;

async function getSession(request: NextRequest): Promise<MiddlewareSession> {
  try {
    const response = await fetch(new URL("/api/auth/session", request.url), {
      headers: {
        cookie: request.headers.get("cookie") ?? "",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as MiddlewareSession;
  } catch {
    return null;
  }
}

function redirectToLogin(request: NextRequest) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set(
    "callbackUrl",
    `${request.nextUrl.pathname}${request.nextUrl.search}`
  );

  return NextResponse.redirect(loginUrl);
}

export default async function middleware(request: NextRequest) {
  const session = await getSession(request);

  if (!session?.user?.email) {
    return redirectToLogin(request);
  }

  if (request.nextUrl.pathname.startsWith("/admin")) {
    const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
    const currentEmail = session.user.email.toLowerCase();

    if (!adminEmail || currentEmail !== adminEmail) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard", "/dashboard/:path*", "/admin", "/admin/:path*"],
};
