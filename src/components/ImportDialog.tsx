"use client";

import { AlertTriangle, CheckCircle2, FileSpreadsheet, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ImportResult } from "@/lib/data/import";
import { importExcel } from "@/lib/data/import";
import { cn } from "@/lib/domain/utils";

interface Props {
  onConfirm: (result: ImportResult) => void;
  onClose: () => void;
}

export function ImportDialog({ onConfirm, onClose }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState("");
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleFile(f: File) {
    setFile(f);
    setError(null);
    setParsing(true);
    setResult(null);
    const baseLabel =
      label || f.name.replace(/\.xlsx?$/i, "").replace(/[_-]/g, " ");
    setLabel(baseLabel);
    try {
      const res = await importExcel(f, baseLabel);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error parseando archivo");
    } finally {
      setParsing(false);
    }
  }

  async function reparseWithNewLabel(newLabel: string) {
    setLabel(newLabel);
    if (file && newLabel) {
      try {
        const res = await importExcel(file, newLabel);
        setResult(res);
      } catch {}
    }
  }

  const total = result ? result.career.specifics.length + result.career.specialty.length : 0;
  const sample = useMemo(() => {
    if (!result) return [];
    return [
      ...result.career.specifics.slice(0, 4),
      ...result.career.specialty.slice(0, 4),
    ];
  }, [result]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-xl flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-500">
              <FileSpreadsheet size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold">Importar carrera desde Excel</h3>
              <p className="text-[11px] text-muted-foreground">
                Sube un .xlsx, revisa el preview, y agrega como nueva carrera
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X size={14} />
          </button>
        </div>

        {!result && !parsing && !error && (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Nombre de la carrera (opcional)
              </span>
              <input
                type="text"
                value={label}
                placeholder="Ej. Ingenieria de Software"
                onChange={(e) => setLabel(e.target.value)}
                className="rounded-md border border-border bg-input/30 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
              />
            </label>

            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/20 p-8 transition hover:border-emerald-500/40 hover:bg-emerald-500/5">
              <FileSpreadsheet size={32} className="text-muted-foreground" />
              <span className="text-sm font-medium">Click para seleccionar .xlsx</span>
              <span className="text-[11px] text-muted-foreground">
                Detecta hojas con columnas: Asignatura, Ciclo, Codigo, Prerrequisitos
              </span>
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </label>

            <div className="rounded-md border border-border bg-input/10 p-2.5 text-[11px] leading-snug text-muted-foreground">
              <span className="font-semibold text-foreground">Formato esperado:</span>{" "}
              cada fila un curso con minimo <code className="rounded bg-card px-1">Asignatura</code>{" "}
              y <code className="rounded bg-card px-1">Ci.</code> (ciclo). Opcional:{" "}
              <code className="rounded bg-card px-1">Codigo</code>,{" "}
              <code className="rounded bg-card px-1">Creditos</code>,{" "}
              <code className="rounded bg-card px-1">Prerrequisitos</code>,{" "}
              <code className="rounded bg-card px-1">Area</code>. Compatible con
              templates EPIA / FINAL.
            </div>
          </div>
        )}

        {parsing && (
          <div className="flex flex-col items-center gap-2 py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
            <p className="text-xs text-muted-foreground">Parseando archivo...</p>
          </div>
        )}

        {error && (
          <div className="rounded-md border border-rose-500/40 bg-rose-500/5 p-3 text-xs">
            <div className="flex items-start gap-2">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-rose-500" />
              <div>
                <div className="font-semibold text-rose-700 dark:text-rose-400">
                  No se pudo importar
                </div>
                <p className="mt-1 text-muted-foreground">{error}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setFile(null);
                setError(null);
                setResult(null);
              }}
              className="mt-3 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent"
            >
              Probar otro archivo
            </button>
          </div>
        )}

        {result && (
          <>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Nombre de la carrera
              </span>
              <input
                type="text"
                value={label}
                onChange={(e) => reparseWithNewLabel(e.target.value)}
                className="rounded-md border border-border bg-input/30 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
              />
            </label>

            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2.5 text-xs">
              <div className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 size={13} />
                Hoja "{result.sourceSheet}" parseada
              </div>
              <div className="mt-1.5 grid grid-cols-2 gap-1 text-[11px] text-muted-foreground">
                <span>
                  Total cursos:{" "}
                  <span className="font-bold text-foreground">{total}</span>
                </span>
                <span>
                  Filas leidas:{" "}
                  <span className="font-bold text-foreground">{result.totalRows}</span>
                </span>
                <span>
                  Especificos:{" "}
                  <span className="font-bold text-foreground">
                    {result.career.specifics.length}
                  </span>
                </span>
                <span>
                  Especialidad:{" "}
                  <span className="font-bold text-foreground">
                    {result.career.specialty.length}
                  </span>
                </span>
              </div>
            </div>

            <div className="rounded-md border border-border bg-input/10 p-2.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Columnas detectadas
              </div>
              <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                {result.detectedColumns.map((c) => (
                  <div key={c.field} className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "h-1.5 w-1.5 shrink-0 rounded-full",
                        c.header ? "bg-emerald-500" : "bg-muted-foreground/40",
                      )}
                    />
                    <span className="font-medium">{c.field}:</span>
                    <span className="truncate text-muted-foreground">
                      {c.header ? `"${c.header}"` : "no encontrada"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1 overflow-y-auto rounded-md border border-border bg-input/10 p-2">
              <div className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Sample (primeros 8 cursos)
              </div>
              {sample.map((c) => (
                <div
                  key={c.code}
                  className="flex items-center gap-2 rounded p-1.5 text-[11px]"
                >
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 font-mono text-[9px] tabular-nums",
                      c.category === "EEGG" &&
                        "bg-amber-500/15 text-amber-700 dark:text-amber-300",
                      c.category === "ESPECIFICO" &&
                        "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
                      c.category === "ESPECIALIDAD" &&
                        "bg-sky-500/15 text-sky-700 dark:text-sky-300",
                    )}
                  >
                    C{c.defaultCycle}
                  </span>
                  <span className="flex-1 truncate font-medium">{c.name}</span>
                  <span className="font-mono text-[9px] text-muted-foreground">
                    {c.code}
                  </span>
                  <span className="text-[9px] text-muted-foreground">
                    {c.cred} credito{c.cred !== 1 ? "s" : ""}
                  </span>
                </div>
              ))}
            </div>

            {result.warnings.length > 0 && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5 text-[11px]">
                <div className="flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-400">
                  <AlertTriangle size={12} />
                  {result.warnings.length} aviso(s)
                </div>
                <ul className="ml-4 mt-1 list-disc text-muted-foreground">
                  {result.warnings.slice(0, 3).map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                  {result.warnings.length > 3 && (
                    <li className="italic">+{result.warnings.length - 3} mas</li>
                  )}
                </ul>
              </div>
            )}

            <div className="flex justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  setResult(null);
                }}
                className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent"
              >
                Otro archivo
              </button>
              <button
                type="button"
                onClick={() => onConfirm(result)}
                disabled={!label.trim()}
                className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <CheckCircle2 size={11} /> Importar {total} cursos
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
