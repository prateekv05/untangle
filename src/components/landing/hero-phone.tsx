"use client";

import { useEffect, useRef, useState } from "react";
import { FactPill, WhereTag } from "@/components/where-tag";
import { Icon, Mark } from "@/components/icon";
import { useReducedMotion } from "@/lib/use-reduced-motion";

/** The Plan screen drawn small. Decorative: the wrapper carries the description. The entrance plays once, when it scrolls into view. */
export function HeroPhone() {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  const play = reduced || seen;

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;
    const io = new IntersectionObserver((es) => { if (es[0].isIntersecting) { setSeen(true); io.disconnect(); } }, { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, [reduced]);

  return (
    <div className="phone" role="img" aria-label="Untangle's plan screen. Finish SQL at 09:00 in your freshest hours, then three errands bundled into one outing at 12:30, then Laundry at 15:00 and Call Mom at 17:30.">
      <div ref={ref} className={`screen${play ? " play" : ""}`} aria-hidden="true">
        <div className="p-top"><Mark size={22} />Untangle<Icon name="settings" className="set" /></div>
        <div className="p-head"><div className="p-date">Monday, October 5</div><div className="p-meta">Workday. Planned at 08:30.</div></div>
        <div className="thread">
          <span className="spine" />
          <div className="row" data-i style={{ "--i": 0 } as React.CSSProperties}>
            <div className="time">09:00</div><div className="rail"><span className="node work" /></div>
            <div className="tcard"><div className="t1"><span>Finish SQL assignment</span><i className="chk" /></div>
              <div className="m"><WhereTag where="work" />about 1 h 30 min</div>
              <div className="reason">Your freshest hours, so the hardest thing goes first.</div></div>
          </div>
          <div className="row" data-i style={{ "--i": 1 } as React.CSSProperties}>
            <div className="time">10:45</div><div className="rail"><span className="node anywhere" /></div>
            <div className="tcard"><div className="t1"><span>Send resume to Sarah</span><i className="chk" /></div>
              <div className="m"><WhereTag where="anywhere" />15 min</div></div>
          </div>
          <div className="outing" style={{ "--i": 2, "--last": 5 } as React.CSSProperties}>
            <span className="taut" />
            <div className="o-head"><b>One outing</b><span>3 stops</span></div>
            <div className="row" data-i style={{ "--i": 3 } as React.CSSProperties}>
              <div className="time">12:30</div><div className="rail"><span className="node outside" /></div>
              <div className="tcard"><div className="t1"><span>Groceries</span><i className="chk" /></div>
                <div className="m"><WhereTag where="outside" />40 min</div></div>
            </div>
            <div className="hop" data-i style={{ "--i": 4 } as React.CSSProperties}>next door, so no extra trip</div>
            <div className="row" data-i style={{ "--i": 4 } as React.CSSProperties}>
              <div className="time">13:15</div><div className="rail"><span className="node outside" /></div>
              <div className="tcard"><div className="t1"><span>Pick up prescription</span><i className="chk" /></div>
                <div className="m"><WhereTag where="outside" />15 min</div></div>
            </div>
            <div className="row" data-i style={{ "--i": 5 } as React.CSSProperties}>
              <div className="time">13:35</div><div className="rail"><span className="node outside" /></div>
              <div className="tcard"><div className="t1"><span>Return package</span><i className="chk" /></div>
                <div className="m"><WhereTag where="outside" />10 min</div></div>
            </div>
          </div>
          <div className="row" data-i style={{ "--i": 6 } as React.CSSProperties}>
            <div className="time">15:00</div><div className="rail"><span className="node home" /></div>
            <div className="tcard"><div className="t1"><span>Laundry</span><i className="chk" /></div>
              <div className="m"><WhereTag where="home" /><FactPill ask>I guessed 1 h</FactPill></div></div>
          </div>
        </div>
        <div className="p-bar">
          <div className="voice">Plans change. Tell me what happened.</div>
          <div className="btns"><span className="mic"><Icon name="mic" size={22} /></span><span className="go"><Icon name="refresh" size={22} />Re-plan my day</span></div>
        </div>
      </div>
    </div>
  );
}
