"use client";

import { useDroppable } from "@dnd-kit/core";
import type { CycleAnalysis } from "@/lib/algorithms";
import type { Course } from "@/lib/types";
import { ROMAN, cn } from "@/lib/utils";
import { CardHighlight, CourseCard } from "./CourseCard";

interface Props {
  cycle: number;
  courses: Course[];
  analysis: CycleAnalysis;
  cumulativeCredits: number;
  highlightFor: (code: string) => CardHighlight;
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
  cumulativeCredits,
  highlightFor,
  onHover,
  onEditPrereqs,
}: Props) {
  const { isOver, setNodeRef } = useDroppable({ id: `cycle-${cycle}` });
  const empty = courses.length === 0;
  const theoryHours = sum(courses, "ht");
  const practiceHours = sum(courses, "hp");
  const labHours = sum(courses, "hl");
  const totalHours = sum(courses, "th");

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
            Ciclo
          </span>
          <h3 className="font-mono text-xs font-bold tabular-nums">
            {ROMAN[cycle - 1]}
          </h3>
        </div>
        <div className="flex items-center gap-1">
          <span className="rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-medium text-accent-foreground">
            {analysis.count} curso{analysis.count !== 1 ? "s" : ""}
          </span>
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[9px] font-semibold tabular-nums transition",
              statusStyles[analysis.status],
            )}
          >
            {analysis.credits} credito{analysis.credits !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
      <div className="rounded-md border border-border/60 bg-background/35 p-1.5">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[8px] font-semibold uppercase tracking-wider text-muted-foreground">
            Horas del ciclo
          </span>
          <span className="rounded bg-foreground px-1.5 py-0.5 font-mono text-[9px] font-bold text-background tabular-nums">
            {totalHours}h total
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1">
          <Metric label="Teoria" value={theoryHours} />
          <Metric label="Practica" value={practiceHours} />
          <Metric label="Laboratorio" value={labHours} />
        </div>
        <div className="mt-1 flex items-center justify-between rounded bg-muted/50 px-1.5 py-1">
          <span className="text-[8px] font-medium uppercase tracking-wider text-muted-foreground">
            Acumulado
          </span>
          <span className="font-mono text-[10px] font-semibold tabular-nums text-foreground">
            {cumulativeCredits} creditos
          </span>
        </div>
      </div>
      <div className="-mx-1 flex flex-1 flex-col gap-1.5 overflow-y-auto px-1 py-1 pr-1.5">
        {courses.map((course) => (
          <CourseCard
            key={course.code}
            course={course}
            placed
            onEditPrereqs={onEditPrereqs}
            onHover={onHover}
            highlight={highlightFor(course.code)}
          />
        ))}
      </div>
    </div>
  );
}

function sum(courses: Course[], key: "ht" | "hp" | "hl" | "th") {
  return courses.reduce((total, course) => total + course[key], 0);
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-border/50 bg-card/60 px-1.5 py-1">
      <div className="truncate text-[8px] font-medium text-muted-foreground">
        {label}
      </div>
      <div className="font-mono text-[10px] font-semibold tabular-nums text-foreground">
        {value}h
      </div>
    </div>
  );
}
