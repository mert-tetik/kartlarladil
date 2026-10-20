const NATIVE_GOOGLE_AUTH_CALLBACK = "foxiesdeck://auth/callback";

export function getGoogleOAuthRedirectTo(origin: string, nextPath: string, nativeTwa: boolean): string {
  const callback = new URL("/auth/callback", origin);
  callback.searchParams.set("next", nextPath);

  if (nativeTwa) {
    callback.searchParams.set("native", "1");
  }

  return callback.toString();
}

export function isPkceCodeVerifierError(error: { code?: string; message?: string }): boolean {
  return error.code === "pkce_code_verifier_not_found" ||
    error.message?.toLowerCase().includes("code verifier") === true;
}

export function getNativeGoogleAuthHandoffUrl(code: string, nextPath: string): string {
  const callback = new URL(NATIVE_GOOGLE_AUTH_CALLBACK);
  callback.searchParams.set("code", code);
  callback.searchParams.set("next", nextPath);
  return callback.toString();
}
