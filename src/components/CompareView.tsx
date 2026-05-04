"use client";

import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Equal,
  Info,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { autoOrganize, defaultPlacementFromExcel } from "@/lib/algorithms";
import type { Course, CoursesData, Placement } from "@/lib/types";
import { CATEGORY_STYLES, ROMAN, cn, normalizeName } from "@/lib/utils";

interface Props {
  data: CoursesData;
  currentSlug: string;
  currentPlacement: Placement;
  onClose: () => void;
}

interface Snap {
  slug: string;
  label: string;
  courses: Course[];
  placement: Placement;
  byNorm: Map<string, Course>;
}

type Source = "current" | "default" | "auto";

function buildSnap(
  slug: string,
  data: CoursesData,
  source: Source,
  currentPlacement: Placement,
): Snap {
  const career = data.careers[slug];
  const courses = [...career.specifics, ...career.specialty];
  let placement: Placement;
  if (source === "current") placement = currentPlacement;
  else if (source === "default") placement = defaultPlacementFromExcel(courses);
  else placement = autoOrganize(courses);
  const byNorm = new Map(courses.map((c) => [normalizeName(c.name), c]));
  return { slug, label: career.label, courses, placement, byNorm };
}

type Status = "same" | "diff" | "only-left" | "only-right";

interface Row {
  name: string;
  normName: string;
  category: Course["category"];
  leftCycle?: number;
  rightCycle?: number;
  status: Status;
  delta: number | null;
}

