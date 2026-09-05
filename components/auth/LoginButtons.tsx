"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import type { AuthProviderId } from "@/lib/authConfig";
import googleLogo from "./assets/google-logo.png";
import naverLogin from "./assets/naver-login.png";
import styles from "./AuthControls.module.css";

export default function LoginButtons({ providers, callbackUrl }: {
  providers: { id: AuthProviderId; name: string; enabled: boolean }[];
  callbackUrl: string;
}) {
  const [pending, setPending] = useState<AuthProviderId | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const restore = () => setPending(null);
    window.addEventListener("pageshow", restore);
    return () => window.removeEventListener("pageshow", restore);
  }, []);

  async function login(provider: AuthProviderId) {
    setError("");
    setPending(provider);
    try {
      await signIn(provider, { callbackUrl });
    } catch {
      setError("로그인 화면을 열지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.");
    } finally {
      setPending(null);
    }
  }

  return <div>
    <div className={styles.providers}>
      {providers.map((provider) => <div key={provider.id}>
        <button type="button" className={`${styles.button} ${styles.provider} ${provider.id === "google" ? styles.google : styles.naver}`}
          disabled={!provider.enabled || pending !== null} aria-busy={pending === provider.id}
          aria-describedby={!provider.enabled ? `${provider.id}-availability` : undefined}
          aria-label={provider.id === "google" ? "Google 계정으로 로그인" : "네이버 로그인"}
          onClick={() => void login(provider.id)}>
          {provider.id === "google" ? <><Image src={googleLogo} alt="" width={20} height={20} style={{ width: 20, height: 20, flexShrink: 0 }} />Google 계정으로 로그인</> :
            <Image src={naverLogin} alt="네이버 로그인" priority />}
        </button>
        {!provider.enabled ? <p id={`${provider.id}-availability`} className={styles.hint}>{provider.name} 로그인 연결 준비 중</p> : null}
      </div>)}
    </div>
    <p className={styles.status} role="status" aria-live="polite">{pending ? `${pending === "google" ? "Google" : "네이버"} 로그인 화면으로 이동합니다…` : ""}</p>
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
  </div>;
}
