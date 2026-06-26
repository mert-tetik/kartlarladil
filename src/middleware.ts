import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const MOBILE_AUTH_PATHS = ["/login", "/register", "/register/preferences"];

function isMobileUserAgent(userAgent: string | null): boolean {
  if (!userAgent) return false;
  const mobilePattern = /Mobile|Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i;
  return mobilePattern.test(userAgent);
}

export async function middleware(request: NextRequest) {
  const response = await updateSession(request);
  const { pathname } = request.nextUrl;

  if (
    isMobileUserAgent(request.headers.get("user-agent")) &&
    MOBILE_AUTH_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
  ) {
    const redirectResponse = NextResponse.redirect(new URL("/", request.url));

    for (const cookie of response.cookies.getAll()) {
      redirectResponse.cookies.set(cookie);
    }

    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
