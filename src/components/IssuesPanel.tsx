"use client";

import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import type { Warning } from "@/lib/algorithms";
import { cn } from "@/lib/utils";

interface Props {
  warnings: Warning[];
}

const levelStyles = {
  error: { icon: AlertCircle, color: "text-rose-500" },
  warning: { icon: AlertTriangle, color: "text-amber-500" },
  info: { icon: Info, color: "text-sky-500" },
} as const;

export function IssuesPanel({ warnings }: Props) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Diagnostico
        </h3>
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 font-mono text-[10px] tabular-nums",
            warnings.length === 0
              ? "bg-emerald-500/10 text-emerald-600"
              : "bg-accent text-accent-foreground",
          )}
        >
          {warnings.length} {warnings.length === 1 ? "issue" : "issues"}
        </span>
      </div>
      <div className="mt-2 flex max-h-[140px] flex-col gap-1 overflow-y-auto pr-0.5">
        {warnings.length === 0 ? (
          <p className="py-2 text-center text-[11px] italic text-emerald-600">
            Sin problemas detectados
          </p>
        ) : (
          warnings.map((w, i) => {
            const { icon: Icon, color } = levelStyles[w.level];
            return (
              <div
                key={i}
                className="flex items-start gap-1.5 rounded p-1.5 text-[11px] leading-tight hover:bg-accent/50"
              >
                <Icon size={11} className={cn("mt-0.5 shrink-0", color)} />
                <span>{w.message}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
