"use client";

import { X } from "lucide-react";
import { useEffect, useMemo } from "react";
import { autoOrganize } from "@/lib/algorithms";
import type { Course, CoursesData } from "@/lib/types";
import { CATEGORY_STYLES, ROMAN, cn, normalizeName } from "@/lib/utils";

interface Props {
  data: CoursesData;
  onClose: () => void;
}

const CYCLES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

interface MallaSnapshot {
  slug: string;
  label: string;
  courses: Course[];
  placement: Record<string, number>;
}

function buildSnapshot(slug: string, data: CoursesData): MallaSnapshot {
  const career = data.careers[slug];
  const courses = [...career.specifics, ...career.specialty];
  return {
    slug,
    label: career.label,
    courses,
    placement: autoOrganize(courses),
  };
}

export function CompareView({ data, onClose }: Props) {
  const careerSlugs = Object.keys(data.careers);
  const left = useMemo(() => buildSnapshot(careerSlugs[0], data), [data, careerSlugs]);
  const right = useMemo(
    () => buildSnapshot(careerSlugs[1] ?? careerSlugs[0], data),
    [data, careerSlugs],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const sharedNames = useMemo(() => {
    const leftNames = new Set(left.courses.map((c) => normalizeName(c.name)));
    return new Set(
      right.courses
        .filter((c) => leftNames.has(normalizeName(c.name)))
        .map((c) => normalizeName(c.name)),
    );
  }, [left, right]);

  function getCourseInCycle(snap: MallaSnapshot, cycle: number) {
    return snap.courses
      .filter((c) => snap.placement[c.code] === cycle)
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }

  function divergence(snap: MallaSnapshot, course: Course): number | null {
    const otherSnap = snap === left ? right : left;
    const match = otherSnap.courses.find(
      (c) => normalizeName(c.name) === normalizeName(course.name),
    );
    if (!match) return null;
    const otherCycle = otherSnap.placement[match.code];
    if (otherCycle === undefined) return null;
    const myCycle = snap.placement[course.code];
    if (myCycle === undefined) return null;
    const diff = myCycle - otherCycle;
    return diff;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-md"
      onClick={onClose}
    >
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <div>
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Comparar carreras (auto-organizado)
          </span>
          <h2 className="text-sm font-bold tracking-tight">
            {left.label} <span className="text-muted-foreground">vs</span> {right.label}
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <Legend />
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Cerrar"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      <div
        className="grid flex-1 grid-cols-2 gap-2 overflow-hidden p-3"
        onClick={(e) => e.stopPropagation()}
      >
        {[left, right].map((snap) => (
          <section key={snap.slug} className="flex min-h-0 flex-col">
            <h3 className="mb-2 truncate text-xs font-semibold">{snap.label}</h3>
            <div className="grid flex-1 grid-cols-5 gap-1.5 overflow-y-auto">
              {CYCLES.map((cycle) => {
                const inCycle = getCourseInCycle(snap, cycle);
                const credits = inCycle.reduce((s, c) => s + c.cred, 0);
                return (
                  <div
                    key={cycle}
                    className="flex min-h-0 flex-col gap-1 rounded-md border border-border bg-card p-1.5"
                  >
                    <div className="flex items-baseline justify-between border-b border-border/50 pb-1">
                      <span className="font-mono text-[10px] font-bold tabular-nums">
                        {ROMAN[cycle - 1]}
                      </span>
                      <span className="font-mono text-[9px] tabular-nums text-muted-foreground">
                        {credits}cr
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 overflow-y-auto">
                      {inCycle.map((course) => {
                        const isShared = sharedNames.has(normalizeName(course.name));
                        const diff = isShared ? divergence(snap, course) : null;
                        const style = CATEGORY_STYLES[course.category];
                        return (
                          <div
                            key={course.code}
                            className={cn(
                              "rounded border px-1.5 py-1 text-[9px] leading-tight",
                              style.bg,
                              style.border,
                              style.text,
                              diff !== null && diff !== 0 && "ring-1 ring-amber-500/60",
                            )}
                          >
                            <div className="font-semibold">{course.name}</div>
                            {diff !== null && diff !== 0 && (
                              <div className="mt-0.5 text-[8px] text-amber-700 dark:text-amber-400">
                                {diff > 0 ? `+${diff}` : diff} ciclos vs otra
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="hidden items-center gap-3 text-[10px] text-muted-foreground md:flex">
      <span className="flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-amber-500" />
        Diferente ciclo
      </span>
    </div>
  );
}
