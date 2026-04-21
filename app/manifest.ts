import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Worship Together",
    short_name: "Worship",
    description: "Worship, prayer, serving, and group connection tools for church communities.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#F7F5EF",
    theme_color: "#153E3B",
    orientation: "portrait",
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
