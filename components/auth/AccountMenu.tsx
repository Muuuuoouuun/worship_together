import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import SignOutButton from "./SignOutButton";
import AccountDetails from "./AccountDetails";
import styles from "./AuthControls.module.css";

/** Server component: render in a server layout, or pass as a slot to a client layout. */
export default async function AccountMenu() {
  const user = await getCurrentUser();
  if (!user) return <Link href="/login" className={styles.loginLink}>로그인</Link>;
  return <AccountDetails className={styles.account}>
    <summary aria-label={`${user.name} 계정 메뉴`}>
      <span className={styles.avatar} aria-hidden="true">{Array.from(user.name)[0]}</span>
      <span className={styles.name}>{user.name}</span><span aria-hidden="true">⌄</span>
    </summary>
    <div className={styles.panel}>
      <p><strong>{user.name}</strong></p>
      {user.email ? <p>{user.email}</p> : null}
      <Link href="/dashboard/team">팀 · 초대 관리</Link>
      <SignOutButton />
    </div>
  </AccountDetails>;
}
