"use client";

import { useEffect, useState } from "react";
import type { Course } from "@/lib/types";

interface Props {
  course: Course | null;
  allCourses: Course[];
  onClose: () => void;
  onSave: (code: string, prereqs: string[]) => void;
}

export function PrereqEditor({ course, allCourses, onClose, onSave }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    if (course) setSelected(course.prereqs);
  }, [course]);

  if (!course) return null;

  const candidates = allCourses
    .filter((c) => c.code !== course.code)
    .filter((c) => c.name.toLowerCase().includes(filter.toLowerCase()));

  function toggle(name: string) {
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name],
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col gap-3 rounded-lg bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 className="text-base font-bold">Editar prerrequisitos</h3>
          <p className="text-xs text-slate-600">{course.name}</p>
        </div>
        <input
          type="text"
          placeholder="Buscar curso..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
        />
        <div className="flex flex-col gap-1 overflow-y-auto rounded border border-slate-200 p-2">
          {candidates.map((c) => (
            <label
              key={c.code}
              className="flex cursor-pointer items-center gap-2 rounded p-1.5 text-xs hover:bg-slate-50"
            >
              <input
                type="checkbox"
                checked={selected.includes(c.name)}
                onChange={() => toggle(c.name)}
              />
              <span className="font-mono text-[10px] text-slate-500">{c.code}</span>
              <span>{c.name}</span>
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              onSave(course.code, selected);
              onClose();
            }}
            className="rounded bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
