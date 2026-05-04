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
  BookCheck,
  ChevronDown,
  Columns,
  Download,
  FileSpreadsheet,
  Network,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  analyzeCycles,
  autoOrganize,
  defaultPlacementFromExcel,
  detectIssues,
  getChain,
} from "@/lib/algorithms";
import { exportToExcel, exportToPdf } from "@/lib/export";
import { loadState, saveState } from "@/lib/storage";
import type { Course, CoursesData, Placement } from "@/lib/types";
import { ROMAN, cn, validatePlacement } from "@/lib/utils";
import { CompareView } from "./CompareView";
import { CardHighlight, CourseCard } from "./CourseCard";
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
  const [hydrated, setHydrated] = useState(false);

  const gridRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const saved = loadState(careerSlug);
    if (saved) {
      setPlacement(saved.placement);
      setSpecialtyOverrides(saved.specialtyOverrides);
    } else {
      setPlacement({});
      setSpecialtyOverrides({});
    }
    setHydrated(true);
  }, [careerSlug]);

  useEffect(() => {
    if (!hydrated) return;
    saveState(careerSlug, { placement, specialtyOverrides });
  }, [careerSlug, placement, specialtyOverrides, hydrated]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const placedCodes = useMemo(() => new Set(Object.keys(placement)), [placement]);
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

  const chain = useMemo(() => {
    if (!hoveredCode) return { ancestors: new Set<string>(), descendants: new Set<string>() };
    return getChain(hoveredCode, allCourses);
  }, [hoveredCode, allCourses]);

  const highlightedEdgeCodes = useMemo(() => {
    if (!hoveredCode) return new Set<string>();
    return new Set([hoveredCode, ...chain.ancestors, ...chain.descendants]);
  }, [hoveredCode, chain]);

  const highlightFor = useCallback(
    (code: string): CardHighlight => {
      if (!hoveredCode) return "none";
      if (code === hoveredCode) return "self";
      if (chain.ancestors.has(code)) return "ancestor";
      if (chain.descendants.has(code)) return "descendant";
      return "none";
    },
    [hoveredCode, chain],
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
        const { descendants } = getChain(course.code, allCourses);
        const placedDescendants = [...descendants].filter((c) =>
          placedCodes.has(c),
        );
        if (placedDescendants.length > 0) {
          const ok = window.confirm(
            `${course.name} tiene ${placedDescendants.length} curso(s) descendiente(s) ya colocado(s) que dependen de el. ¿Quitar tambien los descendientes en cascada?`,
          );
          const next = { ...placement };
          delete next[course.code];
          if (ok) {
            for (const code of placedDescendants) delete next[code];
            toast.info(
              `${course.name} y ${placedDescendants.length} descendiente(s) regresados al panel`,
            );
          } else {
            toast.warning(
              `${course.name} regresado, pero ${placedDescendants.length} descendiente(s) ahora estan invalidos`,
            );
          }
          setPlacement(next);
          return;
        }
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
        const items = result.missing
          .map((m) =>
            m.reason === "not-placed"
              ? `• ${m.prereqName} (no colocado)`
              : `• ${m.prereqName} (debe ir antes del ciclo ${ROMAN[targetCycle - 1]})`,
          )
          .join("\n");
        toast.error(
          `Falta${result.missing.length > 1 ? "n" : ""} prerrequisito${result.missing.length > 1 ? "s" : ""}:\n${items}`,
          { duration: 6000 },
        );
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
    if (placedN < allCourses.length) {
      toast.warning(
        `Auto: ${placedN}/${allCourses.length} cursos colocados. ${allCourses.length - placedN} no caben (probable ciclo de prereqs).`,
      );
    } else {
      toast.success(`Auto-organizado: ${placedN} cursos`);
    }
  }

  function handleLoadDefault() {
    const def = defaultPlacementFromExcel(allCourses);
    setPlacement(def);
    toast.success(`Plan oficial cargado (${Object.keys(def).length} cursos)`);
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
                onChange={(e) => setCareerSlug(e.target.value)}
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

            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={handleLoadDefault}
                title="Cargar la malla sugerida por el Excel original"
                className="flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-[11px] font-medium hover:bg-accent"
              >
                <BookCheck size={11} /> Plan oficial
              </button>
              <button
                type="button"
                onClick={handleAutoOrganize}
                title="Coloca todos los cursos en el ciclo minimo posible"
                className="flex items-center gap-1 rounded-md bg-foreground px-2.5 py-1 text-[11px] font-semibold text-background hover:opacity-90"
              >
                <Sparkles size={11} /> Auto
              </button>
              <button
                type="button"
                onClick={() => setShowEdges((v) => !v)}
                title="Mostrar/ocultar flechas de prerequisitos"
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
                title="Comparar carreras lado a lado"
                className="flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-[11px] font-medium hover:bg-accent"
              >
                <Columns size={11} /> Comparar
              </button>
              <button
                type="button"
                onClick={handleReset}
                disabled={placedCount === 0}
                title="Vaciar la malla"
                className="flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-[11px] font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
              >
                <RotateCcw size={11} /> Limpiar
              </button>
              <button
                type="button"
                onClick={() => exportToExcel(allCourses, placement, career.label)}
                title="Exportar malla a Excel"
                className="flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700"
              >
                <FileSpreadsheet size={11} /> Excel
              </button>
              <button
                type="button"
                onClick={() => exportToPdf(career.label)}
                title="Exportar malla a PDF"
                className="flex items-center gap-1 rounded-md bg-rose-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-rose-700"
              >
                <Download size={11} /> PDF
              </button>
              <ThemeToggle />
            </div>
          </div>
          <HintBar />
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-[300px_1fr] gap-2 p-2 lg:gap-3 lg:p-3">
          <aside className="flex min-h-0 flex-col gap-2">
            <CoursePalette
              title={`Especificos (${totalSpecifics})`}
              courses={specifics}
              droppableId="palette-specifics"
              onEditPrereqs={() => undefined}
              onHover={setHoveredCode}
              highlightFor={highlightFor}
              accent="sky"
              totalCount={totalSpecifics}
            />
            <CoursePalette
              title={`Especialidad (${totalSpecialty})`}
              courses={specialty}
              droppableId="palette-specialty"
              onEditPrereqs={setEditingCode}
              onHover={setHoveredCode}
              highlightFor={highlightFor}
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
            <div className="grid h-full min-w-[2100px] grid-cols-10 gap-2.5">
              {CYCLES.map((cycle) => (
                <CycleColumn
                  key={cycle}
                  cycle={cycle}
                  courses={coursesInCycle(cycle)}
                  analysis={analysis[cycle - 1]}
                  highlightFor={highlightFor}
                  onHover={setHoveredCode}
                  onEditPrereqs={setEditingCode}
                />
              ))}
            </div>
            {showEdges && (
              <PrereqEdges
                courses={allCourses}
                placement={placement}
                highlightedEdgeCodes={highlightedEdgeCodes}
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

function HintBar() {
  return (
    <div className="hidden border-t border-border/60 bg-muted/30 px-4 py-1 text-[10px] text-muted-foreground md:flex md:items-center md:gap-4">
      <span>
        <kbd className="rounded border border-border bg-card px-1 font-mono text-[9px]">
          Hover
        </kbd>{" "}
        resalta cadena de prereqs y dependientes
      </span>
      <span className="opacity-40">·</span>
      <span>
        <span className="inline-block h-2 w-2 rounded-full bg-sky-500" /> prereqs ·{" "}
        <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />{" "}
        dependientes
      </span>
      <span className="opacity-40">·</span>
      <span>Drag a panel para quitar (cascade opcional)</span>
      <span className="opacity-40">·</span>
      <span>
        <kbd className="rounded border border-border bg-card px-1 font-mono text-[9px]">
          Esc
        </kbd>{" "}
        cierra modales · Tu malla se guarda automaticamente
      </span>
    </div>
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
