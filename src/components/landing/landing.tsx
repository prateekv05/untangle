import Link from "next/link";
import { Icon, Mark } from "@/components/icon";
import { OnboardingVideo } from "@/components/onboarding-video";
import { FactPill, TimeChip, WhereTag } from "@/components/where-tag";
import { HeroPhone } from "./hero-phone";
import { LandingNav } from "./landing-nav";
import { ReplanDemo } from "./replan-demo";
import "./landing.css";

const FAQ: { q: string; voice?: string; a: string }[] = [
  { q: "Do you keep my voice recordings?", voice: "Your voice is turned into text and then discarded.", a: "Only the text of that day's list is kept, and recordings are capped at two minutes." },
  { q: "Does it connect to my calendar?", a: "Not yet, and on purpose. Tell it about fixed things in the same sentence, like \"meeting at 2\", and the day is planned around them." },
  { q: "What if it guesses a duration wrong?", a: "Every estimate is marked until you set it. Tap it, change the time, and only the unfinished part of the day is re-planned." },
  { q: "What happens to things I don't get to?", a: "Move them to tomorrow, a weekday or a date you pick. They show up as carried over when you start that day." },
  { q: "Which phones does it work on?", a: "Any modern phone browser. Add it to your home screen and it opens like an app, and today's plan is available offline." },
];

