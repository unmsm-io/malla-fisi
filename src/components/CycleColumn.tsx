"use client";

import { useDroppable } from "@dnd-kit/core";
import type { Course } from "@/lib/types";
import { ROMAN, cn } from "@/lib/utils";
import { CourseCard } from "./CourseCard";

interface Props {
  cycle: number;
  courses: Course[];
  onEditPrereqs: (code: string) => void;
}

export function CycleColumn({ cycle, courses, onEditPrereqs }: Props) {
  const { isOver, setNodeRef } = useDroppable({ id: `cycle-${cycle}` });
  const credits = courses.reduce((sum, c) => sum + c.cred, 0);
  const empty = courses.length === 0;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-[480px] flex-col gap-2 rounded-xl border bg-card p-2.5 transition",
        isOver
          ? "border-emerald-500/50 bg-emerald-500/5 ring-2 ring-emerald-500/20"
          : "border-border",
        empty && !isOver && "border-dashed bg-muted/30",
      )}
    >
      <div className="flex items-center justify-between border-b border-border/60 pb-2">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Ciclo
          </span>
          <h3 className="font-mono text-sm font-bold tabular-nums">
            {ROMAN[cycle - 1]}
          </h3>
        </div>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 font-mono text-[10px] tabular-nums transition",
            empty
              ? "bg-transparent text-muted-foreground/50"
              : "bg-accent text-accent-foreground",
          )}
        >
          {courses.length} · {credits}cr
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        {courses.map((course) => (
          <CourseCard
            key={course.code}
            course={course}
            placed
            onEditPrereqs={onEditPrereqs}
          />
        ))}
      </div>
    </div>
  );
}
