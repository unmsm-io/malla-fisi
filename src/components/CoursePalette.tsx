"use client";

import { useDroppable } from "@dnd-kit/core";
import type { Course } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CardHighlight, CourseCard } from "./CourseCard";

interface Props {
  title: string;
  courses: Course[];
  droppableId: string;
  onEditCourse: (code: string) => void;
  onHover: (code: string | null) => void;
  highlightFor: (code: string) => CardHighlight;
  accent: "orange" | "green" | "blue";
  totalCount: number;
}

const accentStyles = {
  orange: "before:bg-eegg-border",
  green: "before:bg-especifico-border",
  blue: "before:bg-especialidad-border",
} as const;

export function CoursePalette({
  title,
  courses,
  droppableId,
  onEditCourse,
  onHover,
  highlightFor,
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
      <div className="-mx-1 flex flex-1 flex-col gap-1.5 overflow-y-auto px-1 py-1 pr-1.5">
        {courses.length === 0 ? (
          <p className="py-3 text-center text-[10px] italic text-muted-foreground">
            Todos colocados
          </p>
        ) : (
          courses.map((course) => (
            <CourseCard
              key={course.code}
              course={course}
              onEditPrereqs={onEditCourse}
              onHover={onHover}
              highlight={highlightFor(course.code)}
            />
          ))
        )}
      </div>
    </div>
  );
}
