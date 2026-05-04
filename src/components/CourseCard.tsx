"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil } from "lucide-react";
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
        "group relative cursor-grab select-none rounded-lg border px-2.5 py-2 text-xs shadow-sm transition active:cursor-grabbing",
        "hover:-translate-y-px hover:shadow-md",
        style.bg,
        style.border,
        style.text,
        isDragging && "opacity-30",
      )}
    >
      <div className="flex items-start gap-1.5">
        <GripVertical
          size={11}
          className="mt-0.5 shrink-0 opacity-30 transition group-hover:opacity-60"
        />
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-semibold leading-snug tracking-tight">
            {course.name}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[10px] opacity-70">
            <span className="font-mono tabular-nums">{course.code}</span>
            <span className="opacity-40">·</span>
            <span className="font-medium">{course.cred}cr</span>
            {course.prereqs.length > 0 && (
              <>
                <span className="opacity-40">·</span>
                <span>{course.prereqs.length} pre</span>
              </>
            )}
          </div>
        </div>
      </div>
      {onEditPrereqs && course.category === "ESPECIALIDAD" && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEditPrereqs(course.code);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label="Editar prerrequisitos"
          className="absolute right-1 top-1 hidden h-5 w-5 items-center justify-center rounded bg-card/90 text-foreground/70 shadow-sm hover:bg-card hover:text-foreground group-hover:flex"
        >
          <Pencil size={10} />
        </button>
      )}
    </div>
  );
}
