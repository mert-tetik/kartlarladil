/**
 * Shared by browser and server Supabase clients. The browser client stores the
 * PKCE verifier and auth session in these cookies through document.cookie, so
 * they must remain JavaScript-accessible (HttpOnly would break OAuth exchange).
 */
export const SUPABASE_COOKIE_OPTIONS = {
  httpOnly: false,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 365,
  path: "/",
};
