# src/lib — layer map

| Folder | Layer | Rule |
|---|---|---|
| `domain/` | Domain | Pure types and logic; no Next.js, no DB, no framework |
| `data/` | Data | Neon SQL + localStorage + import/export; imports from `domain/` only |

Import rule: `app/components -> data or domain <- data`. Domain imports nothing from `data/`, Next.js, or any external I/O.

- `domain/types.ts` — shared TypeScript interfaces (`Course`, `Career`, `MallaState`, `Placement`, …)
- `domain/utils.ts` — pure helpers (`cn`, `normalizeName`, `findCourseByName`, `validatePlacement`, …)
- `domain/algorithms.ts` — cycle analysis, issue detection, graph traversal
- `domain/solver.ts` — iterative issue solver (greedy proposal picker)
- `domain/proposals.ts` — proposal generators for solver and UI

- `data/db.ts` — Neon serverless SQL client and DDL bootstrap
- `data/storage.ts` — localStorage persistence (placement, overrides, stateId)
- `data/import.ts` — Excel import via `xlsx` (sheet parsing, column detection)
- `data/export.ts` — Excel and PDF export via `xlsx-js-style` and `jspdf`
