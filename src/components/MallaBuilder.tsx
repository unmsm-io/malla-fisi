"use client";

import {
  UserButton,
} from "@clerk/nextjs";
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
  Save,
  Sparkles,
  Trash2,
  Undo2,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import Image from "next/image";
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
import { applyProposal, type Proposal } from "@/lib/proposals";
import { solveIssues } from "@/lib/solver";
import type { Warning } from "@/lib/algorithms";
import { loadState, saveState } from "@/lib/storage";
import type { Course, CourseOverride, CoursesData, MallaState, Placement } from "@/lib/types";
import { ROMAN, cn, validatePlacement } from "@/lib/utils";
import { CompareView } from "./CompareView";
import { CardHighlight, CourseCard } from "./CourseCard";
import { CoursePalette } from "./CoursePalette";
import { CycleColumn } from "./CycleColumn";
import { ImportDialog } from "./ImportDialog";
import { IssuesPanel } from "./IssuesPanel";
import { PrereqEdges } from "./PrereqEdges";
import { PrereqEditor } from "./PrereqEditor";
import { ThemeToggle } from "./ThemeToggle";
import type { Career } from "@/lib/types";
import type { ImportResult } from "@/lib/import";

interface Props {
  data: CoursesData;
}

const CYCLES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const IMPORTED_KEY = "malla-fisi:v1:imported-careers";

function loadImportedCareers(): Record<string, Career> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(IMPORTED_KEY);
    return raw ? (JSON.parse(raw) as Record<string, Career>) : {};
  } catch {
    return {};
  }
}

function saveImportedCareers(careers: Record<string, Career>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(IMPORTED_KEY, JSON.stringify(careers));
  } catch {}
}

function legacyPrereqOverrides(
  specialtyOverrides?: Record<string, string[]>,
): Record<string, CourseOverride> {
  if (!specialtyOverrides) return {};
  return Object.fromEntries(
    Object.entries(specialtyOverrides).map(([code, prereqs]) => [code, { prereqs }]),
  );
}

function fingerprintState(input: {
  careerSlug: string;
  career: Career;
  placement: Placement;
  courseOverrides: Record<string, CourseOverride>;
  stateId?: string;
}) {
  return JSON.stringify({
    stateId: input.stateId,
    careerSlug: input.careerSlug,
    career: input.career,
    placement: input.placement,
    courseOverrides: input.courseOverrides,
  });
}

