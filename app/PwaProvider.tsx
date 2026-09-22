"use client";

import { useEffect } from "react";
import PwaInstallPrompt from "@/components/ui/PwaInstallPrompt";

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

