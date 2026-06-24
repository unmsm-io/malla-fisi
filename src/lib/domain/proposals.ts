import { CREDIT_TARGETS, analyzeCycles, type Warning } from "./algorithms";
import type { Course, Placement } from "./types";
import { findCourseByName, validatePlacement } from "./utils";

export type ProposalAction =
  | { type: "place"; code: string; cycle: number }
  | { type: "move"; code: string; toCycle: number }
  | { type: "remove"; code: string };

export interface Proposal {
  label: string;
  rationale: string;
  recommended?: boolean;
  actions: ProposalAction[];
  affectedCodes: string[];
}

interface Ctx {
  courses: Course[];
  placement: Placement;
}

export function applyProposal(placement: Placement, actions: ProposalAction[]): Placement {
  const next = { ...placement };
  for (const a of actions) {
    if (a.type === "place" || a.type === "move") {
      const cycle = a.type === "place" ? a.cycle : a.toCycle;
      next[a.code] = cycle;
    } else if (a.type === "remove") {
      delete next[a.code];
    }
  }
  return next;
}

function findValidCyclesFor(
  course: Course,
  ctx: Ctx,
  excluding?: string,
): number[] {
  const valid: number[] = [];
  const placement = excluding
    ? Object.fromEntries(Object.entries(ctx.placement).filter(([k]) => k !== excluding))
    : ctx.placement;
  for (let cycle = 1; cycle <= 10; cycle++) {
    const result = validatePlacement(course, cycle, placement, ctx.courses);
    if (result.ok) valid.push(cycle);
  }
  return valid;
}

function rankByCreditBalance(
  cycles: number[],
  ctx: Ctx,
  cred: number,
): number[] {
  const analysis = analyzeCycles(ctx.courses, ctx.placement);
  const SAFE_MAX = 25;
  return [...cycles].sort((a, b) => {
    const newA = analysis[a - 1].credits + cred;
    const newB = analysis[b - 1].credits + cred;
    const aSafe = newA <= SAFE_MAX;
    const bSafe = newB <= SAFE_MAX;
    if (aSafe !== bSafe) return aSafe ? -1 : 1;
    if (aSafe && bSafe) return a - b;
    return newA - newB;
  });
}

function findCoursesDependingOn(
  code: string,
  courses: Course[],
): Course[] {
  return courses.filter((c) =>
    c.prereqs.some((p) => {
      const found = findCourseByName(p, courses);
      return found?.code === code;
    }),
  );
}

export function proposalsForMissingPrereq(
  warning: Warning,
  ctx: Ctx,
): Proposal[] {
  const proposals: Proposal[] = [];
  if (!warning.courseCode) return proposals;
  const dependent = ctx.courses.find((c) => c.code === warning.courseCode);
  if (!dependent) return proposals;
  const dependentCycle = ctx.placement[dependent.code];
  if (dependentCycle === undefined) return proposals;

  const m = warning.message.match(/requiere ([^]*?) que no/);
  const prereqName = m?.[1]?.trim();
  if (!prereqName) return proposals;
  const prereq = findCourseByName(prereqName, ctx.courses);
  if (!prereq) return proposals;

  const valid = findValidCyclesFor(prereq, ctx).filter((c) => c < dependentCycle);
  const ranked = rankByCreditBalance(valid, ctx, prereq.cred).slice(0, 2);

  ranked.forEach((cycle, i) => {
    proposals.push({
      label: `Colocar ${prereq.name} en Ciclo ${roman(cycle)}`,
      rationale:
        i === 0
          ? "Mejor balance de creditos"
          : `Alternativa (${cycle} es valido)`,
      recommended: i === 0,
      actions: [{ type: "place", code: prereq.code, cycle }],
      affectedCodes: [prereq.code],
    });
  });

  proposals.push({
    label: `Quitar ${dependent.name} del Ciclo ${roman(dependentCycle)}`,
    rationale: "Si no quieres incluir el prereq",
    actions: [{ type: "remove", code: dependent.code }],
    affectedCodes: [dependent.code],
  });

  return proposals;
}

