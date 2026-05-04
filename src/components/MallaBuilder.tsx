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
import {
  ChevronDown,
  Columns,
  Download,
  FileSpreadsheet,
  Network,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { analyzeCycles, autoOrganize, detectIssues } from "@/lib/algorithms";
import { exportToExcel, exportToPdf } from "@/lib/export";
import type { Course, CoursesData, Placement } from "@/lib/types";
import { ROMAN, cn, validatePlacement } from "@/lib/utils";
import { CompareView } from "./CompareView";
import { CourseCard } from "./CourseCard";
import { CoursePalette } from "./CoursePalette";
import { CycleColumn } from "./CycleColumn";
import { IssuesPanel } from "./IssuesPanel";
import { PrereqEdges } from "./PrereqEdges";
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
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);
  const [showEdges, setShowEdges] = useState(true);
  const [showCompare, setShowCompare] = useState(false);

  const gridRef = useRef<HTMLDivElement | null>(null);

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

  const analysis = useMemo(
    () => analyzeCycles(allCourses, placement),
    [allCourses, placement],
  );
  const warnings = useMemo(
    () => detectIssues(allCourses, placement),
    [allCourses, placement],
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

  function handleAutoOrganize() {
    const auto = autoOrganize(allCourses);
    setPlacement(auto);
    const placedN = Object.keys(auto).length;
    toast.success(`Auto-organizado: ${placedN} cursos`);
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

  const totalCredits = analysis.reduce((s, a) => s + a.credits, 0);
  const placedCount = Object.keys(placement).length;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex h-screen flex-col overflow-hidden">
        <header className="shrink-0 border-b border-border bg-background/80 backdrop-blur-md">
          <div className="flex flex-wrap items-center gap-2 px-3 py-2 lg:gap-3 lg:px-4">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground text-[12px] font-black text-background">
                M
              </div>
              <div className="leading-tight">
                <h1 className="text-xs font-bold tracking-tight">Malla FISI</h1>
                <p className="text-[10px] text-muted-foreground">UNMSM</p>
              </div>
            </div>

            <div className="relative">
              <select
                value={careerSlug}
                onChange={(e) => {
                  setCareerSlug(e.target.value);
                  setPlacement({});
                  setSpecialtyOverrides({});
                }}
                className="appearance-none rounded-md border border-border bg-card py-1 pl-2.5 pr-7 text-xs font-medium outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
              >
                {careerSlugs.map((slug) => (
                  <option key={slug} value={slug}>
                    {data.careers[slug].label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={11}
                className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
            </div>

            <div className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1">
              <Stat label="Cursos" value={`${placedCount}/${allCourses.length}`} />
              <Divider />
              <Stat label="Cred" value={String(totalCredits)} />
              <Divider />
              <Stat
                label="Issues"
                value={String(warnings.length)}
                tone={warnings.length === 0 ? "ok" : "warn"}
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5 ml-auto">
              <button
                type="button"
                onClick={handleAutoOrganize}
                className="flex items-center gap-1 rounded-md bg-foreground px-2.5 py-1 text-[11px] font-semibold text-background hover:opacity-90"
              >
                <Sparkles size={11} /> Auto
              </button>
              <button
                type="button"
                onClick={() => setShowEdges((v) => !v)}
                className={cn(
                  "flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-medium transition",
                  showEdges
                    ? "border-violet-500/50 bg-violet-500/10 text-violet-700 dark:text-violet-300"
                    : "border-border bg-card hover:bg-accent",
                )}
              >
                <Network size={11} /> Edges
              </button>
              <button
                type="button"
                onClick={() => setShowCompare(true)}
                className="flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-[11px] font-medium hover:bg-accent"
              >
                <Columns size={11} /> Comparar
              </button>
              <button
                type="button"
                onClick={handleReset}
                disabled={placedCount === 0}
                className="flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-[11px] font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
              >
                <RotateCcw size={11} /> Limpiar
              </button>
              <button
                type="button"
                onClick={() => exportToExcel(allCourses, placement, career.label)}
                className="flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700"
              >
                <FileSpreadsheet size={11} /> Excel
              </button>
              <button
                type="button"
                onClick={() => exportToPdf(career.label)}
                className="flex items-center gap-1 rounded-md bg-rose-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-rose-700"
              >
                <Download size={11} /> PDF
              </button>
              <ThemeToggle />
            </div>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-[260px_1fr] gap-2 p-2 lg:gap-3 lg:p-3">
          <aside className="flex min-h-0 flex-col gap-2">
            <CoursePalette
              title={`Especificos (${totalSpecifics})`}
              courses={specifics}
              droppableId="palette-specifics"
              onEditPrereqs={() => undefined}
              onHover={setHoveredCode}
              hoveredCode={hoveredCode}
              accent="sky"
              totalCount={totalSpecifics}
            />
            <CoursePalette
              title={`Especialidad (${totalSpecialty})`}
              courses={specialty}
              droppableId="palette-specialty"
              onEditPrereqs={setEditingCode}
              onHover={setHoveredCode}
              hoveredCode={hoveredCode}
              accent="violet"
              totalCount={totalSpecialty}
            />
            <IssuesPanel warnings={warnings} />
          </aside>

          <main
            id="malla-export"
            ref={gridRef}
            className="relative min-h-0 overflow-auto rounded-xl border border-border bg-card/30 p-2"
          >
            <div className="grid h-full min-w-[1400px] grid-cols-10 gap-1.5">
              {CYCLES.map((cycle) => (
                <CycleColumn
                  key={cycle}
                  cycle={cycle}
                  courses={coursesInCycle(cycle)}
                  analysis={analysis[cycle - 1]}
                  hoveredCode={hoveredCode}
                  onHover={setHoveredCode}
                  onEditPrereqs={setEditingCode}
                />
              ))}
            </div>
            {showEdges && (
              <PrereqEdges
                courses={allCourses}
                placement={placement}
                hoveredCode={hoveredCode}
                containerRef={gridRef}
              />
            )}
          </main>
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

      {showCompare && (
        <CompareView data={data} onClose={() => setShowCompare(false)} />
      )}
    </DndContext>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn";
}) {
  return (
    <div className="flex items-baseline gap-1">
      <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          "font-mono text-[11px] font-bold tabular-nums",
          tone === "ok" && "text-emerald-600 dark:text-emerald-400",
          tone === "warn" && "text-amber-600 dark:text-amber-400",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function Divider() {
  return <span className="h-3 w-px bg-border" />;
}
