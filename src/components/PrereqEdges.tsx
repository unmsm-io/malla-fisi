"use client";

import { useEffect, useRef, useState } from "react";
import type { Course, Placement } from "@/lib/types";
import { findCourseByName } from "@/lib/utils";

interface Edge {
  fromCode: string;
  toCode: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  highlighted: boolean;
}

interface Props {
  courses: Course[];
  placement: Placement;
  highlightedEdgeCodes: Set<string>;
  containerRef: React.RefObject<HTMLElement | null>;
}

export function PrereqEdges({
  courses,
  placement,
  highlightedEdgeCodes,
  containerRef,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    function compute() {
      const container = containerRef.current;
      if (!container) return;
      const containerRect = container.getBoundingClientRect();
      setSize({ w: container.scrollWidth, h: container.scrollHeight });

      const next: Edge[] = [];
      for (const course of courses) {
        if (placement[course.code] === undefined) continue;
        const targetEl = container.querySelector(
          `[data-course-code="${course.code}"]`,
        );
        if (!targetEl) continue;
        const targetRect = (targetEl as HTMLElement).getBoundingClientRect();

        for (const prereqName of course.prereqs) {
          const prereq = findCourseByName(prereqName, courses);
          if (!prereq) continue;
          if (placement[prereq.code] === undefined) continue;
          const sourceEl = container.querySelector(
            `[data-course-code="${prereq.code}"]`,
          );
          if (!sourceEl) continue;
          const sourceRect = (sourceEl as HTMLElement).getBoundingClientRect();

          const isHighlighted =
            highlightedEdgeCodes.has(course.code) &&
            highlightedEdgeCodes.has(prereq.code);

          next.push({
            fromCode: prereq.code,
            toCode: course.code,
            from: {
              x: sourceRect.right - containerRect.left + container.scrollLeft,
              y:
                sourceRect.top + sourceRect.height / 2 - containerRect.top + container.scrollTop,
            },
            to: {
              x: targetRect.left - containerRect.left + container.scrollLeft - 4,
              y:
                targetRect.top + targetRect.height / 2 - containerRect.top + container.scrollTop,
            },
            highlighted: isHighlighted,
          });
        }
      }
      next.sort((a, b) => Number(a.highlighted) - Number(b.highlighted));
      setEdges(next);
    }

    compute();
    const observer = new ResizeObserver(compute);
    if (containerRef.current) observer.observe(containerRef.current);
    window.addEventListener("resize", compute);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", compute);
    };
  }, [courses, placement, highlightedEdgeCodes, containerRef]);

  if (edges.length === 0) return null;

  return (
    <svg
      ref={svgRef}
      className="pointer-events-none absolute inset-0"
      width={size.w}
      height={size.h}
      style={{ zIndex: 1 }}
    >
      <defs>
        <marker
          id="arrowhead"
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="3"
          orient="auto"
        >
          <polygon points="0 0, 6 3, 0 6" fill="currentColor" />
        </marker>
        <marker
          id="arrowhead-active"
          markerWidth="7"
          markerHeight="7"
          refX="6"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 7 3.5, 0 7" fill="oklch(0.65 0.18 270)" />
        </marker>
      </defs>
      {edges.map((edge) => {
        const dx = edge.to.x - edge.from.x;
        const cx1 = edge.from.x + Math.max(dx * 0.5, 30);
        const cx2 = edge.to.x - Math.max(dx * 0.5, 30);
        const path = `M ${edge.from.x} ${edge.from.y} C ${cx1} ${edge.from.y}, ${cx2} ${edge.to.y}, ${edge.to.x} ${edge.to.y}`;
        return (
          <path
            key={`${edge.fromCode}->${edge.toCode}`}
            d={path}
            fill="none"
            stroke={edge.highlighted ? "oklch(0.65 0.18 270)" : "currentColor"}
            strokeWidth={edge.highlighted ? 2 : 1}
            opacity={edge.highlighted ? 1 : 0.15}
            markerEnd={
              edge.highlighted ? "url(#arrowhead-active)" : "url(#arrowhead)"
            }
            className="text-foreground transition-opacity"
          />
        );
      })}
    </svg>
  );
}
