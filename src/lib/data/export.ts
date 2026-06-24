"use client";

import type { jsPDF } from "jspdf";
import type { Course, MallaState, Placement } from "../domain/types";
import { findCourseByName, ROMAN } from "../domain/utils";

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

interface PdfEdge {
  fromCode: string;
  toCode: string;
  from: Point;
  to: Point;
  laneX: number;
}

interface Point {
  x: number;
  y: number;
}

interface PdfCourseBox {
  course: Course;
  cycle: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface RawPdfEdge {
  fromCode: string;
  toCode: string;
  source: PdfCourseBox;
  target: PdfCourseBox;
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
  const { default: jsPDF } = await import("jspdf");
  const pageWidth = 1800;
  const pageHeight = 920;

  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "px",
    format: [pageWidth, pageHeight],
    hotfixes: ["px_scaling"],
  });

  addPdfMallaPage(pdf, careerLabel, allCourses, placement, pageWidth, pageHeight);
  addPdfSummaryPage(pdf, careerLabel, buildCycleSummaries(allCourses, placement));

  const safe = careerLabel.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
  pdf.save(`malla-${safe}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

function addPdfMallaPage(
  pdf: jsPDF,
  careerLabel: string,
  allCourses: Course[],
  placement: Placement,
  pageWidth: number,
  pageHeight: number,
) {
  const marginX = 18;
  const headerTop = 12;
  const headerW = 122;
  const headerH = 28;
  const top = 104;
  const bottom = 138;
  const columnW = (pageWidth - marginX * 2) / 10;
  const boxesByCode = buildPdfCourseBoxes(
    allCourses,
    placement,
    marginX,
    columnW,
    top,
    pageHeight - bottom,
  );
  const edges = collectPdfPrereqEdges(allCourses, placement, boxesByCode);

  pdf.setFillColor(255, 255, 255);
  pdf.rect(0, 0, pageWidth, pageHeight, "F");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(35, 35, 35);
  pdf.text(`MALLA CURRICULAR - ${careerLabel.toUpperCase()}`, marginX, 72);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(90, 90, 90);
  pdf.text(
    `Generado ${new Date().toLocaleDateString("es-PE")} - malla-fisi.vercel.app`,
    marginX,
    87,
  );

  for (let cycle = 1; cycle <= 10; cycle++) {
    const centerX = marginX + (cycle - 1) * columnW + columnW / 2;
    const headerX = centerX - headerW / 2;

    pdf.setDrawColor(75, 75, 75);
    pdf.setFillColor(255, 255, 255);
    pdf.setLineWidth(0.8);
    pdf.rect(headerX, headerTop, headerW, headerH, "FD");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(28, 28, 28);
    pdf.text(semesterLabel(cycle), centerX, headerTop + 18, {
      align: "center",
    });

    if (cycle > 1) {
      const x = marginX + (cycle - 1) * columnW;
      pdf.setDrawColor(90, 90, 90);
      pdf.setLineDashPattern([3, 3], 0);
      pdf.line(x, 0, x, pageHeight - 96);
      pdf.setLineDashPattern([], 0);
    }
  }

  drawPdfPrereqEdges(pdf, edges);

  const boxes = [...boxesByCode.values()];
  for (const box of boxes) {
    drawPdfCourseBox(pdf, box);
  }

  drawPdfLegend(pdf, pageWidth, pageHeight);
}

function semesterLabel(cycle: number): string {
  const prefixes = ["1ER", "2DO", "3ER", "4TO", "5TO", "6TO", "7MO", "8VO", "9NO", "10MO"];
  return `${prefixes[cycle - 1]} SEMESTRE`;
}

function buildPdfCourseBoxes(
  allCourses: Course[],
  placement: Placement,
  marginX: number,
  columnW: number,
  top: number,
  availableHeight: number,
): Map<string, PdfCourseBox> {
  const maxRows = Math.max(
    1,
    ...Array.from({ length: 10 }, (_, index) =>
      allCourses.filter((course) => placement[course.code] === index + 1).length,
    ),
  );
  const gap = maxRows > 8 ? 10 : 18;
  const boxH = Math.max(34, Math.min(54, (availableHeight - gap * (maxRows - 1)) / maxRows));
  const boxW = Math.min(128, columnW - 44);
  const boxes = new Map<string, PdfCourseBox>();

  for (let cycle = 1; cycle <= 10; cycle++) {
    const courses = allCourses
      .filter((course) => placement[course.code] === cycle)
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
    const x = marginX + (cycle - 1) * columnW + (columnW - boxW) / 2;
    for (let index = 0; index < courses.length; index++) {
      boxes.set(courses[index].code, {
        course: courses[index],
        cycle,
        x,
        y: top + index * (boxH + gap),
        w: boxW,
        h: boxH,
      });
    }
  }

  return boxes;
}

function collectPdfPrereqEdges(
  allCourses: Course[],
  placement: Placement,
  boxesByCode: Map<string, PdfCourseBox>,
): PdfEdge[] {
  const rawEdges: RawPdfEdge[] = [];
  for (const course of allCourses) {
    if (placement[course.code] === undefined) continue;
    const target = boxesByCode.get(course.code);
    if (!target) continue;
    for (const prereqName of course.prereqs) {
      const prereq = findCourseByName(prereqName, allCourses);
      if (!prereq || placement[prereq.code] === undefined) continue;
      const source = boxesByCode.get(prereq.code);
      if (!source) continue;

      rawEdges.push({
        fromCode: prereq.code,
        toCode: course.code,
        source,
        target,
      });
    }
  }

  const sourceGroups = groupRawEdges(rawEdges, (edge) => edge.fromCode);
  const targetGroups = groupRawEdges(rawEdges, (edge) => edge.toCode);
  const cycleGroups = groupRawEdges(
    rawEdges,
    (edge) => `${edge.source.cycle}->${edge.target.cycle}`,
  );

  return rawEdges.map((edge) => {
    const sourceGroup = sourceGroups.get(edge.fromCode) ?? [];
    const targetGroup = targetGroups.get(edge.toCode) ?? [];
    const cycleKey = `${edge.source.cycle}->${edge.target.cycle}`;
    const cycleGroup = cycleGroups.get(cycleKey) ?? [];
    const sourceIndex = sourceGroup.indexOf(edge);
    const targetIndex = targetGroup.indexOf(edge);
    const laneIndex = cycleGroup.indexOf(edge);
    const fromY = edge.source.y + edge.source.h / 2 + distributedOffset(sourceIndex, sourceGroup.length, edge.source.h * 0.52);
    const toY = edge.target.y + edge.target.h / 2 + distributedOffset(targetIndex, targetGroup.length, edge.target.h * 0.52);
    const minLaneX = edge.source.x + edge.source.w + 12;
    const maxLaneX = edge.target.x - 16;
    const laneSpread = Math.max(0, maxLaneX - minLaneX);
    const laneX =
      laneSpread > 10
        ? minLaneX + ((laneIndex + 1) / (cycleGroup.length + 1)) * laneSpread
        : edge.source.x + edge.source.w + 18 + laneIndex * 4;

    return {
      fromCode: edge.fromCode,
      toCode: edge.toCode,
      from: { x: edge.source.x + edge.source.w, y: fromY },
      to: { x: edge.target.x - 3, y: toY },
      laneX,
    };
  });
}

function groupRawEdges(
  edges: RawPdfEdge[],
  keyFor: (edge: RawPdfEdge) => string,
): Map<string, RawPdfEdge[]> {
  const groups = new Map<string, RawPdfEdge[]>();
  for (const edge of edges) {
    const key = keyFor(edge);
    groups.set(key, [...(groups.get(key) ?? []), edge]);
  }
  for (const group of groups.values()) {
    group.sort((a, b) => {
      return (
        a.source.y - b.source.y ||
        a.target.y - b.target.y
      );
    });
  }
  return groups;
}

function distributedOffset(index: number, total: number, spread: number): number {
  if (total <= 1 || index < 0) return 0;
  return -spread / 2 + (spread * index) / (total - 1);
}

function drawPdfPrereqEdges(
  pdf: jsPDF,
  edges: PdfEdge[],
) {
  if (edges.length === 0) return;

  pdf.setDrawColor(45, 45, 45);
  pdf.setFillColor(45, 45, 45);
  pdf.setLineWidth(0.55);

  for (const edge of edges) {
    const from = edge.from;
    const to = edge.to;
    const laneX = edge.laneX;
    const points = [from, { x: laneX, y: from.y }, { x: laneX, y: to.y }, to];

    for (let i = 0; i < points.length - 1; i++) {
      pdf.line(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
    }

    drawPdfArrowHead(
      pdf,
      points[points.length - 2],
      to,
      6,
    );
  }
}

function drawPdfArrowHead(
  pdf: jsPDF,
  previous: { x: number; y: number },
  tip: { x: number; y: number },
  size: number,
) {
  const angle = Math.atan2(tip.y - previous.y, tip.x - previous.x);
  const wing = Math.PI / 7;
  const left = {
    x: tip.x - size * Math.cos(angle - wing),
    y: tip.y - size * Math.sin(angle - wing),
  };
  const right = {
    x: tip.x - size * Math.cos(angle + wing),
    y: tip.y - size * Math.sin(angle + wing),
  };

  pdf.triangle(tip.x, tip.y, left.x, left.y, right.x, right.y, "F");
}

function drawPdfCourseBox(pdf: jsPDF, box: PdfCourseBox) {
  const fill = pdfCategoryFill(box.course.category);
  pdf.setFillColor(fill.r, fill.g, fill.b);
  pdf.setDrawColor(125, 125, 125);
  pdf.setLineWidth(0.7);
  pdf.rect(box.x, box.y, box.w, box.h, "FD");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(box.h < 42 ? 6.5 : 7);
  pdf.setTextColor(35, 35, 35);
  const label = `${box.cycle} ${box.course.name.toUpperCase()}`;
  const lines = pdf.splitTextToSize(label, box.w - 10).slice(0, 3);
  const lineHeight = box.h < 42 ? 8 : 9;
  const textY = box.y + box.h / 2 - ((lines.length - 1) * lineHeight) / 2 + 2;
  for (let index = 0; index < lines.length; index++) {
    pdf.text(lines[index], box.x + box.w / 2, textY + index * lineHeight, {
      align: "center",
    });
  }
}

function drawPdfLegend(pdf: jsPDF, pageWidth: number, pageHeight: number) {
  const items: { label: string; category: Course["category"] }[] = [
    { label: "EEGG", category: "EEGG" },
    { label: "Especificos", category: "ESPECIFICO" },
    { label: "Especialidad", category: "ESPECIALIDAD" },
  ];
  const startX = pageWidth - 460;
  const startY = pageHeight - 72;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(45, 45, 45);
  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    const fill = pdfCategoryFill(item.category);
    const x = startX + index * 145;
    pdf.setFillColor(fill.r, fill.g, fill.b);
    pdf.setDrawColor(125, 125, 125);
    pdf.rect(x, startY, 36, 18, "FD");
    pdf.text(item.label, x + 44, startY + 12);
  }
}

function pdfCategoryFill(category: Course["category"]) {
  const fills: Record<Course["category"], { r: number; g: number; b: number }> = {
    EEGG: { r: 246, g: 214, b: 190 },
    ESPECIFICO: { r: 214, g: 234, b: 210 },
    ESPECIALIDAD: { r: 210, g: 225, b: 243 },
  };
  return fills[category];
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
