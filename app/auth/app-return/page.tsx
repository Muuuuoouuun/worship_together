import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { getAuthConfiguration } from "@/lib/authConfig";
import { androidIntentUrl, appReturnUrl, isLoginToken } from "@/lib/nativeAuth";
import LogoMark from "@/components/brand/LogoMark";
import styles from "@/app/login/login.module.css";

export const metadata: Metadata = { title: "앱에서 열어 주세요", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

/**
 * 앱 링크(/auth/app-return?code=…)가 앱 대신 브라우저에서 열렸을 때 보이는 화면.
 * 여기서는 코드를 절대 교환하지 않습니다 — 교환에는 앱(WebView)만 가진 verifier 가 필요합니다.
 * "앱으로 돌아가기"는 같은 앱 링크입니다. Android Chrome 은 같은 사이트 안의 링크를 앱으로 넘기지 않을 수 있어
 * 패키지를 지정한 intent: 링크를 씁니다.
 */
export default async function AppReturnPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [params, headerList] = await Promise.all([searchParams, headers()]);
  const raw = Array.isArray(params.code) ? params.code[0] : params.code;
  const code = isLoginToken(raw) ? raw : null;
  const { origin } = getAuthConfiguration();
  const appLink = code && origin ? appReturnUrl(origin, code) : null;
  const android = /android/i.test(headerList.get("user-agent") ?? "");
  const href = appLink ? (android ? androidIntentUrl(appLink) ?? appLink : appLink) : null;

  return <main className={styles.page}>
    <section className={styles.card} aria-labelledby="app-return-heading">
      <p className={styles.brand}><LogoMark bold className={styles.brandMark} />Worship Together</p>
      <h1 id="app-return-heading" className={styles.heading}>앱에서 열어 주세요</h1>
      <p className={styles.description}>
        {href ? "로그인을 마쳤어요. 아래 버튼을 눌러 Worship Together 앱으로 돌아가면 로그인이 이어집니다. 1분 안에 눌러 주세요."
          : "이 링크는 Worship Together 앱에서만 열 수 있어요. 앱에서 다시 로그인해 주세요."}
      </p>
      {/* 다른 문서로 보낼 때 이 주소(코드)가 Referer 로 새지 않게 rel=noreferrer 와 referrer 메타를 둡니다. */}
      {href ? <a className={styles.primary} href={href} rel="noreferrer">앱으로 돌아가기</a> : null}
      <div className={styles.footer}>
        <p>앱이 설치되어 있지 않거나 열리지 않으면 웹에서 로그인할 수 있어요.</p>
        <Link className={styles.link} href="/login" rel="noreferrer">웹에서 로그인하기 →</Link>
      </div>
    </section>
  </main>;
}
