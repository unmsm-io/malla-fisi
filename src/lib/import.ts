import type { Career, Course } from "./types";
import { normalizeName } from "./utils";

export interface ImportResult {
  career: Career;
  warnings: string[];
  sourceSheet: string;
  detectedColumns: { field: string; header: string | null }[];
  totalRows: number;
}

interface ColumnMap {
  name: number;
  cycle: number;
  ht: number;
  hp: number;
  hl: number;
  th: number;
  cred: number;
  prereqs: number;
  code: number;
  category: number;
}

function findColumnIndex(headers: string[], aliases: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const norm = normalizeName(headers[i] ?? "");
    if (aliases.some((a) => norm === normalizeName(a))) return i;
  }
  for (let i = 0; i < headers.length; i++) {
    const norm = normalizeName(headers[i] ?? "");
    if (aliases.some((a) => norm.includes(normalizeName(a)))) return i;
  }
  return -1;
}

function buildColumnMap(headers: string[]): ColumnMap | null {
  const map: ColumnMap = {
    name: findColumnIndex(headers, ["asignatura", "nombre", "curso"]),
    cycle: findColumnIndex(headers, ["ci.", "ciclo", "ci"]),
    ht: findColumnIndex(headers, ["ht"]),
    hp: findColumnIndex(headers, ["hp"]),
    hl: findColumnIndex(headers, ["hl"]),
    th: findColumnIndex(headers, ["th"]),
    cred: findColumnIndex(headers, ["cred", "creditos"]),
    prereqs: findColumnIndex(headers, ["prerrequisitos", "prerrequisito"]),
    code: findColumnIndex(headers, ["codigo", "code"]),
    category: findColumnIndex(headers, ["area", "categoria"]),
  };
  if (map.name === -1 || map.cycle === -1) return null;
  return map;
}

function parsePrereqs(s: string): string[] {
  if (!s) return [];
  const t = String(s).trim();
  if (!t || normalizeName(t) === "NINGUNO") return [];
  return t.split(/[;\n]/).map((p) => p.trim()).filter(Boolean);
}

function classifyCategory(raw: string): Course["category"] {
  const norm = normalizeName(raw ?? "");
  if (norm.includes("EEGG") || norm.includes("ESTUDIOS GENERALES")) return "EEGG";
  if (norm.includes("ESPECIALIDAD")) return "ESPECIALIDAD";
  if (norm.includes("ESPECIFICO")) return "ESPECIFICO";
  return "ESPECIALIDAD";
}

function parseSheet(rows: unknown[][], sheetName: string): {
  courses: Course[];
  warnings: string[];
  headers: string[];
  map: ColumnMap;
  totalRows: number;
} | null {
  if (rows.length < 2) return null;
  const headers = (rows[0] ?? []).map((h) => String(h ?? ""));
  const map = buildColumnMap(headers);
  if (!map) return null;

  const courses: Course[] = [];
  const warnings: string[] = [];
  const seenCodes = new Set<string>();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const name = String(row[map.name] ?? "").trim();
    if (!name) continue;
    const cycle = Number(row[map.cycle]) || 0;
    if (!cycle) continue;

    const code =
      map.code >= 0
        ? String(row[map.code] ?? "").trim()
        : `IMPORT-${normalizeName(name).slice(0, 8).replace(/\s/g, "")}-${cycle}`;
    if (!code) continue;
    if (seenCodes.has(code)) {
      warnings.push(`Codigo duplicado "${code}" en hoja ${sheetName}, fila ${i + 1}`);
      continue;
    }
    seenCodes.add(code);

    const category =
      map.category >= 0
        ? classifyCategory(String(row[map.category] ?? ""))
        : "ESPECIALIDAD";

    const prereqs = map.prereqs >= 0 ? parsePrereqs(String(row[map.prereqs] ?? "")) : [];

    courses.push({
      code,
      name,
      ht: map.ht >= 0 ? Number(row[map.ht]) || 0 : 0,
      hp: map.hp >= 0 ? Number(row[map.hp]) || 0 : 0,
      hl: map.hl >= 0 ? Number(row[map.hl]) || 0 : 0,
      th: map.th >= 0 ? Number(row[map.th]) || 0 : 0,
      cred: map.cred >= 0 ? Number(row[map.cred]) || 0 : 0,
      category,
      prereqs,
      defaultCycle: cycle,
    });
  }

  return { courses, warnings, headers, map, totalRows: rows.length - 1 };
}

export async function importExcel(
  file: File,
  label: string,
): Promise<ImportResult> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });

  let best:
    | (NonNullable<ReturnType<typeof parseSheet>> & { name: string })
    | null = null;

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
    }) as unknown[][];
    const result = parseSheet(rows, sheetName);
    if (result && result.courses.length > 0) {
      if (!best || result.courses.length > best.courses.length) {
        best = { ...result, name: sheetName };
      }
    }
  }

  if (!best) {
    throw new Error(
      "No se encontro ninguna hoja con cursos. La hoja debe tener columnas: Asignatura, Ciclo (Ci.), y opcionalmente HT, HP, HL, TH, Cred, Prerrequisitos, Codigo, Area.",
    );
  }

  const slug =
    "import-" +
    label
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) +
    "-" +
    Date.now().toString(36).slice(-4);

  const career: Career = {
    label,
    slug,
    specifics: best.courses.filter((c) => c.category !== "ESPECIALIDAD"),
    specialty: best.courses.filter((c) => c.category === "ESPECIALIDAD"),
  };

  const detectedColumns: { field: string; header: string | null }[] = [
    { field: "Asignatura", header: best.headers[best.map.name] ?? null },
    { field: "Ciclo", header: best.headers[best.map.cycle] ?? null },
    { field: "Codigo", header: best.map.code >= 0 ? best.headers[best.map.code] : null },
    {
      field: "Categoria",
      header: best.map.category >= 0 ? best.headers[best.map.category] : null,
    },
    {
      field: "Prerrequisitos",
      header: best.map.prereqs >= 0 ? best.headers[best.map.prereqs] : null,
    },
    { field: "Creditos", header: best.map.cred >= 0 ? best.headers[best.map.cred] : null },
  ];

  return {
    career,
    warnings: best.warnings,
    sourceSheet: best.name,
    detectedColumns,
    totalRows: best.totalRows,
  };
}
