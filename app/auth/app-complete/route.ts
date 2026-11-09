import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAuthConfiguration, sessionCookieName } from "@/lib/authConfig";
import { APP_SIGNIN_PATH, appReturnUrl, handoffCookieName, verifyHandoff } from "@/lib/nativeAuth";
import { getAppLoginCodes } from "@/lib/server/teams";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

/** 리다이렉트를 따르지 않는 브라우저용 본문. 앱 링크를 사용자가 직접 누를 수 있게 합니다. */
function fallbackPage(target: string) {
  const href = escapeHtml(target);
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer"><meta name="robots" content="noindex"><title>앱으로 돌아가기 | Worship Together</title></head>
<body style="font-family:system-ui,sans-serif;max-width:440px;margin:15vh auto;padding:0 20px;line-height:1.7">
<h1 style="font-size:22px">로그인을 마쳤어요</h1><p>앱이 열리지 않으면 아래 버튼을 눌러 주세요.</p>
<p><a href="${href}" style="display:inline-block;padding:12px 20px;border-radius:9999px;background:#111;color:#fff;text-decoration:none;font-weight:600">앱으로 돌아가기</a></p>
</body></html>`;
}

/**
 * 앱 셸 로그인 3단계 (시스템 브라우저, NextAuth 가 이 브라우저에 세션을 만든 직후).
 * 브라우저 세션과 서명한 핸드오프 쿠키를 확인하고 일회용 코드(256비트, 60초, 해시만 저장)를 발급한 뒤,
 * 핸드오프 쿠키를 지우고 이 브라우저를 로그아웃시키고(세션 쿠키 만료), 앱 링크 /auth/app-return?code=… 로 보냅니다.
 */
export async function GET(request: NextRequest) {
  const config = getAuthConfiguration();
  const origin = request.nextUrl.origin;
  const secure = (config.origin ?? origin).startsWith("https://");
  const handoffName = handoffCookieName(secure);
  const handoffOptions = { httpOnly: true, sameSite: "lax" as const, secure, path: "/auth", maxAge: 0, expires: new Date(0) };
  const record = config.ready ? await verifyHandoff(request.cookies.get(handoffName)?.value, process.env.NEXTAUTH_SECRET ?? "") : null;

  const toSignIn = (error: string, clearHandoff: boolean) => {
    const destination = new URL(APP_SIGNIN_PATH, origin);
    destination.searchParams.set("error", error);
    const response = NextResponse.redirect(destination, { status: 303, headers: noStore });
    if (clearHandoff) response.cookies.set(handoffName, "", handoffOptions);
    return response;
  };
  // 핸드오프 쿠키가 없으면 앱이 시작한 로그인이 아닙니다. 이 브라우저의 로그인은 건드리지 않습니다.
  if (!record) return toSignIn("Expired", true);
  const user = await getCurrentUser();
  // 공급자 로그인을 취소 · 실패한 경우. 쿠키를 남겨 이 창에서 다시 시도할 수 있게 합니다.
  if (!user) return toSignIn("SessionRequired", false);

  let code: string;
  try {
    code = await getAppLoginCodes().issue({ user, challenge: record.challenge, callbackUrl: record.callbackUrl });
  } catch (error) {
    console.error("[auth] app login code", error instanceof Error ? error.name : error);
    return toSignIn("Unavailable", false);
  }

  const target = appReturnUrl(origin, code);
  const response = new NextResponse(fallbackPage(target), {
    status: 303,
    headers: { ...noStore, Location: target, "Content-Type": "text/html; charset=utf-8" },
  });
  response.cookies.set(handoffName, "", handoffOptions);
  // 이 브라우저(Custom Tab 은 Chrome 과 쿠키를 같이 씀)에 로그인이 남지 않게 NextAuth 세션 쿠키(나뉜 조각 포함)를 지웁니다.
  const sessionName = sessionCookieName(secure);
  const sessionOptions = { httpOnly: true, sameSite: "lax" as const, secure, path: "/", maxAge: 0, expires: new Date(0) };
  response.cookies.set(sessionName, "", sessionOptions);
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith(`${sessionName}.`)) response.cookies.set(cookie.name, "", sessionOptions);
  }
  return response;
}