/** The signed-out page at "/". Static apart from the nav, the hero phone and the re-plan demo. */
export function Landing() {
  return (
    <div className="lp">
      <a className="skip" href="#main">Skip to content</a>
      <LandingNav />

      <main id="main">
        <section className="hero">
          <div className="wrap">
            <div>
              <div className="eyebrow" aria-hidden="true">
                <WhereTag where="outside" /><WhereTag where="work" /><WhereTag where="home" /><WhereTag where="anywhere" />
              </div>
              <h1><span className="muted">A messy list in.</span> A realistic day out.</h1>
              <p className="lede">Say everything on your mind, in any order. Untangle works out what belongs together and plans a day you can actually do, with a reason for every block.</p>
              <div className="cta-row">
                <Link className="btn btn-primary" href="/welcome">Get started</Link>
                <a className="btn-quiet" href="#how">See how it works</a>
              </div>
              <p className="cta-note">Continue with Google. Installs on your phone like an app.</p>
            </div>
            <HeroPhone />
          </div>
        </section>

        <section className="band surface" aria-labelledby="prob-h">
          <div className="wrap">
            <p className="kicker">Why another way to plan</p>
            <h2 id="prob-h">Your day doesn&apos;t start as a list. It starts as a tangle.</h2>
            <div className="two">
              <div className="prob"><span className="n">Most tools</span><h3>Ask for structure first.</h3>
                <p>Categorise, tag, estimate and slot everything before you get anything back. Untangle asks for nothing except what&apos;s on your mind.</p></div>
              <div className="prob"><span className="n">Most plans</span><h3>Break when the day does.</h3>
                <p>A plan made at 08:00 is wrong by 11:00. Instead of dragging blocks around, say what happened and the rest of the day rebuilds.</p></div>
            </div>
          </div>
        </section>

        <section className="band" id="how" aria-labelledby="how-h">
          <div className="wrap">
            <p className="kicker">How it works</p>
            <h2 id="how-h">From a messy list to a realistic day in about 30 seconds.</h2>
            <div className="steps">
              <article className="step">
                <OnboardingVideo scene="dump" lazy />
                <span className="num" aria-hidden="true">1</span>
                <h3>Say everything on your mind, in any order.</h3>
                <p className="say">Talk or type. I pull out each task while you&apos;re still talking.</p>
              </article>
              <article className="step">
                <OnboardingVideo scene="understand" lazy />
                <span className="num" aria-hidden="true">2</span>
                <h3>Untangle figures out what belongs together.</h3>
                <p className="say">Three errands near each other become one outing, not three trips.</p>
              </article>
              <article className="step">
                <OnboardingVideo scene="replan" lazy />
                <span className="num" aria-hidden="true">3</span>
                <h3>When the day changes, just say so.</h3>
                <p className="say">I rebuild the rest of your day. Finished things stay put.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="band surface" id="replan" aria-labelledby="rp-h">
          <div className="wrap demo-grid">
            <ReplanDemo />
          </div>
        </section>

        <section className="band" id="principles" aria-labelledby="pr-h">
          <div className="wrap">
            <p className="kicker">How it thinks</p>
            <h2 id="pr-h">A planner that explains itself.</h2>
            <div className="grid3">
              <div className="card"><h3>Every block has a reason.</h3>
                <p>One plain sentence for every choice. No reason, no block.</p>
                <div className="ex"><div className="reason">You&apos;re already out at the gym, so this goes on the way back home.</div></div></div>
              <div className="card"><h3>It asks, it doesn&apos;t guess.</h3>
                <p>At most three questions, one tap each, and only when the answer changes your plan. Anything estimated stays marked until you set it.</p>
                <div className="ex"><FactPill ask>I guessed 1 h 30 min</FactPill><TimeChip state="set">45 min</TimeChip></div></div>
              <div className="card"><h3>Errands become one outing.</h3>
                <p>Things outside the house are bundled into a single trip, in an order that makes sense.</p>
                <div className="ex"><span className="tag-out">Groceries</span><span className="tag-out">Prescription</span><span className="tag-out">Return package</span></div></div>
              <div className="card"><h3>Focus work gets your best hours.</h3>
                <p>Fixed times and deadlines go first. Deep work lands in your freshest window, quick things fill the gaps.</p>
                <div className="ex"><TimeChip state="set">Fixed at 14:00</TimeChip><TimeChip state="set">Due tomorrow</TimeChip></div></div>
              <div className="card"><h3>Finished things stay put.</h3>
                <p>A re-plan only touches what&apos;s left, from now on. Moved tasks show where they were.</p>
                <div className="ex"><FactPill>was 09:00</FactPill><FactPill>was 12:30</FactPill></div></div>
              <div className="card"><h3>Calm by design.</h3>
                <p>No streaks, scores, badges or nagging. A day is made from what you say, and it lives for that day.</p></div>
            </div>
          </div>
        </section>

        <section className="band surface" aria-labelledby="col-h">
          <div className="wrap">
            <p className="kicker">One rule</p>
            <h2 id="col-h">Colour means where.</h2>
            <p className="sub">Every colour in Untangle tells you where something happens. Nothing else uses them, so you can read your day at a glance.</p>
            <div className="legend">
              <div className="li"><span><WhereTag where="outside" /></span><span>Errands, appointments, the gym</span></div>
              <div className="li"><span><WhereTag where="work" /></span><span>Inside your working hours</span></div>
              <div className="li"><span><WhereTag where="home" /></span><span>Chores and things at home</span></div>
              <div className="li"><span><WhereTag where="anywhere" /></span><span>Calls, emails, quick things</span></div>
              <div className="li"><span><span className="tag-ask">Ask</span></span><span>Untangle needs a quick answer</span></div>
            </div>
          </div>
        </section>

        <section className="band" aria-labelledby="film-h">
          <div className="wrap">
            <p className="kicker">Watch</p>
            <h2 id="film-h">The whole idea in 30 seconds.</h2>
            <div className="film">
              <video controls playsInline preload="none" poster="/videos/untangle-teaser-poster.jpg" aria-label="Untangle product film">
                <source src="/videos/untangle-teaser-16x9.mp4" type="video/mp4" />
              </video>
            </div>
          </div>
        </section>

        <section className="band surface" aria-labelledby="not-h">
          <div className="wrap">
            <p className="kicker">On purpose</p>
            <h2 id="not-h">Not another task manager.</h2>
            <p className="sub">Untangle doesn&apos;t want your system. It wants what&apos;s on your mind today.</p>
            <div className="nots" aria-label="Things Untangle leaves out">
              {["Lists", "Projects", "Tags", "Subtasks", "Recurring tasks", "Calendar grids", "Streaks", "Integrations"].map((n) => <span key={n}>{n}</span>)}
            </div>
          </div>
        </section>

        <section className="band" id="faq" aria-labelledby="faq-h">
          <div className="wrap">
            <p className="kicker">Questions</p>
            <h2 id="faq-h">Good to know.</h2>
            <div className="faq">
              {FAQ.map((f) => (
                <details key={f.q}>
                  <summary>{f.q}<Icon name="chevron" /></summary>
                  <div className="a">{f.voice && <p className="voice">{f.voice}</p>}<p>{f.a}</p></div>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="final band surface" aria-labelledby="end-h">
          <div className="wrap">
            <Mark size={72} />
            <h2 id="end-h">Say it messy. Get a day that works.</h2>
            <p className="say">Tell me what&apos;s on your mind and I&apos;ll take it from there.</p>
            <div className="cta-row"><Link className="btn btn-primary" href="/welcome">Get started</Link></div>
          </div>
        </section>
      </main>

      <footer>
        <div className="wrap">
          <Link className="brand" href="/"><Mark size={20} />Untangle</Link>
          <span>A messy list in. A realistic day out.</span>
          <nav aria-label="Footer"><Link href="/welcome">Sign in</Link></nav>
        </div>
      </footer>
    </div>
  );
}
