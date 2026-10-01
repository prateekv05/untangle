import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

// e2e runs its own dev server beside yours: a separate build folder keeps the two from clashing.
const nextConfig: NextConfig = { distDir: process.env.NEXT_DIST_DIR || ".next" };

export default withSerwist(nextConfig);