export function proposalsForCycleInversion(
  warning: Warning,
  ctx: Ctx,
): Proposal[] {
  const proposals: Proposal[] = [];
  if (!warning.courseCode) return proposals;
  const course = ctx.courses.find((c) => c.code === warning.courseCode);
  if (!course) return proposals;

  const m = warning.message.match(/prereq ([^]*?) en ciclo (\d+)/);
  const prereqName = m?.[1]?.trim();
  const prereqCycle = m?.[2] ? Number(m[2]) : undefined;
  if (!prereqName || prereqCycle === undefined) return proposals;
  const prereq = findCourseByName(prereqName, ctx.courses);
  if (!prereq) return proposals;

  const validForCourse = findValidCyclesFor(course, ctx).filter(
    (c) => c > prereqCycle,
  );
  const rankedCourse = rankByCreditBalance(validForCourse, ctx, course.cred).slice(0, 2);
  rankedCourse.forEach((cycle, i) => {
    proposals.push({
      label: `Mover ${course.name} a Ciclo ${roman(cycle)}`,
      rationale: i === 0 ? "Mejor balance" : "Alternativa",
      recommended: i === 0,
      actions: [{ type: "move", code: course.code, toCycle: cycle }],
      affectedCodes: [course.code],
    });
  });

  const myCycle = ctx.placement[course.code];
  if (myCycle !== undefined) {
    const validForPrereq = findValidCyclesFor(prereq, ctx, prereq.code).filter(
      (c) => c < myCycle,
    );
    const rankedPrereq = rankByCreditBalance(validForPrereq, ctx, prereq.cred).slice(0, 1);
    rankedPrereq.forEach((cycle) => {
      proposals.push({
        label: `Mover ${prereq.name} a Ciclo ${roman(cycle)}`,
        rationale: "Mover el prereq antes",
        actions: [{ type: "move", code: prereq.code, toCycle: cycle }],
        affectedCodes: [prereq.code],
      });
    });
  }

  return proposals;
}

export function proposalsForOverload(
  warning: Warning,
  ctx: Ctx,
): Proposal[] {
  const m = warning.message.match(/Ciclo (\d+):/);
  const cycle = m?.[1] ? Number(m[1]) : undefined;
  if (cycle === undefined) return [];

  const inCycle = ctx.courses
    .filter((c) => ctx.placement[c.code] === cycle)
    .sort((a, b) => b.cred - a.cred);

  const proposals: Proposal[] = [];
  for (const course of inCycle.slice(0, 4)) {
    const validNext = findValidCyclesFor(course, ctx, course.code).filter(
      (c) => c !== cycle,
    );
    if (validNext.length === 0) continue;
    const target = rankByCreditBalance(validNext, ctx, course.cred)[0];
    proposals.push({
      label: `Mover ${course.name} a Ciclo ${roman(target)}`,
      rationale: `Libera ${course.cred} credito${course.cred !== 1 ? "s" : ""} del ciclo ${roman(cycle)}`,
      affectedCodes: [course.code],
      actions: [{ type: "move", code: course.code, toCycle: target }],
    });
    if (proposals.length >= 3) break;
  }

  if (proposals.length > 0) proposals[0].recommended = true;
  return proposals;
}

export function proposalsForWarning(warning: Warning, ctx: Ctx): Proposal[] {
  if (warning.message.includes("requiere") && warning.message.includes("no esta colocado")) {
    return proposalsForMissingPrereq(warning, ctx);
  }
  if (warning.message.includes("tiene prereq") && warning.message.includes("en ciclo")) {
    return proposalsForCycleInversion(warning, ctx);
  }
  if (warning.message.includes("sobrecarga") || warning.message.includes("pesado")) {
    return proposalsForOverload(warning, ctx);
  }
  return [];
}

function roman(n: number): string {
  return ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"][n] ?? String(n);
}

void CREDIT_TARGETS;
