import type { Course, Placement } from "./types";
import { findCourseByName } from "./utils";

export interface CycleAnalysis {
  cycle: number;
  count: number;
  credits: number;
  status: "empty" | "low" | "ok" | "heavy" | "overload";
}

export interface Warning {
  level: "error" | "warning" | "info";
  message: string;
  courseCode?: string;
}

export const CREDIT_TARGETS = {
  low: 16,
  ok: 22,
  heavy: 25,
};

export function autoOrganize(courses: Course[]): Placement {
  const placement: Placement = {};
  const remaining = new Set(courses.map((c) => c.code));
  let cycle = 1;
  const maxCycles = 10;

  while (remaining.size > 0 && cycle <= maxCycles) {
    const placedThisRound: string[] = [];
    let cycleCredits = 0;

    for (const code of remaining) {
      const course = courses.find((c) => c.code === code);
      if (!course) continue;
      const ready = course.prereqs.every((prereqName) => {
        const prereq = findCourseByName(prereqName, courses);
        if (!prereq) return true;
        const placedAt = placement[prereq.code];
        return placedAt !== undefined && placedAt < cycle;
      });
      if (ready && cycleCredits + course.cred <= CREDIT_TARGETS.heavy) {
        placement[code] = cycle;
        placedThisRound.push(code);
        cycleCredits += course.cred;
      }
    }

    if (placedThisRound.length === 0) {
      for (const code of remaining) {
        const course = courses.find((c) => c.code === code);
        if (!course) continue;
        const ready = course.prereqs.every((prereqName) => {
          const prereq = findCourseByName(prereqName, courses);
          if (!prereq) return true;
          const placedAt = placement[prereq.code];
          return placedAt !== undefined && placedAt < cycle;
        });
        if (ready) {
          placement[code] = cycle;
          placedThisRound.push(code);
        }
      }
      if (placedThisRound.length === 0) break;
    }

    for (const code of placedThisRound) remaining.delete(code);
    cycle++;
  }

  return placement;
}

export function analyzeCycles(
  courses: Course[],
  placement: Placement,
): CycleAnalysis[] {
  return Array.from({ length: 10 }, (_, i) => i + 1).map((cycle) => {
    const inCycle = courses.filter((c) => placement[c.code] === cycle);
    const credits = inCycle.reduce((s, c) => s + c.cred, 0);
    let status: CycleAnalysis["status"] = "ok";
    if (inCycle.length === 0) status = "empty";
    else if (credits < CREDIT_TARGETS.low) status = "low";
    else if (credits > CREDIT_TARGETS.heavy) status = "overload";
    else if (credits > CREDIT_TARGETS.ok) status = "heavy";
    return { cycle, count: inCycle.length, credits, status };
  });
}

export function detectIssues(
  courses: Course[],
  placement: Placement,
): Warning[] {
  const warnings: Warning[] = [];
  const analysis = analyzeCycles(courses, placement);

  for (const a of analysis) {
    if (a.status === "overload") {
      warnings.push({
        level: "error",
        message: `Ciclo ${a.cycle}: ${a.credits} creditos (sobrecarga, target <=${CREDIT_TARGETS.heavy})`,
      });
    } else if (a.status === "heavy") {
      warnings.push({
        level: "warning",
        message: `Ciclo ${a.cycle}: ${a.credits} creditos (pesado)`,
      });
    } else if (a.status === "low" && a.count > 0) {
      warnings.push({
        level: "info",
        message: `Ciclo ${a.cycle}: solo ${a.credits} creditos (ligero)`,
      });
    }
  }

  for (const course of courses) {
    if (placement[course.code] === undefined) continue;
    const myCycle = placement[course.code];
    for (const prereqName of course.prereqs) {
      const prereq = findCourseByName(prereqName, courses);
      if (!prereq) {
        if (prereqName && prereqName.toUpperCase() !== "NINGUNO") {
          warnings.push({
            level: "warning",
            message: `${course.name}: prereq "${prereqName}" no se encuentra en el catalogo (typo o curso ausente)`,
            courseCode: course.code,
          });
        }
        continue;
      }
      const prereqCycle = placement[prereq.code];
      if (prereqCycle === undefined) {
        warnings.push({
          level: "error",
          message: `${course.name} requiere ${prereq.name} que no esta colocado`,
          courseCode: course.code,
        });
      } else if (prereqCycle >= myCycle) {
        warnings.push({
          level: "error",
          message: `${course.name} (ciclo ${myCycle}) tiene prereq ${prereq.name} en ciclo ${prereqCycle}`,
          courseCode: course.code,
        });
      }
    }
  }

  const placed = new Set(Object.keys(placement));
  const blockedByMissing: Record<string, string[]> = {};
  for (const course of courses) {
    if (placed.has(course.code)) continue;
    for (const prereqName of course.prereqs) {
      const prereq = findCourseByName(prereqName, courses);
      if (!prereq) continue;
      if (!placed.has(prereq.code)) {
        blockedByMissing[prereq.code] = blockedByMissing[prereq.code] ?? [];
        blockedByMissing[prereq.code].push(course.name);
      }
    }
  }

  return warnings;
}

export function getDescendants(
  course: Course,
  allCourses: Course[],
): Course[] {
  const result: Course[] = [];
  const queue = [course];
  const seen = new Set<string>([course.code]);
  while (queue.length > 0) {
    const c = queue.shift();
    if (!c) break;
    for (const other of allCourses) {
      if (seen.has(other.code)) continue;
      const dependsOnC = other.prereqs.some((p) => {
        const found = findCourseByName(p, allCourses);
        return found?.code === c.code;
      });
      if (dependsOnC) {
        seen.add(other.code);
        result.push(other);
        queue.push(other);
      }
    }
  }
  return result;
}

export function getAncestors(
  course: Course,
  allCourses: Course[],
): Course[] {
  const result: Course[] = [];
  const queue = [course];
  const seen = new Set<string>([course.code]);
  while (queue.length > 0) {
    const c = queue.shift();
    if (!c) break;
    for (const prereqName of c.prereqs) {
      const prereq = findCourseByName(prereqName, allCourses);
      if (!prereq || seen.has(prereq.code)) continue;
      seen.add(prereq.code);
      result.push(prereq);
      queue.push(prereq);
    }
  }
  return result;
}

export function getChain(
  code: string,
  allCourses: Course[],
): { ancestors: Set<string>; descendants: Set<string> } {
  const root = allCourses.find((c) => c.code === code);
  if (!root) return { ancestors: new Set(), descendants: new Set() };
  return {
    ancestors: new Set(getAncestors(root, allCourses).map((c) => c.code)),
    descendants: new Set(getDescendants(root, allCourses).map((c) => c.code)),
  };
}

export function findOrphanPrereqs(courses: Course[]): {
  course: Course;
  unresolved: string[];
}[] {
  return courses
    .map((c) => ({
      course: c,
      unresolved: c.prereqs.filter(
        (name) => name && name.toUpperCase() !== "NINGUNO" && !findCourseByName(name, courses),
      ),
    }))
    .filter((r) => r.unresolved.length > 0);
}

export function defaultPlacementFromExcel(courses: Course[]): Placement {
  const placement: Placement = {};
  for (const c of courses) {
    if (c.defaultCycle >= 1 && c.defaultCycle <= 10) {
      placement[c.code] = c.defaultCycle;
    }
  }
  return placement;
}
