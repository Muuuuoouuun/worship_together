"use client";

import { useEffect } from "react";
import PwaInstallPrompt from "@/components/ui/PwaInstallPrompt";
import { syncOfflineCacheOwner } from "@/lib/offlineCache";

export default function PwaProvider() {
  useEffect(() => {
    const shouldRegister =
      process.env.NODE_ENV === "production" ||
      process.env.NEXT_PUBLIC_ENABLE_SERVICE_WORKER === "true";

    if (!shouldRegister || !("serviceWorker" in navigator)) {
      return;
    }

    const registerServiceWorker = () => {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.warn("Service worker registration failed:", error);
      });
      // 서비스 워커가 보관한 화면은 로그인한 사람의 팀 자료를 담습니다. 세션이 끝났거나 다른 사람이면 지웁니다.
      // (오프라인이면 확인할 수 없으니 건너뜁니다. 그때 보이는 보관본은 마지막으로 확인된 같은 사람의 것입니다.)
      if (navigator.onLine) {
        fetch("/api/auth/session", { cache: "no-store", credentials: "same-origin" })
          .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
          .then((session: { user?: { id?: unknown } } | null) =>
            syncOfflineCacheOwner(typeof session?.user?.id === "string" ? session.user.id : null))
          .catch(() => { /* 확인하지 못하면 다음 방문 때 다시 */ });
      }
    };

    if (document.readyState === "complete") {
      registerServiceWorker();
    } else {
      window.addEventListener("load", registerServiceWorker, { once: true });
    }

    return () => {
      window.removeEventListener("load", registerServiceWorker);
    };
  }, []);

  return <PwaInstallPrompt />;
}

