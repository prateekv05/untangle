"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Icon, Mark } from "@/components/icon";
import { currentTheme, setTheme } from "@/lib/theme";

function subscribeTheme(cb: () => void) {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}

export function LandingNav() {
  const dark = useSyncExternalStore(subscribeTheme, () => currentTheme() === "dark", () => false);
  const [stuck, setStuck] = useState(false);

  // Hairline under the sticky nav once the page has scrolled.
  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`nav${stuck ? " stuck" : ""}`}>
      <div className="wrap">
        <Link className="brand" href="/" aria-label="Untangle home"><Mark />Untangle</Link>
        <nav className="nav-links" aria-label="Sections">
          <a href="#how">How it works</a>
          <a href="#replan">Re-plan</a>
          <a href="#principles">How it thinks</a>
          <a href="#faq">Questions</a>
        </nav>
        <div className="nav-right">
          <button className="icon-btn" type="button" aria-label={dark ? "Switch to light theme" : "Switch to dark theme"} onClick={() => setTheme(dark ? "light" : "dark")}>
            <Icon name={dark ? "sun" : "moon"} />
          </button>
          <Link className="btn btn-primary" href="/welcome">Sign in</Link>
        </div>
      </div>
    </header>
  );
}
