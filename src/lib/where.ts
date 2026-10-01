import type { Task } from "./schemas";

export type Where = Task["location"];

/** Colour means where. Full class names so Tailwind can see them. */
export const WHERE: Record<Where, { label: string; dot: string; tag: string; tint: string; ink: string; thread: string }> = {
  outside: { label: "Outside", dot: "bg-outside", tag: "bg-outside-tint text-outside-ink", tint: "bg-outside-tint", ink: "text-outside-ink", thread: "var(--thread-outside)" },
  work: { label: "Work", dot: "bg-work", tag: "bg-work-tint text-work-ink", tint: "bg-work-tint", ink: "text-work-ink", thread: "var(--thread-work)" },
  home: { label: "Home", dot: "bg-home", tag: "bg-home-tint text-home-ink", tint: "bg-home-tint", ink: "text-home-ink", thread: "var(--thread-home)" },
  anywhere: { label: "Anywhere", dot: "bg-anywhere", tag: "bg-anywhere-tint text-anywhere-ink", tint: "bg-anywhere-tint", ink: "text-anywhere-ink", thread: "var(--thread-anywhere)" },
};
export const WHERE_ORDER: Where[] = ["outside", "work", "home", "anywhere"];
