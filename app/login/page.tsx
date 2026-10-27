import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { getAuthConfiguration } from "@/lib/authConfig";
import { safeLocalCallbackUrl } from "@/lib/authRedirect";
import LoginButtons from "@/components/auth/LoginButtons";
import DevLoginForm from "@/components/auth/DevLoginForm";
import SignOutButton from "@/components/auth/SignOutButton";
import LogoMark from "@/components/brand/LogoMark";
import styles from "./login.module.css";

export const metadata: Metadata = { title: "로그인", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const errors: Record<string, string> = {
  Configuration: "로그인 연결 설정이 아직 완료되지 않았습니다. 연결 준비가 끝나면 로그인할 수 있습니다.",
  OAuthCancelled: "로그인을 취소했습니다. 초대 링크는 유지되어 있으니 준비되면 다시 로그인해 주세요.",
  AccessDenied: "로그인 권한이 허용되지 않았습니다. 계정과 동의 항목을 확인하고 다시 시도해 주세요.",
  OAuthSignin: "로그인 제공자에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  OAuthCallback: "로그인을 완료하지 못했습니다. 취소했거나 로그인 요청이 만료되었을 수 있습니다. 다시 시도해 주세요.",
  OAuthAccountNotLinked: "이 계정으로 로그인할 수 없습니다. 이전에 사용한 로그인 방법으로 다시 시도해 주세요.",
  SessionRequired: "팀에 참여하려면 먼저 로그인해 주세요.",
};

function first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [params, cookieStore, user] = await Promise.all([searchParams, cookies(), getCurrentUser()]);
  const config = getAuthConfiguration();
  const error = first(params.error);
  const savedCallback = error ? (cookieStore.get("__Secure-next-auth.callback-url")?.value ?? cookieStore.get("next-auth.callback-url")?.value) : undefined;
  const candidate = first(params.callbackUrl) ?? first(params.next) ?? savedCallback;
  let callbackUrl = safeLocalCallbackUrl(candidate, config.origin ?? undefined);
  if (/^\/login(?:[/?#]|$)/.test(callbackUrl)) callbackUrl = "/dashboard";
  const invited = callbackUrl.startsWith("/invite/");
  const available = config.providers.some((provider) => provider.enabled);
  const errorText = error ? errors[error] ?? "로그인 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요." : null;

  return <main className={styles.page}>
    <section className={styles.card} aria-labelledby="login-heading">
      <p className={styles.brand}><LogoMark bold className={styles.brandMark} />Worship Together</p>
      <h1 id="login-heading" className={styles.heading}>{user ? "함께할 준비가 됐어요" : invited ? "초대받은 팀과 함께해요" : "함께 예배를 준비해요"}</h1>
      <p className={styles.description}>{user ? `${user.name}님, 로그인되어 있습니다.` : invited ? "로그인하면 초대받은 팀의 참여 화면으로 이어집니다." : "익숙한 계정으로 로그인하고, 팀원들과 콘티와 악보를 함께 준비하세요."}</p>
      {!user && errorText ? <p role="alert" className={`${styles.notice} ${error !== "OAuthCancelled" ? styles.error : ""}`}>{errorText}</p> : null}
      {!user && first(params.signedOut) === "1" ? <p role="status" className={styles.notice}>로그아웃했습니다.</p> : null}
      {user ? <>
        <Link className={styles.primary} href={callbackUrl}>{invited ? "초대받은 팀 확인하기" : "계속하기"}</Link>
        <div className={styles.footer}><SignOutButton /></div>
      </> : <>
        {!available && !config.devLogin && !errorText ? <p className={styles.notice}>계정 로그인 연결을 준비하고 있습니다. 지금은 로그인 없이 프로토타입을 둘러볼 수 있어요.</p> : null}
        <LoginButtons providers={config.providers} callbackUrl={callbackUrl} />
        {config.devLogin ? <DevLoginForm callbackUrl={callbackUrl} /> : null}
        <div className={styles.footer}>
          <p>팀에서 사용하던 로그인 방법을 선택해 주세요. Google과 네이버는 각각 별도 계정으로 사용됩니다.</p>
          <Link className={styles.link} href="/dashboard">로그인 없이 둘러보기 →</Link>
        </div>
      </>}
    </section>
  </main>;
}
