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

export const EEGG_MAX_CYCLE = 2;

export interface ValidationResult {
  ok: boolean;
  missing: { prereqName: string; reason: "not-placed" | "same-or-later-cycle" }[];
  conflicts: { dependentName: string; dependentCycle: number }[];
  categoryViolation?: { reason: string };
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

  const conflicts: ValidationResult["conflicts"] = [];
  for (const other of allCourses) {
    if (other.code === course.code) continue;
    const otherCycle = placement[other.code];
    if (otherCycle === undefined) continue;
    const dependsOnCourse = other.prereqs.some((p) => {
      const found = findCourseByName(p, allCourses);
      return found?.code === course.code;
    });
    if (dependsOnCourse && otherCycle <= targetCycle) {
      conflicts.push({ dependentName: other.name, dependentCycle: otherCycle });
    }
  }

  let categoryViolation: ValidationResult["categoryViolation"];
  if (course.category === "EEGG" && targetCycle > EEGG_MAX_CYCLE) {
    categoryViolation = {
      reason: `Cursos EEGG solo pueden ir en ciclos I-${ROMAN[EEGG_MAX_CYCLE - 1]} (requisito para entrar a facultad)`,
    };
  }

  return {
    ok:
      missing.length === 0 &&
      conflicts.length === 0 &&
      categoryViolation === undefined,
    missing,
    conflicts,
    categoryViolation,
  };
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
