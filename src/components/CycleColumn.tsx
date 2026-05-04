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

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-[400px] flex-col gap-2 rounded-lg border-2 bg-white p-3 transition",
        isOver ? "border-emerald-400 bg-emerald-50/40" : "border-slate-200",
      )}
    >
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <h3 className="text-sm font-bold tracking-tight">CICLO {ROMAN[cycle - 1]}</h3>
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-600">
          {courses.length} | {credits}cr
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        {courses.map((course) => (
          <CourseCard key={course.code} course={course} placed onEditPrereqs={onEditPrereqs} />
        ))}
      </div>
    </div>
  );
}
