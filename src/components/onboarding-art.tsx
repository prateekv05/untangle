import { cn } from "@/lib/cn";
import { WHERE, type Where } from "@/lib/where";

function Chip({ where, children }: { where: Where; children: string }) {
  return <span className={cn("inline-flex min-h-6 items-center rounded-pill px-2.5 text-xs font-semibold leading-4", WHERE[where].tag)}>{children}</span>;
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div aria-hidden="true" className={cn("mb-7 overflow-hidden rounded-lg border border-line bg-surface p-5", className)}>{children}</div>;
}

export function DumpArt() {
  return (
    <Card className="h-[250px]">
      <p className="m-0 text-lg leading-7">gym, call Mom, groceries, send resume to Sarah, work on my app</p>
      <div className="mt-[18px] flex flex-wrap gap-2">
        <Chip where="outside">Gym</Chip>
        <Chip where="anywhere">Call Mom</Chip>
        <Chip where="outside">Groceries</Chip>
        <Chip where="work">Send resume</Chip>
        <Chip where="work">My app</Chip>
      </div>
    </Card>
  );
}

const DOT = { work: "bg-work", outside: "bg-outside", home: "bg-home" } as const;

function Row({ top, time, text, where }: { top: number; time: string; text: string; where: keyof typeof DOT }) {
  return (
    <>
      <span className={cn("absolute left-3 size-3.5 rounded-full", DOT[where])} style={{ top: top + 4 }} />
      <div className="absolute left-11 right-0 flex items-baseline gap-3" style={{ top }}>
        <span className="text-sm font-semibold tabular-nums leading-[22px] text-ink-muted">{time}</span>
        <span className="text-[15px] font-semibold leading-[22px]">{text}</span>
      </div>
    </>
  );
}

export function PlanArt() {
  return (
    <Card className="h-[270px]">
      <div className="relative h-[226px]">
        <span className="absolute inset-y-1.5 left-[18px] w-[3px] rounded-[2px] bg-line" />
        <span className="absolute left-[18px] top-16 h-[54px] w-[3px] rounded-[2px] bg-outside" />
        <Row top={0} time="09:00" text="Work on my app" where="work" />
        <Row top={54} time="12:30" text="Gym" where="outside" />
        <Row top={108} time="14:00" text="Groceries" where="outside" />
        <p className="absolute left-11 right-0 top-[134px] m-0 font-serif text-[15px] leading-[22px] text-ink-muted">You&apos;re already out, so this goes on the way back.</p>
        <Row top={200} time="17:30" text="Call Mom" where="home" />
      </div>
    </Card>
  );
}

export function ReplanArt() {
  return (
    <Card className="h-[250px]">
      <div className="mb-3.5 flex justify-center"><span className="h-1 w-10 rounded-[2px] bg-line" /></div>
      <p className="m-0 mb-2.5 text-base font-semibold leading-[22px]">Running behind?</p>
      <div className="rounded-md bg-surface-soft px-4 py-3.5 text-base leading-6">I only have 3 hours left</div>
      <p className="mb-0 mt-3.5 font-serif text-[15px] leading-[22px] text-ink-muted">Gym and the call stay. Groceries move to tomorrow.</p>
    </Card>
  );
}
