"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { DEV_PROVIDER_ID } from "@/lib/authIds";
import styles from "./AuthControls.module.css";

/** 개발 환경 전용: 이름만으로 서로 다른 사람으로 로그인해 팀 참여 · 권한 · 예배 세션을 여러 기기처럼 시험합니다. */
export default function DevLoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  return <form className={styles.devForm} onSubmit={(event) => {
    event.preventDefault();
    if (!name.trim()) return;
    setPending(true);
    void signIn(DEV_PROVIDER_ID, { name: name.trim(), callbackUrl }).finally(() => setPending(false));
  }}>
    <label className={styles.devLabel} htmlFor="dev-login-name">개발용 로그인 · 이름이 같으면 같은 사람</label>
    <div className={styles.devRow}>
      <input id="dev-login-name" name="name" value={name} onChange={(event) => setName(event.target.value)} maxLength={40} placeholder="예: 김찬양" className={styles.devInput} autoComplete="off" />
      <button type="submit" className={`${styles.button} ${styles.devButton}`} disabled={pending || !name.trim()}>로그인</button>
    </div>
  </form>;
}
