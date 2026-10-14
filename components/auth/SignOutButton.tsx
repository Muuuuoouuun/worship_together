"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import styles from "./AuthControls.module.css";

export default function SignOutButton() {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  async function logout() {
    setPending(true);
    setFailed(false);
    try { await signOut({ callbackUrl: "/login?signedOut=1" }); }
    catch { setFailed(true); setPending(false); }
  }
  return <>
    <button type="button" className={styles.loginLink} disabled={pending} onClick={() => void logout()}>{pending ? "로그아웃 중…" : "로그아웃"}</button>
    {failed ? <p className={styles.error} role="alert">로그아웃하지 못했습니다. 다시 시도해 주세요.</p> : null}
  </>;
}
