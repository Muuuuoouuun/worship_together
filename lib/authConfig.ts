import { createHash } from "node:crypto";
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import NaverProvider from "next-auth/providers/naver";
import CredentialsProvider from "next-auth/providers/credentials";
import { safeLocalCallbackUrl } from "./authRedirect";
import { DEV_PROVIDER_ID } from "./authIds";

export { DEV_PROVIDER_ID };
export type AuthProviderId = "google" | "naver";
type AuthEnvironment = Partial<Record<
  "NEXTAUTH_SECRET" | "NEXTAUTH_URL" | "GOOGLE_CLIENT_ID" | "GOOGLE_CLIENT_SECRET" | "NAVER_CLIENT_ID" | "NAVER_CLIENT_SECRET" | "NODE_ENV" | "DEV_LOGIN", string
>>;

export function getAuthConfiguration(env: AuthEnvironment = process.env) {
  let origin: string | null = null;
  try {
    const url = new URL(env.NEXTAUTH_URL ?? "");
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (!url.username && !url.password && url.pathname === "/" && !url.search && !url.hash &&
      (url.protocol === "https:" || (url.protocol === "http:" && local && env.NODE_ENV !== "production"))) {
      origin = url.origin;
    }
  } catch { /* An absent or invalid public URL disables OAuth. */ }
  const ready = Boolean(origin && env.NEXTAUTH_SECRET?.trim());
  return {
    ready,
    origin,
    /** DEV_LOGIN=1 이고 운영(production)이 아닐 때만 */
    devLogin: ready && env.DEV_LOGIN === "1" && env.NODE_ENV !== "production",
    providers: ([
      { id: "google", name: "Google", enabled: ready && Boolean(env.GOOGLE_CLIENT_ID?.trim() && env.GOOGLE_CLIENT_SECRET?.trim()) },
      { id: "naver", name: "네이버", enabled: ready && Boolean(env.NAVER_CLIENT_ID?.trim() && env.NAVER_CLIENT_SECRET?.trim()) },
    ] satisfies { id: AuthProviderId; name: string; enabled: boolean }[]),
  };
}

/** Stable identity contract for team ownership. Email is deliberately excluded. */
export function providerUserId(provider: string, providerAccountId: string): string {
  if (![...["google", "naver"], DEV_PROVIDER_ID].includes(provider) || !providerAccountId?.trim()) throw new Error("Invalid OAuth account");
  return createHash("sha256").update(`${provider}:${providerAccountId}`, "utf8").digest("hex");
}

export function createAuthOptions(env: AuthEnvironment = process.env): NextAuthOptions {
  const config = getAuthConfiguration(env);
  const enabled = new Set<string>(config.providers.filter((provider) => provider.enabled).map((provider) => provider.id));
  if (config.devLogin) enabled.add(DEV_PROVIDER_ID);
  return {
    secret: env.NEXTAUTH_SECRET,
    session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
    providers: [
      ...(enabled.has("google") ? [GoogleProvider({
        clientId: env.GOOGLE_CLIENT_ID!, clientSecret: env.GOOGLE_CLIENT_SECRET!,
        allowDangerousEmailAccountLinking: false,
      })] : []),
      ...(enabled.has("naver") ? [NaverProvider({
        clientId: env.NAVER_CLIENT_ID!, clientSecret: env.NAVER_CLIENT_SECRET!,
        allowDangerousEmailAccountLinking: false,
      })] : []),
      ...(config.devLogin ? [CredentialsProvider({
        id: DEV_PROVIDER_ID,
        name: "개발용 로그인",
        credentials: { name: { label: "이름", type: "text" } },
        async authorize(credentials) {
          const name = String(credentials?.name ?? "").trim().slice(0, 40);
          return name ? { id: name, name, email: null, image: null } : null;
        },
      })] : []),
    ],
    pages: { signIn: "/login", error: "/login" },
    callbacks: {
      async signIn({ account }) {
        return Boolean(account && enabled.has(account.provider) && account.providerAccountId?.trim());
      },
      async jwt({ token, account, user, trigger }) {
        // Never merge the untrusted `session` supplied to useSession().update().
        if (trigger === "update") return token;
        if (account && user) {
          const id = providerUserId(account.provider, account.providerAccountId);
          return { sub: id, userId: id, name: user.name || "예배팀원", email: user.email ?? null, picture: user.image ?? null };
        }
        return token;
      },
      async session({ session, token }) {
        if (typeof token.userId !== "string" || !/^[a-f0-9]{64}$/.test(token.userId)) {
          return { ...session, user: undefined };
        }
        return {
          expires: session.expires,
          user: { id: token.userId, name: token.name || "예배팀원", email: token.email ?? null, image: token.picture ?? null },
        };
      },
      async redirect({ url, baseUrl }) {
        const origin = config.origin ?? new URL(baseUrl).origin;
        return `${origin}${safeLocalCallbackUrl(url, origin)}`;
      },
    },
    // OAuth error metadata can contain provider responses. Log codes only.
    logger: { error(code) { console.error(`[auth] ${code}`); }, warn(code) { console.warn(`[auth] ${code}`); }, debug() {} },
  };
}
