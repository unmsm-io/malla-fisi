"use client";

import { AlertCircle, AlertTriangle, ChevronRight, Info, Sparkles } from "lucide-react";
import { useState } from "react";
import type { Warning } from "@/lib/algorithms";
import {
  type Proposal,
  proposalsForWarning,
} from "@/lib/proposals";
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
      <div className="mt-2 flex max-h-[200px] flex-col gap-1 overflow-y-auto pr-0.5">
        {warnings.length === 0 ? (
          <p className="py-2 text-center text-[11px] italic text-emerald-600">
            Sin problemas
          </p>
        ) : (
          warnings.map((w, i) => {
            const { icon: Icon, color, bg } = levelStyles[w.level];
            const proposals = proposalsForWarning(w, { courses, placement });
            const isExpanded = expandedIdx === i;
            return (
              <div
                key={i}
                className={cn("rounded transition", isExpanded && bg)}
              >
                <button
                  type="button"
                  onClick={() => setExpandedIdx(isExpanded ? null : i)}
                  className="flex w-full items-start gap-1.5 rounded p-1.5 text-left text-[11px] leading-tight hover:bg-accent/50"
                >
                  <Icon size={11} className={cn("mt-0.5 shrink-0", color)} />
                  <span className="flex-1">{w.message}</span>
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
                  <p className="px-2 pb-2 text-[10px] italic text-muted-foreground">
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
    <div className="flex flex-col gap-1 px-2 pb-2">
      {proposals.map((p, j) => (
        <button
          key={j}
          type="button"
          onClick={() => onApply(p)}
          onMouseEnter={() => onHover(p.affectedCodes)}
          onMouseLeave={() => onHover(null)}
          className={cn(
            "group flex items-start gap-1.5 rounded border px-2 py-1.5 text-left text-[10px] leading-tight transition",
            p.recommended
              ? "border-violet-500/40 bg-violet-500/5 hover:bg-violet-500/10"
              : "border-border bg-card hover:bg-accent",
          )}
        >
          <Sparkles
            size={10}
            className={cn(
              "mt-0.5 shrink-0",
              p.recommended ? "text-violet-500" : "text-muted-foreground/60",
            )}
          />
          <div className="flex-1">
            <div className="font-medium">{p.label}</div>
            <div className="mt-0.5 text-[9px] text-muted-foreground">
              {p.rationale}
              {p.recommended && (
                <span className="ml-1 rounded-full bg-violet-500/20 px-1.5 py-0.5 text-[8px] font-semibold text-violet-700 dark:text-violet-300">
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
