"use client";

import type { ReactNode } from "react";
import { exampleTasks } from "@/fixtures/example";
import { initialState, outingSummary, reducer } from "@/lib/flow";
import { deriveQuestions, tasksFromText } from "@/lib/guess";
import { groupBlocks } from "@/components/screens/plan-screen";
import { AddTaskCard } from "@/components/add-task-card";
import { Button } from "@/components/button";
import { Chip } from "@/components/chip";
import { Decisions } from "@/components/decisions";
import { Outing } from "@/components/outing";
import { QuestionCard } from "@/components/question-card";
import { RelationshipCard } from "@/components/relationship-card";
import { SegmentedControl } from "@/components/segmented-control";
import { Sheet, SheetOption } from "@/components/sheet";
import { TaskBlock } from "@/components/task-block";
import { NowMarker, ThreadHop, ThreadMarker, ThreadRow } from "@/components/thread";
import { Toast } from "@/components/toast";
import { UnderstandRow } from "@/components/understand-row";
import { Waveform } from "@/components/waveform";
import { FactPill, TimeChip, WhereTag } from "@/components/where-tag";
import { WHERE_ORDER } from "@/lib/where";
import { toMin } from "@/lib/time";

const noop = () => {};

function fixture() {
  let s = reducer(initialState(), { type: "understood", tasks: exampleTasks(), questions: [], mode: "workday" });
  s = reducer(s, { type: "build", now: toMin("08:30") });
  const plan = s.plan!;
  const task = (id: string) => s.tasks.find((t) => t.id === id)!;
  const block = (id: string) => plan.blocks.find((b) => b.taskId === id)!;
  return { s, plan, task, block };
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-7">
      <h3 className="m-0 mb-2.5 text-sm font-semibold text-ink-muted">{title}</h3>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}
const Row = ({ children }: { children: ReactNode }) => <div className="flex flex-wrap items-center gap-2">{children}</div>;

function Panel({ theme }: { theme: "light" | "dark" }) {
  const { s, plan, task, block } = fixture();
  const outing = groupBlocks(plan.blocks).find((i) => i.kind === "outing");
  const questions = deriveQuestions(tasksFromText("SQL assignment, gym"));
  return (
    <div data-theme={theme} className="w-[390px] max-w-full shrink-0 bg-ground p-5 text-ink" data-testid={`gallery-${theme}`}>
      <h2 className="mb-5 mt-0 text-2xl font-bold tracking-tight">{theme} theme</h2>

      <Section title="Button">
        <Button>Untangle my day</Button>
        <Button disabled>Untangle my day</Button>
        <Button variant="secondary">Secondary</Button>
        <Row><Button variant="quiet">Edit my list</Button><Button variant="danger">Delete task</Button><Button variant="pill" className="!w-auto">Bring back</Button></Row>
      </Section>
      <Section title="Chip">
        <Row><Chip>Call</Chip><Chip selected>1 h</Chip><Chip small>Buy</Chip><Chip dashed>+ Yours</Chip></Row>
      </Section>
      <Section title="WhereTag, time chip, fact pills">
        <Row>{WHERE_ORDER.map((w) => <WhereTag key={w} where={w} />)}</Row>
        <Row><WhereTag where="anywhere" chevron onClick={noop} /><TimeChip state="auto" chevron onClick={noop}>Auto (~40 min)</TimeChip><TimeChip state="ask" chevron onClick={noop}>How long? (~1 h)</TimeChip><TimeChip state="set" chevron onClick={noop}>45 min</TimeChip></Row>
        <Row><FactPill>Fixed at 17:00</FactPill><FactPill>Due tomorrow</FactPill><FactPill>was 09:00</FactPill><FactPill ask>I guessed 1 h</FactPill></Row>
      </Section>
      <Section title="SegmentedControl, Waveform">
        <SegmentedControl label={`Day type ${theme}`} value="workday" onChange={noop} options={[{ value: "workday", label: "Workday" }, { value: "dayoff", label: "Day off" }]} />
        <Waveform active={false} />
      </Section>
      <Section title="Decisions">
        <Decisions headline="I made 3 decisions for you" lines={plan.decisions.slice(0, 3)} note={plan.note} />
        <Decisions headline="2 of 7 done" lines={plan.decisions.slice(0, 2)} />
      </Section>
      <Section title="TaskBlock: default, expanded, finished, was pill">
        <div>
          <ThreadRow time={block("sql").start} where="anywhere" first index={0}><TaskBlock task={task("sql")} block={block("sql")} onExpand={noop} /></ThreadRow>
          <ThreadRow time={block("app").start} where="anywhere" index={1}><TaskBlock task={task("app")} block={block("app")} expanded onExpand={noop} onToggleDone={noop} onEdit={noop} onMove={noop} /></ThreadRow>
          <ThreadRow time={block("res").start} where="anywhere" index={2}><TaskBlock task={task("res")} block={block("res")} done onExpand={noop} was="09:00" /></ThreadRow>
          <ThreadMarker label="Work starts 09:00" />
          <NowMarker time="11:45" />
          <ThreadRow time="17:00" where="outside" last index={3}><TaskBlock task={{ ...task("gym"), title: "Dentist at 5pm", fixedStart: "17:00", durationSource: "user", kind: "fixed" }} block={{ ...block("gym"), start: "17:00" }} /></ThreadRow>
        </div>
      </Section>
      <Section title="Outing">
        {outing?.kind === "outing" && (
          <Outing summary={outingSummary(outing.blocks)}>
            {outing.blocks.map((b, i) => (
              <div key={b.taskId}>
                {i > 0 && b.hop && <ThreadHop text={b.hop} />}
                <ThreadRow time={b.start} where="outside" taut ring="outing" first={i === 0} last={i === outing.blocks.length - 1}><TaskBlock task={task(b.taskId)} block={b} /></ThreadRow>
              </div>
            ))}
          </Outing>
        )}
      </Section>
      <Section title="QuestionCard, RelationshipCard">
        <QuestionCard questions={[...questions, { type: "time", taskId: "x", prompt: 'What time is "Dentist"?' }]} onAnswer={noop} />
        <RelationshipCard tasks={s.tasks} />
      </Section>
      <Section title="Understand row, add task">
        <ul className="m-0 flex flex-col gap-2 p-0"><UnderstandRow task={task("gym")} onRemove={noop} onWhere={noop} onDuration={noop} /></ul>
        <AddTaskCard presets={[]} onAdd={noop} />
      </Section>
      <Section title="Sheet and Toast">
        <div className="overflow-hidden rounded-lg border border-line bg-ground pt-5">
          <Sheet preview title="Move to a later day" voice="Gym leaves today's plan. You can bring it back." onClose={noop}>
            <SheetOption onClick={noop}>Tomorrow</SheetOption><SheetOption onClick={noop} selected>Monday</SheetOption>
          </Sheet>
        </div>
        <Toast preview id={1} text="Gym moved to Tomorrow" undo ms={0} onUndo={noop} onDone={noop} />
      </Section>
    </div>
  );
}

export function Gallery() {
  return (
    <main className="flex flex-wrap gap-6 bg-surface-soft p-4">
      <h1 className="sr-only">Component gallery</h1>
      <Panel theme="light" />
      <Panel theme="dark" />
    </main>
  );
}
