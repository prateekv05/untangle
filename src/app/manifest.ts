import type { MetadataRoute } from "next";

// Manifest colours must be literals (they cannot read CSS variables). They match --ground in design/tokens.css.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Untangle",
    short_name: "Untangle",
    description: "Turns a messy list into a realistic day.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f2f3f7",
    theme_color: "#f2f3f7",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
