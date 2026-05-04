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
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const node = document.getElementById("malla-export");
  if (!node) return;

  const canvas = await html2canvas(node, {
    backgroundColor: "#f8fafc",
    scale: 2,
    windowWidth: node.scrollWidth,
  });
  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "px",
    format: [canvas.width, canvas.height + 60],
  });
  pdf.setFontSize(14);
  pdf.text(`Malla Curricular - ${careerLabel}`, 20, 30);
  pdf.addImage(imgData, "PNG", 0, 50, canvas.width, canvas.height);
  const safe = careerLabel.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
  pdf.save(`malla-${safe}-${new Date().toISOString().slice(0, 10)}.pdf`);
}
