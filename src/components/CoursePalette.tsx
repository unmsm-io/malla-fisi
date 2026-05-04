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
}

const accentClasses = {
  sky: "border-sky-300 bg-sky-50/50",
  violet: "border-violet-300 bg-violet-50/50",
} as const;

export function CoursePalette({
  title,
  subtitle,
  courses,
  droppableId,
  onEditPrereqs,
  accent,
}: Props) {
  const { isOver, setNodeRef } = useDroppable({ id: droppableId });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col gap-2 rounded-lg border-2 p-3 transition",
        accentClasses[accent],
        isOver && "ring-2 ring-emerald-400",
      )}
    >
      <div>
        <h2 className="text-sm font-bold uppercase tracking-tight">{title}</h2>
        <p className="text-[11px] text-slate-600">{subtitle}</p>
      </div>
      <div className="flex max-h-[40vh] flex-col gap-1.5 overflow-y-auto pr-1">
        {courses.length === 0 ? (
          <p className="py-4 text-center text-[11px] italic text-slate-400">
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
