"use client";

import type { Course, Placement } from "./types";
import { ROMAN } from "./utils";

export async function exportToExcel(
  allCourses: Course[],
  placement: Placement,
  careerLabel: string,
) {
  const XLSX = await import("xlsx");
  const rows: (string | number)[][] = [
    ["CICLO", "CODIGO", "ASIGNATURA", "CATEGORIA", "HT", "HP", "HL", "TH", "CRED", "PRERREQUISITOS"],
  ];

  for (let cycle = 1; cycle <= 10; cycle++) {
    const inCycle = allCourses
      .filter((c) => placement[c.code] === cycle)
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
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
        c.prereqs.join("; ") || "NINGUNO",
      ]);
    }
  }

  const totalCred = allCourses
    .filter((c) => placement[c.code] !== undefined)
    .reduce((sum, c) => sum + c.cred, 0);
  rows.push([]);
  rows.push(["", "", "TOTAL", "", "", "", "", "", totalCred, ""]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [
    { wch: 8 }, { wch: 14 }, { wch: 50 }, { wch: 14 },
    { wch: 4 }, { wch: 4 }, { wch: 4 }, { wch: 4 }, { wch: 6 }, { wch: 50 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Malla");
  const safe = careerLabel.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
  XLSX.writeFile(wb, `malla-${safe}-${new Date().toISOString().slice(0, 10)}.xlsx`);
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
