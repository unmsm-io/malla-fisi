"use client";

import type { jsPDF } from "jspdf";
import type { Course, MallaState, Placement } from "./types";
import { ROMAN } from "./utils";

interface CycleSummary {
  cycle: number;
  count: number;
  ht: number;
  hp: number;
  hl: number;
  th: number;
  credits: number;
  accumulatedCredits: number;
}

export async function exportToExcel(
  allCourses: Course[],
  placement: Placement,
  careerLabel: string,
  state?: MallaState,
) {
  const XLSX = await import("xlsx-js-style");
  const rows: (string | number)[][] = [
    [
      "CICLO",
      "CODIGO",
      "ASIGNATURA",
      "CATEGORIA",
      "TEORIA (H)",
      "PRACTICA (H)",
      "LABORATORIO (H)",
      "TOTAL HORAS",
      "CREDITOS",
      "CREDITOS ACUMULADOS",
      "PRERREQUISITOS",
    ],
  ];

  const rowTypes: { type: "header" | "course" | "subtotal" | "blank"; category?: Course["category"] }[] = [
    { type: "header" },
  ];
  const summaries = buildCycleSummaries(allCourses, placement);
  const summaryByCycle = new Map(summaries.map((summary) => [summary.cycle, summary]));

  for (let cycle = 1; cycle <= 10; cycle++) {
    const inCycle = allCourses
      .filter((c) => placement[c.code] === cycle)
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
    if (inCycle.length === 0) continue;
    const summary = summaryByCycle.get(cycle);
    if (!summary) continue;

    for (const c of inCycle) {
      rows.push([
        ROMAN[cycle - 1],
        c.code,
        c.name,
        c.category,
        c.ht,
        c.hp,
        c.hl,
        c.th,
        c.cred,
        summary.accumulatedCredits,
        c.prereqs.join("; ") || "NINGUNO",
      ]);
      rowTypes.push({ type: "course", category: c.category });
    }
    rows.push([
      "",
      "",
      `SUBTOTAL CICLO ${ROMAN[cycle - 1]}`,
      "",
      summary.ht,
      summary.hp,
      summary.hl,
      summary.th,
      summary.credits,
      summary.accumulatedCredits,
      "",
    ]);
    rowTypes.push({ type: "subtotal" });
    rows.push([]);
    rowTypes.push({ type: "blank" });
  }

  const placedCourses = allCourses.filter((c) => placement[c.code] !== undefined);
  const totals = summaries.reduce(
    (acc, summary) => ({
      ht: acc.ht + summary.ht,
      hp: acc.hp + summary.hp,
      hl: acc.hl + summary.hl,
      th: acc.th + summary.th,
      credits: acc.credits + summary.credits,
    }),
    { ht: 0, hp: 0, hl: 0, th: 0, credits: 0 },
  );
  rows.push([
    "",
    "",
    "TOTAL GENERAL",
    "",
    totals.ht,
    totals.hp,
    totals.hl,
    totals.th,
    totals.credits,
    totals.credits,
    "",
  ]);
  rowTypes.push({ type: "subtotal" });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [
    { wch: 8 },
    { wch: 14 },
    { wch: 52 },
    { wch: 14 },
    { wch: 11 },
    { wch: 12 },
    { wch: 14 },
    { wch: 12 },
    { wch: 10 },
    { wch: 20 },
    { wch: 52 },
  ];

  const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1:K1");
  for (let r = range.s.r; r <= range.e.r; r++) {
    const rowType = rowTypes[r];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const ref = XLSX.utils.encode_cell({ r, c });
      const cell = ws[ref];
      if (!cell) continue;
      cell.s = styleFor(rowType);
    }
  }

  ws["!autofilter"] = { ref: "A1:K1" };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Malla");

  if (state) {
    const stateJson = JSON.stringify({
      ...state,
      savedAt: state.savedAt ?? new Date().toISOString(),
      metadata: {
        exportedAt: new Date().toISOString(),
        placedCourses: placedCourses.length,
      },
    });
    const chunks = chunkString(stateJson, 30000);
    const stateRows: string[][] = [
      ["key", "value"],
      ["stateId", state.stateId ?? ""],
      ["schemaVersion", "1"],
      ...chunks.map((chunk, index) => [`chunk_${index}`, chunk]),
    ];
    const stateSheet = XLSX.utils.aoa_to_sheet(stateRows);
    XLSX.utils.book_append_sheet(wb, stateSheet, "_malla_state");
    const sheetIndex = wb.SheetNames.indexOf("_malla_state");
    wb.Workbook = wb.Workbook ?? {};
    wb.Workbook.Sheets = wb.Workbook.Sheets ?? [];
    wb.Workbook.Sheets[sheetIndex] = { Hidden: 2 };
  }

  const safe = careerLabel.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
  XLSX.writeFile(wb, `malla-${safe}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function chunkString(value: string, size: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < value.length; i += size) {
    chunks.push(value.slice(i, i + size));
  }
  return chunks;
}

function buildCycleSummaries(allCourses: Course[], placement: Placement): CycleSummary[] {
  let accumulatedCredits = 0;
  const summaries: CycleSummary[] = [];
  for (let cycle = 1; cycle <= 10; cycle++) {
    const courses = allCourses.filter((c) => placement[c.code] === cycle);
    if (courses.length === 0) continue;
    const summary = courses.reduce(
      (acc, course) => ({
        count: acc.count + 1,
        ht: acc.ht + course.ht,
        hp: acc.hp + course.hp,
        hl: acc.hl + course.hl,
        th: acc.th + course.th,
        credits: acc.credits + course.cred,
      }),
      { count: 0, ht: 0, hp: 0, hl: 0, th: 0, credits: 0 },
    );
    accumulatedCredits += summary.credits;
    summaries.push({ cycle, ...summary, accumulatedCredits });
  }
  return summaries;
}

function styleFor(rowType?: {
  type: "header" | "course" | "subtotal" | "blank";
  category?: Course["category"];
}) {
  const base = {
    border: {
      top: { style: "thin", color: { rgb: "D9D9D9" } },
      bottom: { style: "thin", color: { rgb: "D9D9D9" } },
      left: { style: "thin", color: { rgb: "D9D9D9" } },
      right: { style: "thin", color: { rgb: "D9D9D9" } },
    },
    alignment: { vertical: "center", wrapText: true },
  };
  if (!rowType || rowType.type === "blank") return base;
  if (rowType.type === "header") {
    return {
      ...base,
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "1F4E3A" } },
    };
  }
  if (rowType.type === "subtotal") {
    return {
      ...base,
      font: { bold: true },
      fill: { fgColor: { rgb: "FFF2CC" } },
    };
  }
  const fills: Record<Course["category"], string> = {
    EEGG: "F8CBAD",
    ESPECIFICO: "C6E0B4",
    ESPECIALIDAD: "B4C7E7",
  };
  return {
    ...base,
    fill: { fgColor: { rgb: fills[rowType.category ?? "ESPECIALIDAD"] } },
  };
}

export async function exportToPdf(
  careerLabel: string,
  allCourses: Course[],
  placement: Placement,
) {
  const [{ domToCanvas }, { default: jsPDF }] = await Promise.all([
    import("modern-screenshot"),
    import("jspdf"),
  ]);

  const node = document.getElementById("malla-export") as HTMLElement | null;
  if (!node) {
    throw new Error("malla-export node not found");
  }

  const grid = node.firstElementChild as HTMLElement | null;
  const targetNode = grid ?? node;
  const targetWidth = targetNode.scrollWidth;
  const targetHeight = targetNode.scrollHeight;

  const isDark = document.documentElement.classList.contains("dark");
  const backgroundColor = isDark ? "#0f1115" : "#f8fafc";

  const canvas = await domToCanvas(targetNode, {
    backgroundColor,
    width: targetWidth,
    height: targetHeight,
    scale: 2,
    style: {
      transform: "none",
      overflow: "visible",
    },
  });

  const imgData = canvas.toDataURL("image/png");

  const pageWidth = canvas.width;
  const pageHeight = canvas.height + 80;

  const pdf = new jsPDF({
    orientation: pageWidth > pageHeight ? "landscape" : "portrait",
    unit: "px",
    format: [pageWidth, pageHeight],
    hotfixes: ["px_scaling"],
  });

  pdf.setFontSize(18);
  pdf.text(`Malla Curricular - ${careerLabel}`, 24, 36);
  pdf.setFontSize(10);
  pdf.setTextColor(120, 120, 120);
  pdf.text(
    `Generado ${new Date().toLocaleDateString("es-PE")} - malla-fisi.vercel.app`,
    24,
    54,
  );
  pdf.addImage(imgData, "PNG", 0, 70, canvas.width, canvas.height);
  addPdfSummaryPage(pdf, careerLabel, buildCycleSummaries(allCourses, placement));

  const safe = careerLabel.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
  pdf.save(`malla-${safe}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

function addPdfSummaryPage(
  pdf: jsPDF,
  careerLabel: string,
  summaries: CycleSummary[],
) {
  const pageWidth = 1200;
  const pageHeight = 800;
  const left = 56;
  const top = 120;
  const rowHeight = 42;
  const columns = [
    { label: "Ciclo", width: 90 },
    { label: "Cursos", width: 90 },
    { label: "Teoria", width: 120 },
    { label: "Practica", width: 120 },
    { label: "Laboratorio", width: 140 },
    { label: "Total horas", width: 150 },
    { label: "Creditos", width: 120 },
    { label: "Creditos acumulados", width: 190 },
  ];
  const totals = summaries.reduce(
    (acc, summary) => ({
      count: acc.count + summary.count,
      ht: acc.ht + summary.ht,
      hp: acc.hp + summary.hp,
      hl: acc.hl + summary.hl,
      th: acc.th + summary.th,
      credits: acc.credits + summary.credits,
    }),
    { count: 0, ht: 0, hp: 0, hl: 0, th: 0, credits: 0 },
  );

  pdf.addPage([pageWidth, pageHeight], "landscape");
  pdf.setFillColor(248, 250, 252);
  pdf.rect(0, 0, pageWidth, pageHeight, "F");
  pdf.setTextColor(20, 24, 23);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(22);
  pdf.text(`Subtotales por ciclo - ${careerLabel}`, left, 54);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  pdf.setTextColor(90, 98, 94);
  pdf.text("Horas, creditos y creditos acumulados del documento exportado.", left, 78);

  let x = left;
  pdf.setFillColor(31, 78, 58);
  pdf.setDrawColor(31, 78, 58);
  pdf.rect(left, top, columns.reduce((sum, col) => sum + col.width, 0), rowHeight, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  for (const column of columns) {
    pdf.text(column.label, x + 10, top + 26);
    x += column.width;
  }

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  let y = top + rowHeight;
  for (const summary of summaries) {
    x = left;
    pdf.setFillColor(255, 255, 255);
    pdf.setDrawColor(220, 225, 222);
    pdf.rect(left, y, columns.reduce((sum, col) => sum + col.width, 0), rowHeight, "FD");
    pdf.setTextColor(20, 24, 23);
    const values = [
      ROMAN[summary.cycle - 1],
      String(summary.count),
      `${summary.ht}h`,
      `${summary.hp}h`,
      `${summary.hl}h`,
      `${summary.th}h`,
      String(summary.credits),
      String(summary.accumulatedCredits),
    ];
    for (let i = 0; i < columns.length; i++) {
      pdf.text(values[i], x + 10, y + 26);
      x += columns[i].width;
    }
    y += rowHeight;
  }

  x = left;
  pdf.setFillColor(255, 242, 204);
  pdf.setDrawColor(220, 205, 160);
  pdf.rect(left, y, columns.reduce((sum, col) => sum + col.width, 0), rowHeight, "FD");
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(20, 24, 23);
  const totalValues = [
    "TOTAL",
    String(totals.count),
    `${totals.ht}h`,
    `${totals.hp}h`,
    `${totals.hl}h`,
    `${totals.th}h`,
    String(totals.credits),
    String(totals.credits),
  ];
  for (let i = 0; i < columns.length; i++) {
    pdf.text(totalValues[i], x + 10, y + 26);
    x += columns[i].width;
  }
}
