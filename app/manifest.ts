import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Worship Together",
    short_name: "Worship",
    description: "팀별 콘티, 세션 준비, 라이브 큐, 악보 알림, 말씀 묵상을 함께 다루는 예배 운영 앱.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#F7F5EF",
    theme_color: "#153E3B",
    orientation: "any",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
