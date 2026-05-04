"use client";

import { useDroppable } from "@dnd-kit/core";
import type { Course } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CourseCard } from "./CourseCard";

interface Props {
  title: string;
  courses: Course[];
  droppableId: string;
  onEditPrereqs: (code: string) => void;
  onHover: (code: string | null) => void;
  hoveredCode: string | null;
  accent: "sky" | "violet";
  totalCount: number;
}

const accentStyles = {
  sky: "before:bg-especifico-border",
  violet: "before:bg-especialidad-border",
} as const;

export function CoursePalette({
  title,
  courses,
  droppableId,
  onEditPrereqs,
  onHover,
  hoveredCode,
  accent,
  totalCount,
}: Props) {
  const { isOver, setNodeRef } = useDroppable({ id: droppableId });
  const placedCount = totalCount - courses.length;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card p-2.5 transition",
        "before:absolute before:inset-y-0 before:left-0 before:w-1",
        accentStyles[accent],
        isOver && "ring-2 ring-emerald-500/40",
      )}
    >
      <div className="flex items-center justify-between gap-2 pb-2 pl-1">
        <h2 className="text-[10px] font-bold uppercase tracking-wider text-foreground">
          {title}
        </h2>
        <span className="rounded-full bg-accent px-1.5 py-0.5 font-mono text-[9px] tabular-nums text-accent-foreground">
          {placedCount}/{totalCount}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1 overflow-y-auto pr-0.5">
        {courses.length === 0 ? (
          <p className="py-3 text-center text-[10px] italic text-muted-foreground">
            Todos colocados
          </p>
        ) : (
          courses.map((course) => (
            <CourseCard
              key={course.code}
              course={course}
              onEditPrereqs={accent === "violet" ? onEditPrereqs : undefined}
              onHover={onHover}
              highlighted={hoveredCode === course.code}
            />
          ))
        )}
      </div>
    </div>
  );
}
