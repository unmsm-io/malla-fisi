"use client";

import type { Course, MallaState, Placement } from "./types";
import { ROMAN } from "./utils";

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
      "HT",
      "HP",
      "HL",
      "TH",
      "CRED",
      "CRED ACUM",
      "PRERREQUISITOS",
    ],
  ];

  const rowTypes: { type: "header" | "course" | "subtotal" | "blank"; category?: Course["category"] }[] = [
    { type: "header" },
  ];
  let accumulatedCredits = 0;

  for (let cycle = 1; cycle <= 10; cycle++) {
    const inCycle = allCourses
      .filter((c) => placement[c.code] === cycle)
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
    if (inCycle.length === 0) continue;

    let ht = 0;
    let hp = 0;
    let hl = 0;
    let th = 0;
    let cred = 0;

    for (const c of inCycle) {
      ht += c.ht;
      hp += c.hp;
      hl += c.hl;
      th += c.th;
      cred += c.cred;
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
        accumulatedCredits + cred,
        c.prereqs.join("; ") || "NINGUNO",
      ]);
      rowTypes.push({ type: "course", category: c.category });
    }
    accumulatedCredits += cred;
    rows.push([
      "",
      "",
      `SUBTOTAL CICLO ${ROMAN[cycle - 1]}`,
      "",
      ht,
      hp,
      hl,
      th,
      cred,
      accumulatedCredits,
      "",
    ]);
    rowTypes.push({ type: "subtotal" });
    rows.push([]);
    rowTypes.push({ type: "blank" });
  }

  const placedCourses = allCourses.filter((c) => placement[c.code] !== undefined);
  rows.push(["", "", "TOTAL", "", "", "", "", "", accumulatedCredits, accumulatedCredits, ""]);
  rowTypes.push({ type: "subtotal" });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [
    { wch: 8 },
    { wch: 14 },
    { wch: 52 },
    { wch: 14 },
    { wch: 5 },
    { wch: 5 },
    { wch: 5 },
    { wch: 5 },
    { wch: 7 },
    { wch: 10 },
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

export async function exportToPdf(careerLabel: string) {
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

  const safe = careerLabel.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
  pdf.save(`malla-${safe}-${new Date().toISOString().slice(0, 10)}.pdf`);
}
