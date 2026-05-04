import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Course, Placement } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function findCourseByName(name: string, all: Course[]): Course | null {
  const target = normalizeName(name);
  return all.find((c) => normalizeName(c.name) === target) ?? null;
}

export interface ValidationResult {
  ok: boolean;
  missing: { prereqName: string; reason: "not-placed" | "same-or-later-cycle" }[];
}

export function validatePlacement(
  course: Course,
  targetCycle: number,
  placement: Placement,
  allCourses: Course[],
): ValidationResult {
  const missing: ValidationResult["missing"] = [];
  for (const prereqName of course.prereqs) {
    const prereqCourse = findCourseByName(prereqName, allCourses);
    if (!prereqCourse) continue;
    const prereqCycle = placement[prereqCourse.code];
    if (prereqCycle === undefined) {
      missing.push({ prereqName: prereqCourse.name, reason: "not-placed" });
    } else if (prereqCycle >= targetCycle) {
      missing.push({ prereqName: prereqCourse.name, reason: "same-or-later-cycle" });
    }
  }
  return { ok: missing.length === 0, missing };
}

export const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

export const CATEGORY_STYLES: Record<
  Course["category"],
  { bg: string; border: string; text: string; ring: string; label: string }
> = {
  EEGG: {
    bg: "bg-eegg-bg",
    border: "border-eegg-border",
    text: "text-eegg-fg",
    ring: "ring-eegg-border",
    label: "EEGG",
  },
  ESPECIFICO: {
    bg: "bg-especifico-bg",
    border: "border-especifico-border",
    text: "text-especifico-fg",
    ring: "ring-especifico-border",
    label: "Especifico",
  },
  ESPECIALIDAD: {
    bg: "bg-especialidad-bg",
    border: "border-especialidad-border",
    text: "text-especialidad-fg",
    ring: "ring-especialidad-border",
    label: "Especialidad",
  },
};
