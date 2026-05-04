"use client";

import { AlertCircle, AlertTriangle, ChevronRight, Info, Sparkles } from "lucide-react";
import { useState } from "react";
import type { Warning } from "@/lib/algorithms";
import { type Proposal, proposalsForWarning } from "@/lib/proposals";
import type { Course, Placement } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  warnings: Warning[];
  courses: Course[];
  placement: Placement;
  onApplyProposal: (proposal: Proposal) => void;
  onHoverProposal: (codes: string[] | null) => void;
}

const levelStyles = {
  error: { icon: AlertCircle, color: "text-rose-500", bg: "bg-rose-500/5" },
  warning: { icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/5" },
  info: { icon: Info, color: "text-sky-500", bg: "bg-sky-500/5" },
} as const;

export function IssuesPanel({
  warnings,
  courses,
  placement,
  onApplyProposal,
  onHoverProposal,
}: Props) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const errorCount = warnings.filter((w) => w.level === "error").length;
  const warningCount = warnings.filter((w) => w.level === "warning").length;
  const hasErrors = errorCount > 0;

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col rounded-xl border bg-card transition",
        hasErrors
          ? "flex-[1.6] border-rose-500/40 shadow-[0_0_0_1px_oklch(0.62_0.21_25/0.15)]"
          : warningCount > 0
            ? "border-amber-500/30"
            : "border-border",
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between border-b border-border/60 px-3 py-2",
          hasErrors && "bg-rose-500/5",
        )}
      >
        <div className="flex items-center gap-2">
          <h3 className="text-[11px] font-bold uppercase tracking-wider">
            Diagnostico
          </h3>
          {hasErrors && (
            <span className="rounded-full bg-rose-500/15 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-rose-600 dark:text-rose-400">
              {errorCount} {errorCount === 1 ? "error" : "errores"}
            </span>
          )}
          {warningCount > 0 && (
            <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-amber-600 dark:text-amber-400">
              {warningCount} warn
            </span>
          )}
        </div>
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 font-mono text-[10px] tabular-nums",
            warnings.length === 0
              ? "bg-emerald-500/10 text-emerald-600"
              : "bg-accent text-accent-foreground",
          )}
        >
          {warnings.length}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
        {warnings.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-4">
            <p className="text-center text-[11px] italic text-emerald-600">
              ✓ Malla valida, sin problemas
            </p>
          </div>
        ) : (
          warnings.map((w, i) => {
            const { icon: Icon, color, bg } = levelStyles[w.level];
            const proposals = proposalsForWarning(w, { courses, placement });
            const isExpanded = expandedIdx === i;
            return (
              <div
                key={i}
                className={cn(
                  "rounded-md border transition",
                  isExpanded
                    ? cn(bg, w.level === "error" ? "border-rose-500/40" : "border-amber-500/40")
                    : "border-transparent",
                )}
              >
                <button
                  type="button"
                  onClick={() => setExpandedIdx(isExpanded ? null : i)}
                  className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-[11px] leading-tight hover:bg-accent/50"
                >
                  <Icon size={12} className={cn("mt-0.5 shrink-0", color)} />
                  <span className="flex-1">{w.message}</span>
                  {proposals.length > 0 && (
                    <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-violet-500/15 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-violet-600 dark:text-violet-400">
                      <Sparkles size={8} /> {proposals.length}
                    </span>
                  )}
                  {proposals.length > 0 && (
                    <ChevronRight
                      size={11}
                      className={cn(
                        "mt-0.5 shrink-0 text-muted-foreground transition-transform",
                        isExpanded && "rotate-90",
                      )}
                    />
                  )}
                </button>
                {isExpanded && proposals.length > 0 && (
                  <ProposalList
                    proposals={proposals}
                    onApply={(p) => {
                      onApplyProposal(p);
                      setExpandedIdx(null);
                    }}
                    onHover={onHoverProposal}
                  />
                )}
                {isExpanded && proposals.length === 0 && (
                  <p className="px-2 pb-2 pl-7 text-[10px] italic text-muted-foreground">
                    Sin propuestas automaticas. Ajusta manualmente.
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function ProposalList({
  proposals,
  onApply,
  onHover,
}: {
  proposals: Proposal[];
  onApply: (p: Proposal) => void;
  onHover: (codes: string[] | null) => void;
}) {
  return (
    <div className="flex flex-col gap-1 px-2 pb-2 pt-0.5">
      {proposals.map((p, j) => (
        <button
          key={j}
          type="button"
          onClick={() => onApply(p)}
          onMouseEnter={() => onHover(p.affectedCodes)}
          onMouseLeave={() => onHover(null)}
          className={cn(
            "group flex items-start gap-2 rounded-md border px-2 py-1.5 text-left text-[11px] leading-tight transition",
            p.recommended
              ? "border-violet-500/40 bg-violet-500/10 hover:bg-violet-500/20"
              : "border-border bg-card hover:bg-accent",
          )}
        >
          <Sparkles
            size={11}
            className={cn(
              "mt-0.5 shrink-0",
              p.recommended ? "text-violet-500" : "text-muted-foreground/60",
            )}
          />
          <div className="flex-1">
            <div className="font-medium">{p.label}</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span>{p.rationale}</span>
              {p.recommended && (
                <span className="rounded-full bg-violet-500/20 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300">
                  recomendado
                </span>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
