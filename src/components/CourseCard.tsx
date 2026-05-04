"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil } from "lucide-react";
import type { Course } from "@/lib/types";
import { CATEGORY_STYLES, cn } from "@/lib/utils";

interface Props {
  course: Course;
  placed?: boolean;
  highlighted?: boolean;
  onEditPrereqs?: (code: string) => void;
  onHover?: (code: string | null) => void;
}

export function CourseCard({
  course,
  placed,
  highlighted,
  onEditPrereqs,
  onHover,
}: Props) {
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
      data-course-code={course.code}
      onMouseEnter={() => onHover?.(course.code)}
      onMouseLeave={() => onHover?.(null)}
      {...listeners}
      {...attributes}
      style={transformStyle}
      className={cn(
        "group relative cursor-grab select-none rounded-md border px-2 py-1.5 text-[11px] leading-tight shadow-sm transition active:cursor-grabbing",
        "hover:-translate-y-px hover:shadow-md",
        style.bg,
        style.border,
        style.text,
        isDragging && "opacity-30",
        highlighted && "ring-2 ring-violet-500 ring-offset-1 ring-offset-background",
      )}
    >
      <div className="flex items-start gap-1">
        <GripVertical
          size={10}
          className="mt-0.5 shrink-0 opacity-30 transition group-hover:opacity-60"
        />
        <div className="min-w-0 flex-1">
          <div className="font-semibold tracking-tight">{course.name}</div>
          <div className="mt-0.5 flex items-center gap-1 text-[9px] opacity-70">
            <span className="font-mono tabular-nums">{course.code}</span>
            <span className="opacity-40">·</span>
            <span className="font-medium">{course.cred}cr</span>
            {course.prereqs.length > 0 && (
              <>
                <span className="opacity-40">·</span>
                <span>{course.prereqs.length}p</span>
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
          className="absolute right-0.5 top-0.5 hidden h-4 w-4 items-center justify-center rounded bg-card/90 text-foreground/70 shadow-sm hover:bg-card hover:text-foreground group-hover:flex"
        >
          <Pencil size={9} />
        </button>
      )}
    </div>
  );
}
