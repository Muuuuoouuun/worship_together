import NextAuth from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { DEV_PROVIDER_ID, getAuthConfiguration } from "@/lib/authConfig";
import { safeLocalCallbackUrl } from "@/lib/authRedirect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ nextauth: string[] }> };
const nextAuthHandler = NextAuth(authOptions);
const noStore = { "Cache-Control": "no-store" };

async function handler(request: NextRequest, context: Context) {
  const { nextauth } = await context.params;
  const [action, provider] = nextauth;
  const config = getAuthConfiguration();
  const devProvider = config.devLogin && provider === DEV_PROVIDER_ID;
  const unavailableProvider = (action === "signin" || action === "callback") && provider && !devProvider &&
    !config.providers.some((item) => item.id === provider && item.enabled);

  if (!config.ready || unavailableProvider) {
    if (request.method === "GET" && action === "session") return NextResponse.json(null, { headers: noStore });
    if (request.method === "GET" && action === "providers") return NextResponse.json({}, { headers: noStore });
    const destination = new URL("/login", config.origin ?? request.nextUrl.origin);
    destination.searchParams.set("error", "Configuration");
    destination.searchParams.set("callbackUrl", safeLocalCallbackUrl(request.nextUrl.searchParams.get("callbackUrl"), config.origin ?? undefined));
    if (request.method === "GET" && ["signin", "callback", "error", "signout"].includes(action)) {
      return NextResponse.redirect(destination, { status: 303, headers: noStore });
    }
    return NextResponse.json({ error: "Configuration", message: "로그인 연결 설정이 아직 완료되지 않았습니다.", url: destination.toString() }, { status: 503, headers: noStore });
  }

  const response = await nextAuthHandler(request, context) as Response;
  response.headers.set("Cache-Control", "no-store");
  // Keep library state/CSRF/cookie handling intact; only clarify a cancelled flow's UI.
  if (action === "callback" && request.nextUrl.searchParams.get("error") === "access_denied" && response.headers.has("Location")) {
    const destination = new URL("/login", config.origin!);
    destination.searchParams.set("error", "OAuthCancelled");
    const callback = request.cookies.get("__Secure-next-auth.callback-url")?.value ?? request.cookies.get("next-auth.callback-url")?.value;
    destination.searchParams.set("callbackUrl", safeLocalCallbackUrl(callback, config.origin!));
    response.headers.set("Location", destination.toString());
  }
  return response;
}

export { handler as GET, handler as POST };
