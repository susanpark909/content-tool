import type { MetadataRoute } from "next";

// Lets a phone treat Viral Heist like an app when it's added to the Home
// Screen: its own icon, full screen, opening straight on the Ideas page.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Viral Heist",
    short_name: "Viral Heist",
    description: "Content research and script-writing tool",
    start_url: "/idea",
    scope: "/",
    display: "standalone",
    background_color: "#0D0D0D",
    theme_color: "#0D0D0D",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
