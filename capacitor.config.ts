import type { CapacitorConfig } from "@capacitor/cli";

const serverUrl = process.env.CAPACITOR_SERVER_URL;
// 에뮬레이터 · 개발용 http 서버일 때만 평문 통신과 혼합 콘텐츠를 허용합니다. https 서버는 둘 다 막습니다.
const insecureServer = serverUrl?.startsWith("http://") ?? false;

const config: CapacitorConfig = {
  appId: "com.worshiptogether.app",
  appName: "Worship Together",
  webDir: "mobile-www",
  backgroundColor: "#FFFFFF",
  server: serverUrl
    ? {
        url: serverUrl,
        cleartext: insecureServer,
      }
    : undefined,
  android: {
    allowMixedContent: insecureServer,
    captureInput: true,
    webContentsDebuggingEnabled: process.env.NODE_ENV !== "production",
  },
};

export default config;
