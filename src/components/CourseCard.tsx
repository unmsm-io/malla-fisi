"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { Course } from "@/lib/types";
import { CATEGORY_STYLES, cn } from "@/lib/utils";

interface Props {
  course: Course;
  placed?: boolean;
  onEditPrereqs?: (code: string) => void;
}

export function CourseCard({ course, placed, onEditPrereqs }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: course.code,
    data: { course },
  });
  const style = CATEGORY_STYLES[course.category];

  const transformStyle = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={transformStyle}
      className={cn(
        "group relative cursor-grab active:cursor-grabbing select-none rounded-md border-2 px-3 py-2 text-xs shadow-sm transition",
        style.bg,
        style.border,
        style.text,
        isDragging && "opacity-30",
        placed && "ring-2 ring-emerald-400",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="font-semibold leading-tight">{course.name}</div>
        <div className="shrink-0 rounded bg-white/60 px-1.5 py-0.5 text-[10px] font-mono">
          {course.cred}cr
        </div>
      </div>
      <div className="mt-1 flex items-center justify-between text-[10px] opacity-70">
        <span className="font-mono">{course.code}</span>
        <span>{style.label}</span>
      </div>
      {course.prereqs.length > 0 && (
        <div className="mt-1 text-[10px] italic opacity-70 leading-tight">
          Pre: {course.prereqs.join(", ")}
        </div>
      )}
      {onEditPrereqs && course.category === "ESPECIALIDAD" && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEditPrereqs(course.code);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute right-1 top-1 hidden rounded bg-white/80 px-1.5 py-0.5 text-[9px] font-medium text-violet-800 shadow group-hover:block hover:bg-white"
        >
          editar pre
        </button>
      )}
    </div>
  );
}
