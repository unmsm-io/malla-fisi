"use client";

import { useDroppable } from "@dnd-kit/core";
import type { CycleAnalysis } from "@/lib/algorithms";
import type { Course } from "@/lib/types";
import { ROMAN, cn } from "@/lib/utils";
import { CourseCard } from "./CourseCard";

interface Props {
  cycle: number;
  courses: Course[];
  analysis: CycleAnalysis;
  hoveredCode: string | null;
  onHover: (code: string | null) => void;
  onEditPrereqs: (code: string) => void;
}

const statusStyles: Record<CycleAnalysis["status"], string> = {
  empty: "text-muted-foreground/50",
  low: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  ok: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  heavy: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  overload: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
};

export function CycleColumn({
  cycle,
  courses,
  analysis,
  hoveredCode,
  onHover,
  onEditPrereqs,
}: Props) {
  const { isOver, setNodeRef } = useDroppable({ id: `cycle-${cycle}` });
  const empty = courses.length === 0;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex h-full min-h-0 flex-col gap-1.5 rounded-lg border bg-card p-2 transition",
        isOver
          ? "border-emerald-500/60 bg-emerald-500/5 ring-2 ring-emerald-500/20"
          : "border-border",
        empty && !isOver && "border-dashed bg-muted/30",
      )}
    >
      <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
        <div className="flex items-baseline gap-1">
          <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
            C
          </span>
          <h3 className="font-mono text-xs font-bold tabular-nums">
            {ROMAN[cycle - 1]}
          </h3>
        </div>
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 font-mono text-[9px] tabular-nums transition",
            statusStyles[analysis.status],
          )}
        >
          {analysis.count}·{analysis.credits}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1 overflow-y-auto pr-0.5">
        {courses.map((course) => (
          <CourseCard
            key={course.code}
            course={course}
            placed
            onEditPrereqs={onEditPrereqs}
            onHover={onHover}
            highlighted={hoveredCode === course.code}
          />
        ))}
      </div>
    </div>
  );
}
