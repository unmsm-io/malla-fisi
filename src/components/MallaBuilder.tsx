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
import { Download, FileSpreadsheet, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { Course, CoursesData, Placement } from "@/lib/types";
import { ROMAN, validatePlacement } from "@/lib/utils";
import { CourseCard } from "./CourseCard";
import { CoursePalette } from "./CoursePalette";
import { CycleColumn } from "./CycleColumn";
import { exportToExcel, exportToPdf } from "@/lib/export";
import { PrereqEditor } from "./PrereqEditor";

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
      toast.success(`${course.name} -> Ciclo ${ROMAN[targetCycle - 1]}`);
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
    ? allCourses.find((c) => c.code === editingCode) ?? null
    : null;

  const totalCredits = Object.keys(placement).reduce((sum, code) => {
    const c = allCourses.find((x) => x.code === code);
    return sum + (c?.cred ?? 0);
  }, 0);

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex flex-col gap-4 p-4 lg:p-6">
        <header className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-4">
            <h1 className="text-lg font-bold tracking-tight">
              Malla Curricular FISI
            </h1>
            <select
              value={careerSlug}
              onChange={(e) => {
                setCareerSlug(e.target.value);
                setPlacement({});
              }}
              className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium focus:border-violet-500 focus:outline-none"
            >
              {careerSlugs.map((slug) => (
                <option key={slug} value={slug}>
                  {data.careers[slug].label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-600">
              <span className="font-semibold">{Object.keys(placement).length}</span>/{allCourses.length} cursos | <span className="font-semibold">{totalCredits}</span> creditos
            </span>
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
            >
              <RotateCcw size={14} /> Limpiar
            </button>
            <button
              type="button"
              onClick={() => exportToExcel(allCourses, placement, career.label)}
              className="flex items-center gap-1 rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
            >
              <FileSpreadsheet size={14} /> Excel
            </button>
            <button
              type="button"
              onClick={() => exportToPdf(career.label)}
              className="flex items-center gap-1 rounded bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700"
            >
              <Download size={14} /> PDF
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
          <aside className="flex flex-col gap-3">
            <CoursePalette
              title="Especificos"
              subtitle="EEGG + Especifico (prereqs fijos)"
              courses={specifics}
              droppableId="palette-specifics"
              onEditPrereqs={() => undefined}
              accent="sky"
            />
            <CoursePalette
              title="Especialidad"
              subtitle="Hover para editar prereqs"
              courses={specialty}
              droppableId="palette-specialty"
              onEditPrereqs={setEditingCode}
              accent="violet"
            />
          </aside>

          <main id="malla-export" className="overflow-x-auto">
            <div className="grid min-w-[1400px] grid-cols-10 gap-2">
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

      <DragOverlay>
        {activeCourse ? <CourseCard course={activeCourse} /> : null}
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