export function CompareView({
  data,
  currentSlug,
  currentPlacement,
  onClose,
}: Props) {
  const careerSlugs = Object.keys(data.careers);
  const otherSlugs = careerSlugs.filter((s) => s !== currentSlug);

  const [leftSlug, setLeftSlug] = useState(currentSlug);
  const [rightSlug, setRightSlug] = useState(otherSlugs[0] ?? careerSlugs[0]);
  const [leftSource, setLeftSource] = useState<Source>("current");
  const [rightSource, setRightSource] = useState<Source>("default");
  const [filter, setFilter] = useState<Status | "all">("all");
  const [showHelp, setShowHelp] = useState(true);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const left = useMemo(
    () => buildSnap(leftSlug, data, leftSource, currentPlacement),
    [leftSlug, data, leftSource, currentPlacement],
  );
  const right = useMemo(
    () => buildSnap(rightSlug, data, rightSource, currentPlacement),
    [rightSlug, data, rightSource, currentPlacement],
  );

  const rows: Row[] = useMemo(() => {
    const allNames = new Set([
      ...left.byNorm.keys(),
      ...right.byNorm.keys(),
    ]);
    const list: Row[] = [];
    for (const norm of allNames) {
      const lc = left.byNorm.get(norm);
      const rc = right.byNorm.get(norm);
      const leftCycle = lc ? left.placement[lc.code] : undefined;
      const rightCycle = rc ? right.placement[rc.code] : undefined;
      let status: Status;
      let delta: number | null = null;
      if (lc && rc) {
        if (leftCycle === undefined || rightCycle === undefined) {
          status = "diff";
        } else if (leftCycle === rightCycle) {
          status = "same";
        } else {
          status = "diff";
          delta = rightCycle - leftCycle;
        }
      } else if (lc) {
        status = "only-left";
      } else {
        status = "only-right";
      }
      list.push({
        name: lc?.name ?? rc?.name ?? norm,
        normName: norm,
        category: (lc ?? rc)!.category,
        leftCycle,
        rightCycle,
        status,
        delta,
      });
    }
    return list.sort((a, b) => {
      const order: Status[] = ["diff", "only-left", "only-right", "same"];
      const ai = order.indexOf(a.status);
      const bi = order.indexOf(b.status);
      if (ai !== bi) return ai - bi;
      const ac = (a.leftCycle ?? a.rightCycle ?? 99) - (b.leftCycle ?? b.rightCycle ?? 99);
      if (ac !== 0) return ac;
      return a.name.localeCompare(b.name, "es");
    });
  }, [left, right]);

  const counts = useMemo(() => {
    const c = { same: 0, diff: 0, "only-left": 0, "only-right": 0 };
    for (const r of rows) c[r.status]++;
    return c;
  }, [rows]);

  const filtered = filter === "all" ? rows : rows.filter((r) => r.status === filter);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-md">
      <header className="flex items-center justify-between gap-4 border-b border-border bg-card px-4 py-3">
        <div className="min-w-0">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Comparar carreras
          </span>
          <h2 className="text-sm font-bold tracking-tight">
            Curso por curso · diferencias en ciclos
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowHelp((v) => !v)}
            className="flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[11px] font-medium hover:bg-accent"
          >
            <Info size={11} /> {showHelp ? "Ocultar guia" : "Como leer"}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>
      </header>

      {showHelp && (
        <div className="border-b border-border bg-sky-500/5 px-4 py-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-sky-500/15 text-sky-500">
              <Info size={13} />
            </div>
            <div className="flex-1 text-[12px] leading-relaxed">
              <p className="mb-1.5 font-semibold">
                Para que sirve esta vista
              </p>
              <p className="text-muted-foreground">
                Cada fila es <span className="font-medium text-foreground">un curso</span>.
                Las dos columnas centrales muestran en que ciclo aparece en cada
                carrera (un cuadrito iluminado entre 10 ciclos posibles). La
                columna del medio resume la diferencia con un numero{" "}
                <span className="rounded bg-amber-500/15 px-1 font-mono text-amber-700 dark:text-amber-300">
                  +N / -N
                </span>{" "}
                indicando cuantos ciclos se mueve entre carreras, o un{" "}
                <Equal size={11} className="inline text-emerald-500" /> si esta
                igual, o una flecha si solo aparece en una sola carrera.
              </p>
              <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-[11px]">
                <LegendRow color="bg-emerald-500" label="Mismo ciclo en ambas carreras" />
                <LegendRow color="bg-amber-500" label="Diferente ciclo: numero indica el delta" />
                <LegendRow color="bg-sky-500" label="Solo aparece en la carrera izquierda" />
                <LegendRow color="bg-violet-500" label="Solo aparece en la carrera derecha" />
              </div>
              <p className="mt-2 text-[11px] italic text-muted-foreground">
                Util para: detectar si un curso compartido (ej. Programacion II)
                debe ir en distinto ciclo segun la carrera, o ver que cursos son
                exclusivos de cada plan.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/30 px-4 py-2">
        <Selector
          label="Izquierda"
          slug={leftSlug}
          source={leftSource}
          slugs={careerSlugs}
          onSlug={setLeftSlug}
          onSource={setLeftSource}
          data={data}
          isCurrent={leftSlug === currentSlug}
        />
        <ArrowRight size={14} className="text-muted-foreground" />
        <Selector
          label="Derecha"
          slug={rightSlug}
          source={rightSource}
          slugs={careerSlugs}
          onSlug={setRightSlug}
          onSource={setRightSource}
          data={data}
          isCurrent={rightSlug === currentSlug}
        />
        <div className="ml-auto flex items-center gap-1">
          <FilterChip
            label="Todos"
            value={rows.length}
            active={filter === "all"}
            onClick={() => setFilter("all")}
          />
          <FilterChip
            label="Diff ciclo"
            value={counts.diff}
            active={filter === "diff"}
            tone="amber"
            onClick={() => setFilter("diff")}
          />
          <FilterChip
            label={`Solo ${data.careers[leftSlug].label.split(" ").pop()}`}
            value={counts["only-left"]}
            active={filter === "only-left"}
            tone="sky"
            onClick={() => setFilter("only-left")}
          />
          <FilterChip
            label={`Solo ${data.careers[rightSlug].label.split(" ").pop()}`}
            value={counts["only-right"]}
            active={filter === "only-right"}
            tone="violet"
            onClick={() => setFilter("only-right")}
          />
          <FilterChip
            label="Igual"
            value={counts.same}
            active={filter === "same"}
            tone="emerald"
            onClick={() => setFilter("same")}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <div className="grid grid-cols-[1fr_240px_60px_240px] items-center gap-2 border-b border-border pb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          <ColumnHeader
            label="Curso"
            tooltip="Nombre del curso. El punto a la izquierda indica categoria: amarillo=EEGG, azul=Especifico, violeta=Especialidad."
          />
          <ColumnHeader
            label={left.label}
            tooltip={`Barra de 10 ciclos. El cuadro iluminado es el ciclo donde el curso aparece en ${left.label}. "sin colocar" = no esta en ningun ciclo todavia.`}
          />
          <ColumnHeader
            label="Diff"
            center
            tooltip={'Resumen visual: = igual ciclo. +N / -N indica cuantos ciclos despues/antes esta en la derecha respecto a la izquierda. Flecha = solo aparece en un lado.'}
          />
          <ColumnHeader
            label={right.label}
            tooltip={`Barra de 10 ciclos. El cuadro iluminado es el ciclo donde el curso aparece en ${right.label}. "no aplica" = el curso solo existe en la otra carrera.`}
          />
        </div>
        <div className="divide-y divide-border/50">
          {filtered.map((row) => (
            <RowItem key={row.normName} row={row} />
          ))}
          {filtered.length === 0 && (
            <p className="py-8 text-center text-xs italic text-muted-foreground">
              Sin cursos en esta categoria
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function RowItem({ row }: { row: Row }) {
  const style = CATEGORY_STYLES[row.category];

  return (
    <div className="grid grid-cols-[1fr_240px_60px_240px] items-center gap-2 py-1.5">
      <div className="flex items-center gap-2 min-w-0">
        <span className={cn("h-2 w-2 shrink-0 rounded-full", style.bg, "border", style.border)} />
        <span className="truncate text-xs font-medium">{row.name}</span>
      </div>
      <CycleBar cycle={row.leftCycle} status={row.status} side="left" />
      <DiffIndicator status={row.status} delta={row.delta} />
      <CycleBar cycle={row.rightCycle} status={row.status} side="right" />
    </div>
  );
}

function CycleBar({
  cycle,
  status,
  side,
}: {
  cycle: number | undefined;
  status: Status;
  side: "left" | "right";
}) {
  if (cycle === undefined) {
    if (
      (side === "left" && status === "only-right") ||
      (side === "right" && status === "only-left")
    ) {
      return (
        <div className="flex items-center justify-center text-[10px] italic text-muted-foreground/60">
          no aplica
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center text-[10px] italic text-amber-600 dark:text-amber-400">
        sin colocar
      </div>
    );
  }
  const cells = Array.from({ length: 10 }, (_, i) => i + 1);
  const tone =
    status === "same"
      ? "bg-emerald-500"
      : status === "diff"
        ? "bg-amber-500"
        : status === "only-left"
          ? "bg-sky-500"
          : "bg-violet-500";
  return (
    <div className="flex items-center gap-px">
      {cells.map((c) => (
        <div
          key={c}
          className={cn(
            "h-3 flex-1 rounded-sm transition",
            c === cycle ? tone : "bg-muted/60",
            c === cycle && "shadow-sm",
          )}
          title={`Ciclo ${ROMAN[c - 1]}`}
        >
          {c === cycle && (
            <span className="block text-center text-[8px] font-bold leading-3 text-background mix-blend-difference">
              {ROMAN[c - 1]}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function DiffIndicator({ status, delta }: { status: Status; delta: number | null }) {
  if (status === "same")
    return (
      <span className="flex items-center justify-center text-emerald-500">
        <Equal size={12} />
      </span>
    );
  if (status === "diff" && delta !== null) {
    const Icon = delta > 0 ? ArrowDown : ArrowUp;
    return (
      <span
        className={cn(
          "flex items-center justify-center gap-0.5 font-mono text-[10px] tabular-nums",
          delta > 0 ? "text-amber-600 dark:text-amber-400" : "text-amber-600 dark:text-amber-400",
        )}
      >
        <Icon size={10} />
        {delta > 0 ? `+${delta}` : delta}
      </span>
    );
  }
  if (status === "only-left")
    return (
      <span className="flex items-center justify-center text-sky-500">
        <ArrowRight size={12} className="rotate-180" />
      </span>
    );
  if (status === "only-right")
    return (
      <span className="flex items-center justify-center text-violet-500">
        <ArrowRight size={12} />
      </span>
    );
  return null;
}

function Selector({
  label,
  slug,
  source,
  slugs,
  onSlug,
  onSource,
  data,
  isCurrent,
}: {
  label: string;
  slug: string;
  source: Source;
  slugs: string[];
  onSlug: (s: string) => void;
  onSource: (s: Source) => void;
  data: CoursesData;
  isCurrent: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <select
        value={slug}
        onChange={(e) => onSlug(e.target.value)}
        className="rounded-md border border-border bg-card px-2 py-1 text-xs font-medium outline-none focus:ring-2 focus:ring-ring/20"
      >
        {slugs.map((s) => (
          <option key={s} value={s}>
            {data.careers[s].label}
          </option>
        ))}
      </select>
      <select
        value={source}
        onChange={(e) => onSource(e.target.value as Source)}
        className="rounded-md border border-border bg-card px-2 py-1 text-[10px] uppercase tracking-wider outline-none focus:ring-2 focus:ring-ring/20"
      >
        {isCurrent && <option value="current">Tu malla</option>}
        <option value="default">Plan oficial</option>
        <option value="auto">Auto</option>
      </select>
    </div>
  );
}

function FilterChip({
  label,
  value,
  active,
  tone,
  onClick,
}: {
  label: string;
  value: number;
  active: boolean;
  tone?: "amber" | "sky" | "violet" | "emerald";
  onClick: () => void;
}) {
  const toneStyles = {
    amber: active ? "bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300" : "",
    sky: active ? "bg-sky-500/15 border-sky-500/40 text-sky-700 dark:text-sky-300" : "",
    violet: active
      ? "bg-violet-500/15 border-violet-500/40 text-violet-700 dark:text-violet-300"
      : "",
    emerald: active
      ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
      : "",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-medium transition",
        active
          ? tone
            ? toneStyles[tone]
            : "bg-foreground text-background border-foreground"
          : "border-border bg-card text-muted-foreground hover:bg-accent",
      )}
    >
      <span>{label}</span>
      <span className="font-mono tabular-nums">{value}</span>
    </button>
  );
}

function ColumnHeader({
  label,
  tooltip,
  center,
}: {
  label: string;
  tooltip: string;
  center?: boolean;
}) {
  return (
    <span
      className={cn(
        "group relative inline-flex items-center gap-1 truncate",
        center && "justify-center",
      )}
    >
      <span className="truncate">{label}</span>
      <span className="relative inline-flex">
        <Info
          size={10}
          className="cursor-help text-muted-foreground/60 transition hover:text-foreground"
        />
        <span className="pointer-events-none invisible absolute left-1/2 top-5 z-10 w-56 -translate-x-1/2 rounded-md border border-border bg-popover bg-card px-2 py-1.5 text-[10px] font-normal normal-case leading-snug tracking-normal text-foreground opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100">
          {tooltip}
        </span>
      </span>
    </span>
  );
}

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", color)} />
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}
