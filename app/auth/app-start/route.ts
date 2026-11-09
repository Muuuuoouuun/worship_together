import { NextRequest, NextResponse } from "next/server";
import { DEV_PROVIDER_ID, getAuthConfiguration } from "@/lib/authConfig";
import {
  APP_SIGNIN_PATH, NATIVE_LOGIN_TTL_MS, appCallbackUrl, handoffCookieName, isAppStartNavigation, isLoginToken, signHandoff,
} from "@/lib/nativeAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 앱 셸 로그인 1단계 (시스템 브라우저: Custom Tabs · SFSafariViewController).
 * 앱이 만든 challenge 와 돌아갈 화면을 서명한 핸드오프 쿠키(10분, httpOnly, SameSite=Lax, Path=/auth)에 담고,
 * 그 공급자의 NextAuth 로그인(/auth/app-signin → signIn(provider, { callbackUrl: '/auth/app-complete' }))으로 보냅니다.
 * 흐름: lib/nativeAuth.ts
 */
export async function GET(request: NextRequest) {
  const config = getAuthConfiguration();
  const params = request.nextUrl.searchParams;
  const provider = params.get("provider") ?? "";
  const challenge = params.get("challenge");
  const origin = config.origin ?? request.nextUrl.origin;
  const destination = new URL(APP_SIGNIN_PATH, origin);
  const secure = origin.startsWith("https://");
  const cookieName = handoffCookieName(secure);
  const cookieOptions = { httpOnly: true, sameSite: "lax" as const, secure, path: "/auth" };

  const enabled = config.ready && (provider === DEV_PROVIDER_ID ? config.devLogin : config.providers.some((item) => item.id === provider && item.enabled));
  let error: string | null = null;
  if (!config.ready || !enabled) error = "Configuration";
  else if (!isLoginToken(challenge)) error = "InvalidRequest";
  // 다른 사이트의 링크로 앱 로그인을 시작하지 않습니다. 앱이 연 브라우저는 Sec-Fetch-Site: none 입니다.
  else if (!isAppStartNavigation(request.headers.get("sec-fetch-site"))) error = "InvalidRequest";

  if (error) {
    destination.searchParams.set("error", error);
    const response = NextResponse.redirect(destination, { status: 303, headers: { "Cache-Control": "no-store" } });
    response.cookies.set(cookieName, "", { ...cookieOptions, maxAge: 0, expires: new Date(0) });
    return response;
  }

  const exp = Date.now() + NATIVE_LOGIN_TTL_MS;
  const value = await signHandoff({ provider, challenge: challenge!, callbackUrl: appCallbackUrl(params.get("callbackUrl"), origin), exp }, process.env.NEXTAUTH_SECRET!);
  const response = NextResponse.redirect(destination, { status: 303, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  response.cookies.set(cookieName, value, { ...cookieOptions, maxAge: NATIVE_LOGIN_TTL_MS / 1000, expires: new Date(exp) });
  return response;
}
