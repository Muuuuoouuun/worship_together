import type { Metadata } from "next";
import { cookies } from "next/headers";
import { DEV_PROVIDER_ID, getAuthConfiguration } from "@/lib/authConfig";
import { APP_COMPLETE_PATH, handoffCookieName, verifyHandoff } from "@/lib/nativeAuth";
import AppSignInStart from "@/components/auth/AppSignInStart";
import DevLoginForm from "@/components/auth/DevLoginForm";
import LogoMark from "@/components/brand/LogoMark";
import styles from "@/app/login/login.module.css";

export const metadata: Metadata = { title: "앱 로그인", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

const errors: Record<string, string> = {
  Configuration: "이 로그인 방법은 아직 연결 준비 중입니다. 이 창을 닫고 앱에서 다른 방법을 선택해 주세요.",
  InvalidRequest: "로그인 요청을 확인하지 못했어요. 이 창을 닫고 앱에서 다시 로그인해 주세요.",
  Expired: "로그인 요청이 만료되었어요. 이 창을 닫고 앱에서 다시 로그인해 주세요.",
  SessionRequired: "로그인을 마치지 못했어요. 아래 버튼으로 다시 시도하거나, 이 창을 닫고 앱에서 다시 로그인해 주세요.",
  Unavailable: "로그인을 마무리하지 못했어요. 잠시 후 아래 버튼으로 다시 시도해 주세요.",
};
/** 이 오류 뒤에는 같은 창에서 다시 시도할 수 있습니다(핸드오프 쿠키가 남아 있음). */
const retryable = new Set(["SessionRequired", "Unavailable"]);

function first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }

/**
 * 앱 셸 로그인 2단계 (시스템 브라우저). /auth/app-start 가 남긴 핸드오프 쿠키가 있을 때만 그 공급자 로그인을 시작합니다.
 * 이미 이 브라우저에 로그인돼 있어도 앱에서 고른 공급자로 다시 로그인합니다(다른 계정으로 앱에 들어가지 않게).
 */
export default async function AppSignInPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [params, cookieStore] = await Promise.all([searchParams, cookies()]);
  const config = getAuthConfiguration();
  const secure = (config.origin ?? "").startsWith("https://");
  const record = config.ready ? await verifyHandoff(cookieStore.get(handoffCookieName(secure))?.value, process.env.NEXTAUTH_SECRET ?? "") : null;
  const error = first(params.error);
  const provider = record ? (record.provider === DEV_PROVIDER_ID ? (config.devLogin ? { id: DEV_PROVIDER_ID, name: "개발용 로그인" } : null)
    : config.providers.find((item) => item.id === record.provider && item.enabled) ?? null) : null;
  const message = error ? errors[error] ?? errors.InvalidRequest : !record ? errors.Expired : !provider ? errors.Configuration : null;

  return <main className={styles.page}>
    <section className={styles.card} aria-labelledby="app-signin-heading">
      <p className={styles.brand}><LogoMark bold className={styles.brandMark} />Worship Together</p>
      <h1 id="app-signin-heading" className={styles.heading}>앱 로그인</h1>
      <p className={styles.description}>로그인을 마치면 Worship Together 앱으로 돌아갑니다. 이 브라우저에는 로그인이 남지 않습니다.</p>
      {message ? <p role="alert" className={`${styles.notice} ${styles.error}`}>{message}</p> : null}
      {record && provider && (!error || retryable.has(error)) ? (
        provider.id === DEV_PROVIDER_ID
          ? <DevLoginForm callbackUrl={APP_COMPLETE_PATH} />
          : <AppSignInStart provider={provider.id} name={provider.name} auto={!error} />
      ) : null}
    </section>
  </main>;
}
