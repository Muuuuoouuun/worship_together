"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";

/** 계정 메뉴 <details>. 공통 틀은 화면을 옮겨도 남아 있으므로 주소가 바뀌면 닫습니다. */
export default function AccountDetails({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();
  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [pathname]);
  return <details ref={ref} className={className}>{children}</details>;
}
