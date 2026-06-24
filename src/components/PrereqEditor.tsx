"use client";

import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { Course } from "@/lib/domain/types";
import { cn } from "@/lib/domain/utils";

interface Props {
  course: Course | null;
  allCourses: Course[];
  onClose: () => void;
  onSave: (code: string, nextCode: string, prereqs: string[]) => void;
}

export function PrereqEditor({ course, allCourses, onClose, onSave }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [nextCode, setNextCode] = useState("");

  useEffect(() => {
    if (course) {
      setSelected(course.prereqs);
      setFilter("");
      setNextCode(course.code);
    }
  }, [course]);

  useEffect(() => {
    if (!course) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [course, onClose]);

  if (!course) return null;

  const candidates = allCourses
    .filter((c) => c.code !== course.code)
    .filter((c) => c.name.toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  function toggle(name: string) {
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name],
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Editar curso
            </span>
            <h3 className="mt-0.5 text-base font-bold leading-tight">{course.name}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            <X size={15} />
          </button>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Codigo
          </span>
          <input
            type="text"
            value={nextCode}
            onChange={(e) => setNextCode(e.target.value)}
            className="rounded-md border border-border bg-input/30 px-3 py-2 font-mono text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
          />
        </label>

        <div className="relative">
          <Search
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            placeholder="Buscar curso..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full rounded-md border border-border bg-input/30 py-2 pl-8 pr-3 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
          />
        </div>

        <div className="flex flex-col gap-0.5 overflow-y-auto rounded-md border border-border bg-input/20 p-1">
          {candidates.length === 0 ? (
            <p className="py-6 text-center text-xs italic text-muted-foreground">
              Sin resultados
            </p>
          ) : (
            candidates.map((c) => {
              const isSelected = selected.includes(c.name);
              return (
                <label
                  key={c.code}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs transition",
                    isSelected
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent/50",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggle(c.name)}
                    className="accent-foreground"
                  />
                  <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                    {c.code}
                  </span>
                  <span className="truncate">{c.name}</span>
                </label>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-[11px] text-muted-foreground">
            {selected.length} seleccionado{selected.length !== 1 ? "s" : ""}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                onSave(course.code, nextCode, selected);
                onClose();
              }}
              className="rounded-md bg-foreground px-3 py-1.5 text-xs font-semibold text-background hover:opacity-90"
            >
              Guardar cambios
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
