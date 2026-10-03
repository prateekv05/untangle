"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/lib/use-reduced-motion";

type Scene = "dump" | "understand" | "replan";

const THEMES = ["light", "dark"] as const;

/**
 * `lazy` is for long pages: nothing downloads until the clip scrolls near, and it plays only while visible.
 * The onboarding steps leave it off and autoplay straight away.
 */
export function OnboardingVideo({ scene, lazy }: { scene: Scene; lazy?: boolean }) {
  const reduced = useReducedMotion();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!lazy || reduced || !el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        e.target.querySelectorAll("video").forEach((v) => {
          if (e.isIntersecting && getComputedStyle(v).display !== "none") v.play().catch(() => {});
          else v.pause();
        });
      }
    }, { threshold: 0.4 });
    io.observe(el);
    // A theme switch swaps which clip is showing: observe again so the visible one starts.
    const mo = new MutationObserver(() => { io.unobserve(el); io.observe(el); });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => { io.disconnect(); mo.disconnect(); };
  }, [lazy, reduced]);

  const src = (theme: (typeof THEMES)[number]) => `/videos/onboarding/onboarding-${scene}-${theme}`;

  return (
    <div ref={box} aria-hidden="true" className="onboarding-video" style={{ aspectRatio: "342 / 270" }}>
      {THEMES.map((theme) =>
        reduced ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={theme} className={`ob-${theme}`} src={`${src(theme)}-poster.png`} alt="" loading={lazy ? "lazy" : undefined} />
        ) : (
          <video key={theme} className={`ob-${theme}`} autoPlay={!lazy} muted loop playsInline preload={lazy ? "none" : "auto"} poster={`${src(theme)}-poster.png`}>
            <source src={`${src(theme)}.webm`} type="video/webm" />
            <source src={`${src(theme)}.mp4`} type="video/mp4" />
          </video>
        ),
      )}
    </div>
  );
}
