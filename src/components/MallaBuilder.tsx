"use client";

import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { ChevronDown, Download, FileSpreadsheet, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { exportToExcel, exportToPdf } from "@/lib/export";
import type { Course, CoursesData, Placement } from "@/lib/types";
import { ROMAN, validatePlacement } from "@/lib/utils";
import { CourseCard } from "./CourseCard";
import { CoursePalette } from "./CoursePalette";
import { CycleColumn } from "./CycleColumn";
import { PrereqEditor } from "./PrereqEditor";
import { ThemeToggle } from "./ThemeToggle";

interface Props {
  data: CoursesData;
}

const CYCLES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export function MallaBuilder({ data }: Props) {
  const careerSlugs = Object.keys(data.careers);
  const [careerSlug, setCareerSlug] = useState<string>(careerSlugs[0]);
  const career = data.careers[careerSlug];

  const [specialtyOverrides, setSpecialtyOverrides] = useState<
    Record<string, string[]>
  >({});

  const allCourses: Course[] = useMemo(() => {
    return [...career.specifics, ...career.specialty].map((c) => ({
      ...c,
      prereqs: specialtyOverrides[c.code] ?? c.prereqs,
    }));
  }, [career, specialtyOverrides]);

  const [placement, setPlacement] = useState<Placement>({});
  const [activeCourse, setActiveCourse] = useState<Course | null>(null);
  const [editingCode, setEditingCode] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const placedCodes = new Set(Object.keys(placement));
  const totalSpecifics = career.specifics.length;
  const totalSpecialty = career.specialty.length;

  const specifics = allCourses.filter(
    (c) => c.category !== "ESPECIALIDAD" && !placedCodes.has(c.code),
  );
  const specialty = allCourses.filter(
    (c) => c.category === "ESPECIALIDAD" && !placedCodes.has(c.code),
  );

  function coursesInCycle(cycle: number): Course[] {
    return allCourses
      .filter((c) => placement[c.code] === cycle)
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }

  function handleDragStart(event: DragStartEvent) {
    const course = event.active.data.current?.course as Course | undefined;
    if (course) setActiveCourse(course);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveCourse(null);
    const { active, over } = event;
    if (!over) return;

    const course = allCourses.find((c) => c.code === active.id);
    if (!course) return;

    const overId = String(over.id);

    if (overId === "palette-specifics" || overId === "palette-specialty") {
      if (placement[course.code] !== undefined) {
        const next = { ...placement };
        delete next[course.code];
        setPlacement(next);
        toast.info(`${course.name} regresado al panel`);
      }
      return;
    }

    if (overId.startsWith("cycle-")) {
      const targetCycle = Number(overId.replace("cycle-", ""));
      const result = validatePlacement(course, targetCycle, placement, allCourses);
      if (!result.ok) {
        const list = result.missing
          .map((m) =>
            m.reason === "not-placed"
              ? `${m.prereqName} (no colocado)`
              : `${m.prereqName} (debe ir antes del ciclo ${ROMAN[targetCycle - 1]})`,
          )
          .join(", ");
        toast.error(`Falta prerrequisito: ${list}`);
        return;
      }
      setPlacement((prev) => ({ ...prev, [course.code]: targetCycle }));
      toast.success(`${course.name} → Ciclo ${ROMAN[targetCycle - 1]}`);
    }
  }

  function handleReset() {
    if (Object.keys(placement).length === 0) return;
    setPlacement({});
    toast.info("Malla limpiada");
  }

  function handleSavePrereqs(code: string, prereqs: string[]) {
    setSpecialtyOverrides((prev) => ({ ...prev, [code]: prereqs }));
    toast.success("Prerrequisitos actualizados");
  }

  const editingCourse = editingCode
    ? (allCourses.find((c) => c.code === editingCode) ?? null)
    : null;

  const totalCredits = Object.keys(placement).reduce((sum, code) => {
    const c = allCourses.find((x) => x.code === code);
    return sum + (c?.cred ?? 0);
  }, 0);
  const placedCount = Object.keys(placement).length;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="min-h-screen">
        <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
          <div className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground text-[14px] font-black text-background">
                M
              </div>
              <div>
                <h1 className="text-sm font-bold leading-tight tracking-tight">
                  Malla FISI
                </h1>
                <p className="text-[11px] leading-tight text-muted-foreground">
                  Constructor curricular UNMSM
                </p>
              </div>
              <div className="relative ml-2">
                <select
                  value={careerSlug}
                  onChange={(e) => {
                    setCareerSlug(e.target.value);
                    setPlacement({});
                    setSpecialtyOverrides({});
                  }}
                  className="appearance-none rounded-md border border-border bg-card py-1.5 pl-3 pr-8 text-xs font-medium outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
                >
                  {careerSlugs.map((slug) => (
                    <option key={slug} value={slug}>
                      {data.careers[slug].label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={13}
                  className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-1.5">
                <Stat label="Cursos" value={`${placedCount}/${allCourses.length}`} />
                <Divider />
                <Stat label="Creditos" value={String(totalCredits)} />
              </div>
              <button
                type="button"
                onClick={handleReset}
                disabled={placedCount === 0}
                className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
              >
                <RotateCcw size={12} /> Limpiar
              </button>
              <button
                type="button"
                onClick={() => exportToExcel(allCourses, placement, career.label)}
                className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700"
              >
                <FileSpreadsheet size={12} /> Excel
              </button>
              <button
                type="button"
                onClick={() => exportToPdf(career.label)}
                className="flex items-center gap-1.5 rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-700"
              >
                <Download size={12} /> PDF
              </button>
              <ThemeToggle />
            </div>
          </div>
        </header>

        <div className="px-4 py-4 lg:px-6">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
            <aside className="flex flex-col gap-3 lg:sticky lg:top-[80px] lg:self-start">
              <CoursePalette
                title="Especificos"
                subtitle="EEGG + Especifico, prereqs fijos"
                courses={specifics}
                droppableId="palette-specifics"
                onEditPrereqs={() => undefined}
                accent="sky"
                totalCount={totalSpecifics}
              />
              <CoursePalette
                title="Especialidad"
                subtitle="Hover para editar prereqs"
                courses={specialty}
                droppableId="palette-specialty"
                onEditPrereqs={setEditingCode}
                accent="violet"
                totalCount={totalSpecialty}
              />
              <Legend />
            </aside>

            <main id="malla-export" className="overflow-x-auto pb-4">
              <div className="grid min-w-[1500px] grid-cols-10 gap-2">
                {CYCLES.map((cycle) => (
                  <CycleColumn
                    key={cycle}
                    cycle={cycle}
                    courses={coursesInCycle(cycle)}
                    onEditPrereqs={setEditingCode}
                  />
                ))}
              </div>
            </main>
          </div>
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeCourse ? (
          <div className="rotate-1 scale-105">
            <CourseCard course={activeCourse} />
          </div>
        ) : null}
      </DragOverlay>

      <PrereqEditor
        course={editingCourse}
        allCourses={allCourses}
        onClose={() => setEditingCode(null)}
        onSave={handleSavePrereqs}
      />
    </DndContext>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="font-mono text-xs font-bold tabular-nums">{value}</span>
    </div>
  );
}

function Divider() {
  return <span className="h-3.5 w-px bg-border" />;
}

function Legend() {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        Categorias
      </h3>
      <div className="mt-2 flex flex-col gap-1.5">
        <LegendItem className="bg-eegg-bg border-eegg-border text-eegg-fg" label="EEGG" />
        <LegendItem
          className="bg-especifico-bg border-especifico-border text-especifico-fg"
          label="Especifico"
        />
        <LegendItem
          className="bg-especialidad-bg border-especialidad-border text-especialidad-fg"
          label="Especialidad"
        />
      </div>
    </div>
  );
}

function LegendItem({ className, label }: { className: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-3 w-3 rounded border ${className}`} />
      <span className="text-[11px]">{label}</span>
    </div>
  );
}