export function MallaBuilder({ data }: Props) {
  const [importedCareers, setImportedCareers] = useState<Record<string, Career>>({});
  const [showImport, setShowImport] = useState(false);

  useEffect(() => {
    setImportedCareers(loadImportedCareers());
  }, []);

  const mergedData = useMemo<CoursesData>(
    () => ({ careers: { ...data.careers, ...importedCareers } }),
    [data, importedCareers],
  );

  const careerSlugs = Object.keys(mergedData.careers);
  const [careerSlug, setCareerSlug] = useState<string>(Object.keys(data.careers)[0]);
  const career = mergedData.careers[careerSlug] ?? mergedData.careers[careerSlugs[0]];

  const [courseOverrides, setCourseOverrides] = useState<Record<string, CourseOverride>>({});
  const [stateId, setStateId] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [lastSavedFingerprint, setLastSavedFingerprint] = useState<string>("");

  const allCourses: Course[] = useMemo(() => {
    return [...career.specifics, ...career.specialty].map((c) => ({
      ...c,
      code: courseOverrides[c.code]?.code ?? c.code,
      prereqs: courseOverrides[c.code]?.prereqs ?? c.prereqs,
    }));
  }, [career, courseOverrides]);

  const [placement, setPlacement] = useState<Placement>({});
  const [activeCourse, setActiveCourse] = useState<Course | null>(null);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);
  const [proposalHoverCodes, setProposalHoverCodes] = useState<string[] | null>(null);
  const [locatedCodes, setLocatedCodes] = useState<Set<string>>(new Set());
  const locateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showEdges, setShowEdges] = useState(true);
  const [showCompare, setShowCompare] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [history, setHistory] = useState<Placement[]>([]);
  const [fixPreview, setFixPreview] = useState<{
    proposals: Proposal[];
    finalPlacement: Placement;
    remainingErrors: Warning[];
    iterations: number;
    reason: "converged" | "max-iterations" | "no-progress";
    beforeWarnings: number;
  } | null>(null);

  const gridRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const saved = loadState(careerSlug);
    if (saved) {
      const nextOverrides = saved.courseOverrides ?? legacyPrereqOverrides(saved.specialtyOverrides);
      setPlacement(saved.placement);
      setCourseOverrides(nextOverrides);
      setStateId(saved.stateId);
      setLastSavedFingerprint(
        fingerprintState({
          careerSlug,
          career,
          placement: saved.placement,
          courseOverrides: nextOverrides,
          stateId: saved.stateId,
        }),
      );
    } else {
      setPlacement({});
      setCourseOverrides({});
      setStateId(undefined);
      setLastSavedFingerprint(
        fingerprintState({
          careerSlug,
          career,
          placement: {},
          courseOverrides: {},
        }),
      );
    }
    setHydrated(true);
  }, [careerSlug, career]);

  useEffect(() => {
    if (!hydrated) return;
    saveState(careerSlug, { placement, courseOverrides, stateId });
  }, [careerSlug, placement, courseOverrides, stateId, hydrated]);

  const commitPlacement = useCallback(
    (next: Placement | ((prev: Placement) => Placement)) => {
      setPlacement((prev) => {
        const resolved = typeof next === "function" ? (next as (p: Placement) => Placement)(prev) : next;
        setHistory((h) => [...h.slice(-19), prev]);
        return resolved;
      });
    },
    [],
  );

  const handleUndo = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const last = h[h.length - 1];
      setPlacement(last);
      toast.info("Deshecho");
      return h.slice(0, -1);
    });
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleUndo]);

  function handleLocate(codes: string[]) {
    if (codes.length === 0) return;
    if (locateTimerRef.current) clearTimeout(locateTimerRef.current);
    setLocatedCodes(new Set(codes));
    requestAnimationFrame(() => {
      const first = codes[0];
      const el = gridRef.current?.querySelector(
        `[data-course-code="${first}"]`,
      ) as HTMLElement | null;
      el?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    });
    locateTimerRef.current = setTimeout(() => {
      setLocatedCodes(new Set());
    }, 3000);
  }

  function handleApplyProposal(p: Proposal) {
    commitPlacement((prev) => applyProposal(prev, p.actions));
    toast.success(p.label);
    requestAnimationFrame(() => {
      const code = p.affectedCodes[0];
      if (!code) return;
      const el = gridRef.current?.querySelector(
        `[data-course-code="${code}"]`,
      ) as HTMLElement | null;
      el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    });
  }

  function handleOpenFixPreview() {
    const result = solveIssues(allCourses, placement, { includeWarnings: false });
    setFixPreview({
      proposals: result.appliedProposals,
      finalPlacement: result.finalPlacement,
      remainingErrors: result.remainingErrors,
      iterations: result.iterations,
      reason: result.reason,
      beforeWarnings: warnings.length,
    });
  }

  function handleConfirmFixPreview() {
    if (!fixPreview) return;
    commitPlacement(fixPreview.finalPlacement);
    toast.success(`${fixPreview.proposals.length} fix(es) aplicados`);
    setFixPreview(null);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  function findBaseCode(code: string): string | null {
    for (const baseCourse of [...career.specifics, ...career.specialty]) {
      if (baseCourse.code === code || courseOverrides[baseCourse.code]?.code === code) {
        return baseCourse.code;
      }
    }
    return null;
  }

  function buildCurrentState(nextStateId = stateId): MallaState {
    return {
      schemaVersion: 1,
      stateId: nextStateId,
      careerSlug,
      careerLabel: career.label,
      career,
      placement,
      courseOverrides,
      savedAt: new Date().toISOString(),
    };
  }

  const currentFingerprint = useMemo(
    () =>
      fingerprintState({
        careerSlug,
        career,
        placement,
        courseOverrides,
        stateId,
      }),
    [careerSlug, career, placement, courseOverrides, stateId],
  );
  const hasUnsavedChanges = hydrated && currentFingerprint !== lastSavedFingerprint;

  async function handleSaveState() {
    const id = toast.loading("Guardando estado...");
    setSaving(true);
    try {
      const res = await fetch("/api/states", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildCurrentState()),
      });
      const data = (await res.json()) as { id?: string; state?: MallaState; error?: string };
      if (!res.ok || !data.id) {
        throw new Error(data.error ?? "No se pudo guardar");
      }
      setStateId(data.id);
      const savedFingerprint = fingerprintState({
        careerSlug,
        career,
        placement,
        courseOverrides,
        stateId: data.id,
      });
      setLastSavedFingerprint(savedFingerprint);
      saveState(careerSlug, {
        placement,
        courseOverrides,
        stateId: data.id,
      });
      toast.success("Estado guardado", { id });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error guardando", { id });
    } finally {
      setSaving(false);
    }
  }

  async function handleExportExcel() {
    let exportState = buildCurrentState();
    if (!exportState.stateId || hasUnsavedChanges) {
      const id = toast.loading("Guardando antes de exportar...");
      try {
        const res = await fetch("/api/states", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(exportState),
        });
        const data = (await res.json()) as { id?: string; state?: MallaState; error?: string };
        if (!res.ok || !data.id) throw new Error(data.error ?? "No se pudo guardar");
        setStateId(data.id);
        exportState = data.state ?? buildCurrentState(data.id);
        setLastSavedFingerprint(
          fingerprintState({
            careerSlug,
            career,
            placement,
            courseOverrides,
            stateId: data.id,
          }),
        );
        toast.success("Estado guardado", { id });
      } catch (error) {
        toast.warning("Exportando con respaldo embebido, sin guardar en DB", { id });
        exportState = buildCurrentState();
      }
    }
    await exportToExcel(allCourses, placement, career.label, exportState);
  }

  const placedCodes = useMemo(() => new Set(Object.keys(placement)), [placement]);
  const totalEegg = allCourses.filter((c) => c.category === "EEGG").length;
  const totalSpecifics = allCourses.filter((c) => c.category === "ESPECIFICO").length;
  const totalSpecialty = allCourses.filter((c) => c.category === "ESPECIALIDAD").length;

  const eegg = allCourses.filter((c) => c.category === "EEGG" && !placedCodes.has(c.code));
  const specifics = allCourses.filter((c) => c.category === "ESPECIFICO" && !placedCodes.has(c.code));
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
      if (locatedCodes.has(code)) return "self";
      if (proposalHoverCodes && proposalHoverCodes.includes(code)) return "self";
      if (!hoveredCode) return "none";
      if (code === hoveredCode) return "self";
      if (chain.ancestors.has(code)) return "ancestor";
      if (chain.descendants.has(code)) return "descendant";
      return "none";
    },
    [hoveredCode, chain, proposalHoverCodes, locatedCodes],
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

    if (
      overId === "palette-eegg" ||
      overId === "palette-specifics" ||
      overId === "palette-specialty"
    ) {
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
          commitPlacement(next);
          return;
        }
        const next = { ...placement };
        delete next[course.code];
        commitPlacement(next);
        toast.info(`${course.name} regresado al panel`);
      }
      return;
    }

    if (overId.startsWith("cycle-")) {
      const targetCycle = Number(overId.replace("cycle-", ""));
      const result = validatePlacement(course, targetCycle, placement, allCourses);
      if (!result.ok) {
        const lines: string[] = [];
        if (result.categoryViolation) {
          lines.push(result.categoryViolation.reason);
        }
        if (result.missing.length > 0) {
          lines.push("Prerrequisitos faltantes:");
          for (const m of result.missing) {
            lines.push(
              m.reason === "not-placed"
                ? `• ${m.prereqName} (no colocado)`
                : `• ${m.prereqName} (debe ir antes del ciclo ${ROMAN[targetCycle - 1]})`,
            );
          }
        }
        if (result.conflicts.length > 0) {
          lines.push("Romperia dependientes ya colocados:");
          for (const c of result.conflicts) {
            lines.push(
              `• ${c.dependentName} (ciclo ${ROMAN[c.dependentCycle - 1]}) depende de este curso`,
            );
          }
        }
        toast.error(lines.join("\n"), { duration: 7000 });
        return;
      }
      commitPlacement((prev) => ({ ...prev, [course.code]: targetCycle }));
      toast.success(`${course.name} → Ciclo ${ROMAN[targetCycle - 1]}`);
    }
  }

  function handleAutoOrganize() {
    const auto = autoOrganize(allCourses);
    commitPlacement(auto);
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
    commitPlacement(def);
    toast.success(`Plan oficial cargado (${Object.keys(def).length} cursos)`);
  }

  function handleReset() {
    if (Object.keys(placement).length === 0) return;
    commitPlacement({});
    toast.info("Malla limpiada");
  }

  function handleImportConfirm(result: ImportResult) {
    const next = { ...importedCareers, [result.career.slug]: result.career };
    setImportedCareers(next);
    saveImportedCareers(next);
    setCareerSlug(result.career.slug);
    if (result.state) {
      setPlacement(result.state.placement);
      setCourseOverrides(result.state.courseOverrides ?? {});
      setStateId(result.state.stateId);
      setLastSavedFingerprint(
        fingerprintState({
          careerSlug: result.career.slug,
          career: result.career,
          placement: result.state.placement,
          courseOverrides: result.state.courseOverrides ?? {},
          stateId: result.state.stateId,
        }),
      );
      saveState(result.career.slug, {
        placement: result.state.placement,
        courseOverrides: result.state.courseOverrides ?? {},
        stateId: result.state.stateId,
      });
    } else {
      setPlacement({});
      setCourseOverrides({});
      setStateId(undefined);
      setLastSavedFingerprint(
        fingerprintState({
          careerSlug: result.career.slug,
          career: result.career,
          placement: {},
          courseOverrides: {},
        }),
      );
    }
    setShowImport(false);
    toast.success(
      result.state
        ? `${result.career.label} restaurada desde estado guardado`
        : `${result.career.label} importada con ${result.career.specifics.length + result.career.specialty.length} cursos`,
    );
  }

  function handleDeleteImported() {
    if (!importedCareers[careerSlug]) return;
    const ok = window.confirm(
      `Eliminar "${career.label}" de las carreras importadas? Esta accion no afecta los archivos originales.`,
    );
    if (!ok) return;
    const next = { ...importedCareers };
    delete next[careerSlug];
    setImportedCareers(next);
    saveImportedCareers(next);
    setCareerSlug(Object.keys(data.careers)[0]);
    toast.info("Carrera eliminada");
  }

  function handleSaveCourse(code: string, nextCode: string, prereqs: string[]) {
    const baseCode = findBaseCode(code);
    if (!baseCode) return;
    const normalizedNextCode = nextCode.trim();
    if (!normalizedNextCode) {
      toast.error("El codigo no puede estar vacio");
      return;
    }
    const duplicate = allCourses.some(
      (c) => c.code !== code && c.code.trim() === normalizedNextCode,
    );
    if (duplicate) {
      toast.error(`Codigo duplicado: ${normalizedNextCode}`);
      return;
    }
    setCourseOverrides((prev) => ({
      ...prev,
      [baseCode]: {
        ...prev[baseCode],
        code: normalizedNextCode === baseCode ? undefined : normalizedNextCode,
        prereqs,
      },
    }));
    if (normalizedNextCode !== code && placement[code] !== undefined) {
      commitPlacement((prev) => {
        const next = { ...prev };
        next[normalizedNextCode] = next[code];
        delete next[code];
        return next;
      });
      setEditingCode(normalizedNextCode);
    }
    toast.success("Curso actualizado");
  }

  const editingCourse = editingCode
    ? (allCourses.find((c) => c.code === editingCode) ?? null)
    : null;

  const totalCredits = analysis.reduce((s, a) => s + a.credits, 0);
  const placedCount = Object.keys(placement).length;
  const errorCount = warnings.filter((w) => w.level === "error").length;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex h-screen flex-col overflow-hidden">
        <header className="shrink-0 border-b border-border bg-background/80 backdrop-blur-md">
          <div className="flex items-center gap-2 px-3 py-2 lg:gap-2.5 lg:px-4">
            <div className="flex shrink-0 items-center gap-2">
              <div
                className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-md border bg-accent"
                style={{ borderColor: "var(--gold)" }}
              >
                <Image
                  src="/escudo-unmsm.png"
                  alt="Escudo UNMSM"
                  width={36}
                  height={36}
                  priority
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="hidden leading-tight md:block">
                <h1 className="font-serif text-[13px] font-bold tracking-tight">
                  Malla FISI
                </h1>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  UNMSM
                </p>
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
                    {mergedData.careers[slug].label}
                    {importedCareers[slug] ? " (importada)" : ""}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={11}
                className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowImport(true)}
              title="Importar carrera desde Excel"
              className="flex items-center gap-1 rounded-md border border-dashed border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:border-emerald-500/40 hover:text-foreground"
            >
              <Upload size={11} /> Importar
            </button>
            {importedCareers[careerSlug] && (
              <IconButton
                icon={Trash2}
                onClick={handleDeleteImported}
                tooltip="Eliminar esta carrera importada"
                variant="danger"
              />
            )}

            <div className="hidden items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1 lg:flex">
              <Stat label="Cursos" value={`${placedCount}/${allCourses.length}`} />
              <Divider />
              <Stat label="Creditos" value={String(totalCredits)} />
              <Divider />
              <Stat
                label="Issues"
                value={String(warnings.length)}
                tone={warnings.length === 0 ? "ok" : "warn"}
              />
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-1.5">
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
                title="Coloca todos los cursos en el ciclo minimo posible respetando prereqs"
                className="flex items-center gap-1 rounded-md bg-foreground px-2.5 py-1 text-[11px] font-semibold text-background hover:opacity-90"
              >
                <Sparkles size={11} /> Auto
              </button>
              <button
                type="button"
                onClick={handleOpenFixPreview}
                disabled={errorCount === 0}
                title={
                  errorCount === 0
                    ? "No hay errores que arreglar"
                    : "Genera un plan de fixes para los errores y muestra preview"
                }
                className={cn(
                  "flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40",
                  errorCount > 0
                    ? "bg-violet-600 text-white hover:bg-violet-700"
                    : "border border-border bg-card text-muted-foreground",
                )}
              >
                <Wand2 size={11} /> Fix ({errorCount})
              </button>

              <span className="mx-1 h-5 w-px bg-border" />

              <IconButton
                icon={Network}
                onClick={() => setShowEdges((v) => !v)}
                tooltip="Mostrar/ocultar flechas de prerequisitos"
                active={showEdges}
              />
              <IconButton
                icon={Columns}
                onClick={() => setShowCompare(true)}
                tooltip="Comparar carreras lado a lado"
              />
              <IconButton
                icon={Undo2}
                onClick={handleUndo}
                disabled={history.length === 0}
                tooltip="Deshacer (Cmd+Z)"
              />
              <IconButton
                icon={RotateCcw}
                onClick={handleReset}
                disabled={placedCount === 0}
                tooltip="Vaciar la malla"
              />

              <span className="mx-1 h-5 w-px bg-border" />

              <button
                type="button"
                onClick={() => void handleSaveState()}
                disabled={saving}
                title="Guardar estado en Neon"
                className={cn(
                  "flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
                  hasUnsavedChanges
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-700 hover:bg-amber-500/15 dark:text-amber-300"
                    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300",
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    hasUnsavedChanges ? "bg-amber-500" : "bg-emerald-500",
                  )}
                />
                <Save size={11} /> {hasUnsavedChanges ? "Guardar" : "Guardado"}
              </button>
              <UserButton />
              <ExportMenu
                onExcel={() => void handleExportExcel()}
                onPdf={async () => {
                  const id = toast.loading("Generando PDF...");
                  try {
                    await exportToPdf(career.label, allCourses, placement);
                    toast.success("PDF descargado", { id });
                  } catch (err) {
                    toast.error(
                      `Error: ${err instanceof Error ? err.message : "desconocido"}`,
                      { id },
                    );
                  }
                }}
              />
              <ThemeToggle />
            </div>
          </div>
          <HintBar />
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-[300px_1fr] gap-2 p-2 lg:gap-3 lg:p-3">
          <aside className="flex min-h-0 flex-col gap-2">
            <CoursePalette
              title={`EEGG (${totalEegg})`}
              courses={eegg}
              droppableId="palette-eegg"
              onEditCourse={setEditingCode}
              onHover={setHoveredCode}
              highlightFor={highlightFor}
              accent="orange"
              totalCount={totalEegg}
            />
            <CoursePalette
              title={`Especificos (${totalSpecifics})`}
              courses={specifics}
              droppableId="palette-specifics"
              onEditCourse={setEditingCode}
              onHover={setHoveredCode}
              highlightFor={highlightFor}
              accent="green"
              totalCount={totalSpecifics}
            />
            <CoursePalette
              title={`Especialidad (${totalSpecialty})`}
              courses={specialty}
              droppableId="palette-specialty"
              onEditCourse={setEditingCode}
              onHover={setHoveredCode}
              highlightFor={highlightFor}
              accent="blue"
              totalCount={totalSpecialty}
            />
            <IssuesPanel
              warnings={warnings}
              courses={allCourses}
              placement={placement}
              onApplyProposal={handleApplyProposal}
              onHoverProposal={setProposalHoverCodes}
              onLocate={handleLocate}
            />
          </aside>

          <main
            id="malla-export"
            ref={gridRef}
            className="relative min-h-0 overflow-auto scroll-smooth rounded-xl border border-border bg-card/30 p-2"
          >
            <div
              className="grid h-full gap-2.5"
              style={{
                gridTemplateColumns: "repeat(10, minmax(280px, 1fr))",
                minWidth: "2800px",
              }}
            >
              {CYCLES.map((cycle) => (
                <CycleColumn
                  key={cycle}
                  cycle={cycle}
                  courses={coursesInCycle(cycle)}
                  analysis={analysis[cycle - 1]}
                  cumulativeCredits={analysis
                    .slice(0, cycle)
                    .reduce((sum, item) => sum + item.credits, 0)}
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
        onSave={handleSaveCourse}
      />

      {showCompare && (
        <CompareView
          data={mergedData}
          currentSlug={careerSlug}
          currentPlacement={placement}
          onClose={() => setShowCompare(false)}
        />
      )}

      {showImport && (
        <ImportDialog
          onConfirm={handleImportConfirm}
          onClose={() => setShowImport(false)}
        />
      )}

      {fixPreview && (
        <FixPreviewDialog
          preview={fixPreview}
          onConfirm={handleConfirmFixPreview}
          onCancel={() => setFixPreview(null)}
        />
      )}
    </DndContext>
  );
}

function FixPreviewDialog({
  preview,
  onConfirm,
  onCancel,
}: {
  preview: {
    proposals: Proposal[];
    remainingErrors: Warning[];
    iterations: number;
    reason: "converged" | "max-iterations" | "no-progress";
    beforeWarnings: number;
  };
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onConfirm();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, onConfirm]);

  const remaining = preview.remainingErrors.length;
  const nothingToApply = preview.proposals.length === 0;
  const reasonLabel = nothingToApply
    ? "El solver no encontro ningun cambio que mejore la malla"
    : {
        converged: "Solucion completa encontrada",
        "max-iterations": "Limite de iteraciones alcanzado",
        "no-progress": "No se encontraron mas mejoras posibles",
      }[preview.reason];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/15 text-violet-500">
              <Wand2 size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold">Plan de correcciones</h3>
              <p className="text-[11px] text-muted-foreground">
                Preview · revisa antes de aplicar
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cerrar"
            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X size={14} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <BigStat label="Cambios" value={String(preview.proposals.length)} tone="violet" />
          <BigStat
            label="Issues antes"
            value={String(preview.beforeWarnings)}
            tone="amber"
          />
          <BigStat
            label="Errors restantes"
            value={String(remaining)}
            tone={remaining === 0 ? "emerald" : "rose"}
          />
        </div>

        <div className="rounded-md border border-border bg-input/10 px-2 py-1.5 text-[10px] text-muted-foreground">
          {reasonLabel} · {preview.iterations} iteracion
          {preview.iterations !== 1 ? "es" : ""}
        </div>

        {nothingToApply ? (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs leading-snug">
            <div className="font-semibold text-amber-700 dark:text-amber-400">
              Nada que aplicar automaticamente
            </div>
            <p className="mt-1 text-muted-foreground">
              Los issues actuales (sobrecargas o restricciones del catalogo) no tienen
              una solucion automatica que no genere otros problemas. Revisa abajo y
              ajusta manualmente si quieres.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 overflow-y-auto rounded-md border border-border bg-input/20 p-2">
            {preview.proposals.map((p, i) => (
              <div key={i} className="flex items-start gap-2 rounded p-1.5 text-xs">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-violet-500/15 font-mono text-[9px] font-bold text-violet-600 dark:text-violet-400">
                  {i + 1}
                </span>
                <div className="flex-1">
                  <div className="font-medium leading-tight">{p.label}</div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                    {p.rationale}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {remaining > 0 && (
          <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-2 text-[11px] leading-tight">
            <div className="mb-1 font-semibold text-rose-600 dark:text-rose-400">
              {remaining} error{remaining !== 1 ? "es" : ""} no resueltos:
            </div>
            <ul className="ml-4 list-disc text-muted-foreground">
              {preview.remainingErrors.slice(0, 4).map((e, i) => (
                <li key={i} className="leading-snug">
                  {e.message}
                </li>
              ))}
              {preview.remainingErrors.length > 4 && (
                <li className="italic">
                  +{preview.remainingErrors.length - 4} mas
                </li>
              )}
            </ul>
            <div className="mt-1.5 text-[10px] italic text-muted-foreground">
              Requieren ajuste manual
            </div>
          </div>
        )}

        <div className="flex justify-between gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent"
          >
            {nothingToApply ? "Cerrar" : "Cancelar"}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={nothingToApply}
            className="flex items-center gap-1.5 rounded-md bg-violet-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Wand2 size={11} /> Aplicar {preview.proposals.length} cambio
            {preview.proposals.length !== 1 ? "s" : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

function BigStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "violet" | "amber" | "emerald" | "rose";
}) {
  const toneStyles = {
    violet: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
    amber: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    emerald: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    rose: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  };
  return (
    <div className={cn("rounded-md p-2 text-center", toneStyles[tone])}>
      <div className="text-[9px] font-medium uppercase tracking-wider opacity-70">
        {label}
      </div>
      <div className="mt-0.5 font-mono text-base font-bold tabular-nums">
        {value}
      </div>
    </div>
  );
}

function HintBar() {
  return (
    <div className="hidden border-t border-border/60 bg-muted/30 px-4 py-1 text-[10px] text-muted-foreground md:flex md:items-center md:gap-4">
      <span>
        <kbd className="rounded border border-border bg-card px-1 font-mono text-[9px]">
          Hover
        </kbd>{" "}
        resalta prerreqs y cursos dependientes
      </span>
      <span className="opacity-40">·</span>
      <span>
        <span className="inline-block h-2 w-2 rounded-full bg-sky-500" /> prerreqs ·{" "}
        <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />{" "}
        dependientes
      </span>
      <span className="opacity-40">·</span>
      <span>Arrastra a un panel para quitarlo del ciclo</span>
      <span className="opacity-40">·</span>
      <span>
        <kbd className="rounded border border-border bg-card px-1 font-mono text-[9px]">
          Cmd+Z
        </kbd>{" "}
        deshacer ·{" "}
        <kbd className="rounded border border-border bg-card px-1 font-mono text-[9px]">
          Esc
        </kbd>{" "}
        cierra · Auto-guardado
      </span>
      <span className="opacity-40">·</span>
      <span>
        <Sparkles className="inline" size={9} /> Click warning →
        propuestas auto-fix
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

function IconButton({
  icon: Icon,
  onClick,
  tooltip,
  active,
  disabled,
  variant,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  onClick: () => void;
  tooltip: string;
  active?: boolean;
  disabled?: boolean;
  variant?: "dashed" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={tooltip}
      aria-label={tooltip}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-md border transition disabled:cursor-not-allowed disabled:opacity-40",
        variant === "dashed" &&
          "border-dashed border-border bg-card text-muted-foreground hover:border-emerald-500/40 hover:text-foreground",
        variant === "danger" &&
          "border-rose-500/30 bg-rose-500/5 text-rose-600 hover:bg-rose-500/10 dark:text-rose-400",
        !variant &&
          (active
            ? "border-violet-500/50 bg-violet-500/10 text-violet-700 dark:text-violet-300"
            : "border-border bg-card hover:bg-accent"),
      )}
    >
      <Icon size={13} />
    </button>
  );
}

function ExportMenu({
  onExcel,
  onPdf,
}: {
  onExcel: () => void;
  onPdf: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ left: number; top: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      const menu = document.getElementById("export-menu-portal");
      if (menu?.contains(target)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      window.addEventListener("mousedown", onClick);
      window.addEventListener("keydown", onKey);
    }
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setCoords({ left: rect.right - 176, top: rect.bottom + 6 });
    setOpen(true);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        title="Exportar malla"
        className="flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700"
      >
        <Download size={11} /> Exportar
        <ChevronDown size={10} className={cn("transition", open && "rotate-180")} />
      </button>
      {open && coords && (
        <div
          id="export-menu-portal"
          style={{
            position: "fixed",
            left: coords.left,
            top: coords.top,
            zIndex: 100,
          }}
          className="w-44 overflow-hidden rounded-md border border-border bg-card shadow-xl"
        >
          <button
            type="button"
            onClick={() => {
              onExcel();
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium hover:bg-accent"
          >
            <FileSpreadsheet size={13} className="text-emerald-600" />
            <div>
              <div>Excel (.xlsx)</div>
              <div className="text-[10px] text-muted-foreground">Tabla por ciclo</div>
            </div>
          </button>
          <div className="h-px bg-border" />
          <button
            type="button"
            onClick={() => {
              void onPdf();
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium hover:bg-accent"
          >
            <Download size={13} className="text-rose-600" />
            <div>
              <div>PDF imagen</div>
              <div className="text-[10px] text-muted-foreground">Render visual</div>
            </div>
          </button>
        </div>
      )}
    </>
  );
}
