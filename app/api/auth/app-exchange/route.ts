import { NextRequest, NextResponse } from "next/server";
import { encode } from "next-auth/jwt";
import { SESSION_MAX_AGE, getAuthConfiguration, sessionCookieName, sessionTokenClaims } from "@/lib/authConfig";
import { isSameOriginRequest } from "@/lib/nativeAuth";
import { getAppLoginCodes } from "@/lib/server/teams";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };
const reply = (body: Record<string, unknown>, status: number) => NextResponse.json(body, { status, headers: noStore });

/**
 * 앱 셸 로그인 마지막 단계 (앱 WebView 에서 같은 origin 으로 fetch).
 * 일회용 코드 + verifier 를 확인하고(만료 · 사용 여부 · SHA-256(verifier) === challenge, 사용 표시는 같은 트랜잭션),
 * NextAuth 와 같은 이름 · 속성 · 수명 · 토큰 모양의 세션 쿠키를 이 응답에 설정합니다.
 */
export async function POST(request: NextRequest) {
  const config = getAuthConfiguration();
  if (!config.ready || !config.origin) return reply({ ok: false, error: "로그인 연결 설정이 아직 완료되지 않았습니다." }, 503);
  // 다른 사이트가 보낸 요청(CSRF)은 코드를 조회하기 전에 막습니다.
  if (!isSameOriginRequest({ origin: request.headers.get("origin"), secFetchSite: request.headers.get("sec-fetch-site") }, [config.origin, request.nextUrl.origin])) {
    return reply({ ok: false, error: "허용되지 않은 요청입니다." }, 403);
  }
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) return reply({ ok: false, error: "요청 형식을 확인해 주세요." }, 415);
  let body: { code?: unknown; verifier?: unknown } | null = null;
  try {
    body = await request.json();
  } catch { /* 아래에서 거절 */ }
  if (!body || typeof body !== "object") return reply({ ok: false, error: "요청 형식을 확인해 주세요." }, 400);

  let result;
  try {
    result = await getAppLoginCodes().redeem(body.code, body.verifier);
  } catch (error) {
    console.error("[auth] app login exchange", error instanceof Error ? error.name : error);
    return reply({ ok: false, error: "로그인을 마치지 못했어요. 잠시 후 다시 시도해 주세요." }, 503);
  }
  if (!result.ok) return reply({ ok: false, error: "로그인 코드가 만료되었거나 이미 사용되었어요. 앱에서 다시 로그인해 주세요." }, 400);

  const token = await encode({ token: sessionTokenClaims(result.user), secret: process.env.NEXTAUTH_SECRET!, maxAge: SESSION_MAX_AGE });
  const response = reply({ ok: true, callbackUrl: result.callbackUrl }, 200);
  // NextAuth 와 같은 기준(NEXTAUTH_URL 이 https 인지)으로 쿠키 이름 · Secure 를 정합니다.
  const secure = config.origin.startsWith("https://");
  const name = sessionCookieName(secure);
  const options = { httpOnly: true, sameSite: "lax" as const, path: "/", secure };
  // 예전에 나뉘어 저장된 세션 조각(name.0, name.1 …)이 남아 있으면 NextAuth 가 이어 붙여 읽으므로 지웁니다.
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith(`${name}.`)) response.cookies.set(cookie.name, "", { ...options, maxAge: 0, expires: new Date(0) });
  }
  response.cookies.set(name, token, { ...options, maxAge: SESSION_MAX_AGE, expires: new Date(Date.now() + SESSION_MAX_AGE * 1000) });
  return response;
}
