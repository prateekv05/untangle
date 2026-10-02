import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkFirst, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Today's plan opens offline. Network first with a short wait: online it is always current (a stale-while-revalidate
// answer would show the plan from before the last edit on every reload), offline or on a bad connection it falls back to the last copy.
const dayRoute = {
  matcher: ({ sameOrigin, url: { pathname } }: { sameOrigin: boolean; url: URL }) => sameOrigin && (pathname === "/api/day" || pathname === "/api/settings" || pathname === "/api/presets"),
  method: "GET" as const,
  handler: new NetworkFirst({ cacheName: "untangle-day", networkTimeoutSeconds: 3 }),
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [dayRoute, ...defaultCache],
});

serwist.addEventListeners();
