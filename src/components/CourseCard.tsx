"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil } from "lucide-react";
import type { Course } from "@/lib/types";
import { CATEGORY_STYLES, cn } from "@/lib/utils";

export type CardHighlight = "none" | "self" | "ancestor" | "descendant";

interface Props {
  course: Course;
  placed?: boolean;
  highlight?: CardHighlight;
  onEditPrereqs?: (code: string) => void;
  onHover?: (code: string | null) => void;
}

const highlightStyles: Record<CardHighlight, string> = {
  none: "",
  self: "ring-2 ring-violet-500 ring-offset-2 ring-offset-background z-10",
  ancestor: "ring-2 ring-sky-500 ring-offset-1 ring-offset-background z-10",
  descendant: "ring-2 ring-emerald-500 ring-offset-1 ring-offset-background z-10",
};

export function CourseCard({
  course,
  placed,
  highlight = "none",
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
        highlightStyles[highlight],
      )}
    >
      <div className="flex items-start gap-1">
        <GripVertical
          size={10}
          className="mt-0.5 shrink-0 opacity-30 transition group-hover:opacity-60"
        />
        <div className="min-w-0 flex-1">
          <div className="font-semibold tracking-tight">{course.name}</div>
          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[9px] opacity-75">
            <span className="font-mono tabular-nums">{course.code}</span>
            <span className="opacity-40">·</span>
            <span className="font-medium">
              {course.cred} credito{course.cred !== 1 ? "s" : ""}
            </span>
            {course.prereqs.length > 0 && (
              <>
                <span className="opacity-40">·</span>
                <span>
                  {course.prereqs.length} prerreq
                  {course.prereqs.length !== 1 ? "s" : ""}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
      {onEditPrereqs && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEditPrereqs(course.code);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label="Editar curso"
          className="absolute right-0.5 top-0.5 hidden h-4 w-4 items-center justify-center rounded bg-card/90 text-foreground/70 shadow-sm hover:bg-card hover:text-foreground group-hover:flex"
        >
          <Pencil size={9} />
        </button>
      )}
    </div>
  );
}
