// Report export helpers — Admin → Reports.
//
// Shared by every report tab (Products / Purchased Orders / Customers) so
// each export format (PDF, CSV, Excel) is generated consistently, branded
// the same way, and built only from the real data already loaded on the
// page (no fabricated rows, no separate export-only API call unless the
// page didn't already have the data in memory).

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

export interface ReportColumn<T> {
  header: string;
  // Value used in PDF/Excel tables (kept short).
  get: (row: T) => string | number;
}

export interface ReportBranding {
  companyName: string;
  reportTitle: string;
  /** data: URL, or null if the logo could not be loaded (export still proceeds without it). */
  logoDataUrl: string | null;
  generatedAt: Date;
}

// ---------------------------------------------------------------------------
// Logo loading — the Sidebar/Login/Invoice pages already `import logo from
// ".../farmcraft-logo-full.png"`, which Vite resolves to a URL. We fetch
// that same URL once and cache the base64 data: URL for embedding into
// PDF/Excel output.
// ---------------------------------------------------------------------------

let cachedLogoDataUrl: string | null | undefined;

export async function loadLogoDataUrl(logoUrl: string): Promise<string | null> {
  if (cachedLogoDataUrl !== undefined) return cachedLogoDataUrl;
  try {
    const response = await fetch(logoUrl);
    const blob = await response.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    cachedLogoDataUrl = dataUrl;
  } catch {
    // Export must still work without the logo (e.g. offline/blocked asset).
    cachedLogoDataUrl = null;
  }
  return cachedLogoDataUrl;
}

function formatDate(d: Date): string {
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// PDF export (jsPDF + jspdf-autotable)
// ---------------------------------------------------------------------------

export function exportReportPdf<T>(
  branding: ReportBranding,
  columns: ReportColumn<T>[],
  rows: T[],
  filename: string
): void {
  const doc = new jsPDF({ orientation: columns.length > 5 ? "landscape" : "portrait" });
  const pageWidth = doc.internal.pageSize.getWidth();
  let cursorY = 15;

  if (branding.logoDataUrl) {
    try {
      // Preserve the logo's real aspect ratio instead of stretching it.
      const props = doc.getImageProperties(branding.logoDataUrl);
      const logoWidth = 26;
      const logoHeight = (props.height / props.width) * logoWidth;
      doc.addImage(branding.logoDataUrl, "PNG", 14, cursorY - 6, logoWidth, logoHeight);
    } catch {
      // If the embedded image can't be decoded, continue without it.
    }
  }

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(branding.companyName, pageWidth - 14, cursorY, { align: "right" });
  cursorY += 6;
  doc.setFontSize(12);
  doc.text(branding.reportTitle, pageWidth - 14, cursorY, { align: "right" });
  cursorY += 6;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated: ${formatDate(branding.generatedAt)}`, pageWidth - 14, cursorY, { align: "right" });
  cursorY += 6;

  autoTable(doc, {
    startY: cursorY + 2,
    head: [columns.map((c) => c.header)],
    body: rows.map((row) => columns.map((c) => c.get(row))),
    headStyles: { fillColor: [46, 92, 58] }, // farm-green tone
    styles: { fontSize: 8, cellPadding: 2.5 },
    didDrawPage: () => {
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(
        `Page ${doc.getCurrentPageInfo().pageNumber} of ${pageCount}`,
        pageWidth - 14,
        doc.internal.pageSize.getHeight() - 8,
        { align: "right" }
      );
    },
  });

  if (rows.length === 0) {
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text("No data available for this report.", 14, cursorY + 14);
  }

  doc.save(filename);
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

function escapeCsvCell(value: unknown): string {
  const str = String(value ?? "");
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export function exportReportCsv<T>(
  branding: ReportBranding,
  columns: ReportColumn<T>[],
  rows: T[],
  filename: string
): void {
  const metaLines = [
    [branding.companyName],
    [branding.reportTitle],
    [`Generated: ${formatDate(branding.generatedAt)}`],
    [],
  ];
  const headerLine = columns.map((c) => c.header);
  const dataLines = rows.map((row) => columns.map((c) => c.get(row)));

  const lines = [...metaLines, headerLine, ...dataLines]
    .map((line) => line.map(escapeCsvCell).join(","))
    .join("\n");

  const blob = new Blob([lines], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Excel (.xlsx) export
// ---------------------------------------------------------------------------
//
// The SheetJS Community build used here (xlsx) writes cell data/formatting
// only — it does not support embedding a raster logo image into a .xlsx
// worksheet. The company name, report title and generated date are written
// as real header rows instead, and the logo is included in the PDF export
// above, which does support it.

export function exportReportXlsx<T>(
  branding: ReportBranding,
  columns: ReportColumn<T>[],
  rows: T[],
  filename: string
): void {
  const headerLine = columns.map((c) => c.header);
  const dataLines = rows.map((row) => columns.map((c) => c.get(row)));

  const aoa: (string | number)[][] = [
    [branding.companyName],
    [branding.reportTitle],
    [`Generated: ${formatDate(branding.generatedAt)}`],
    [],
    headerLine,
    ...dataLines,
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);

  // Readable column widths based on the longest value in each column
  // (including the header), not a fixed guess.
  worksheet["!cols"] = columns.map((c, i) => {
    const longest = Math.max(
      c.header.length,
      ...dataLines.map((line) => String(line[i] ?? "").length),
      8
    );
    return { wch: Math.min(longest + 2, 45) };
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
  XLSX.writeFile(workbook, filename);
}
