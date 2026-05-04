import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Course, Placement } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
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
    if (!prereqCourse) {
      continue;
    }
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
  { bg: string; border: string; text: string; label: string }
> = {
  EEGG: {
    bg: "bg-amber-50",
    border: "border-amber-300",
    text: "text-amber-900",
    label: "EEGG",
  },
  ESPECIFICO: {
    bg: "bg-sky-50",
    border: "border-sky-300",
    text: "text-sky-900",
    label: "Especifico",
  },
  ESPECIALIDAD: {
    bg: "bg-violet-50",
    border: "border-violet-300",
    text: "text-violet-900",
    label: "Especialidad",
  },
};
