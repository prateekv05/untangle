import type { Grouping } from "@/lib/flow";
import type { Task } from "@/lib/schemas";

/** Shows what belongs together: outside tasks joined by "+" and why they become one outing. */
export function RelationshipCard({ tasks, groupings = [] }: { tasks: Task[]; groupings?: Grouping[] }) {
  const outside = tasks.filter((t) => t.location === "outside");
  if (outside.length < 2) return null;
  // Use the model's own sentence while its group is intact; once the user edits the list, say it from what is left.
  const intact = groupings.find((g) => g.taskIds.length === outside.length && g.taskIds.every((id) => outside.some((t) => t.id === id)));
  const anchor = outside.find((t) => t.fixedStart);
  const name = anchor?.title.replace(/\s+(at|@)\s*\d.*$/i, "").toLowerCase();
  const why = intact
    ? intact.why
    : anchor
      ? `You're out for your ${name} anyway, so I'll chain the rest right after it.`
      : `All outside, so this becomes one outing instead of ${outside.length} trips.`;
  return (
    <section aria-label="What belongs together" className="mb-3.5 rounded-lg border-[1.5px] border-dashed border-outside bg-outside-tint p-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {outside.map((t, i) => (
          <span key={t.id} className="contents">
            {i > 0 && <span className="font-bold text-outside-ink" aria-hidden="true">+</span>}
            <span className="rounded-pill bg-surface px-3 py-1 text-sm font-semibold leading-5 text-ink">{t.title}</span>
          </span>
        ))}
      </div>
      <p className="voice m-0 mt-2 text-outside-ink">{why}</p>
    </section>
  );
}
