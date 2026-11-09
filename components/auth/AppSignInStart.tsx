"use client";

import { useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { APP_COMPLETE_PATH } from "@/lib/nativeAuth";
import styles from "./AuthControls.module.css";

/**
 * 앱 셸 로그인(시스템 브라우저)에서 공급자 로그인을 시작합니다. NextAuth v4 는 CSRF 토큰과 POST 가 필요해서
 * 서버 리다이렉트 대신 이 화면이 signIn() 을 부릅니다. 끝나면 /auth/app-complete 가 앱으로 돌려보냅니다.
 */
export default function AppSignInStart({ provider, name, auto }: { provider: string; name: string; auto: boolean }) {
  const started = useRef(false);
  const [pending, setPending] = useState(auto);
  const [error, setError] = useState("");

  useEffect(() => {
    // 뒤로 가기로 이 화면에 돌아오면(bfcache) 다시 누를 수 있게 합니다.
    const restore = (event: PageTransitionEvent) => { if (event.persisted) setPending(false); };
    window.addEventListener("pageshow", restore);
    return () => window.removeEventListener("pageshow", restore);
  }, []);

  useEffect(() => {
    if (!auto || started.current) return;
    started.current = true;
    signIn(provider, { callbackUrl: APP_COMPLETE_PATH }).catch(() => {
      setPending(false);
      setError("로그인 화면을 열지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.");
    });
  }, [auto, provider]);

  function start() {
    setError("");
    setPending(true);
    signIn(provider, { callbackUrl: APP_COMPLETE_PATH }).catch(() => {
      setPending(false);
      setError("로그인 화면을 열지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.");
    });
  }

  return <div>
    <button type="button" className={`${styles.button} ${styles.provider}`} disabled={pending} aria-busy={pending} onClick={start}>
      {provider === "google" ? `${name} 계정으로 계속하기` : `${name}로 계속하기`}
    </button>
    <p className={styles.status} role="status" aria-live="polite">{pending ? `${name} 로그인 화면으로 이동합니다…` : ""}</p>
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
  </div>;
}
