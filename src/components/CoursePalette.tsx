"use client";

import { useDroppable } from "@dnd-kit/core";
import type { Course } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CourseCard } from "./CourseCard";

interface Props {
  title: string;
  subtitle: string;
  courses: Course[];
  droppableId: string;
  onEditPrereqs: (code: string) => void;
  accent: "sky" | "violet";
  totalCount: number;
}

const accentStyles = {
  sky: "before:bg-especifico-border",
  violet: "before:bg-especialidad-border",
} as const;

export function CoursePalette({
  title,
  subtitle,
  courses,
  droppableId,
  onEditPrereqs,
  accent,
  totalCount,
}: Props) {
  const { isOver, setNodeRef } = useDroppable({ id: droppableId });
  const placedCount = totalCount - courses.length;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative flex flex-col gap-2.5 overflow-hidden rounded-xl border border-border bg-card p-3 transition",
        "before:absolute before:inset-y-0 before:left-0 before:w-1",
        accentStyles[accent],
        isOver && "ring-2 ring-emerald-500/40 ring-offset-2 ring-offset-background",
      )}
    >
      <div className="flex items-start justify-between gap-2 pl-1">
        <div className="min-w-0">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-foreground">
            {title}
          </h2>
          <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
            {subtitle}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 font-mono text-[10px] tabular-nums text-accent-foreground">
          {placedCount}/{totalCount}
        </span>
      </div>
      <div className="flex max-h-[36vh] flex-col gap-1.5 overflow-y-auto pr-0.5">
        {courses.length === 0 ? (
          <p className="py-6 text-center text-[11px] italic text-muted-foreground">
            Todos colocados
          </p>
        ) : (
          courses.map((course) => (
            <CourseCard
              key={course.code}
              course={course}
              onEditPrereqs={accent === "violet" ? onEditPrereqs : undefined}
            />
          ))
        )}
      </div>
    </div>
  );
}
