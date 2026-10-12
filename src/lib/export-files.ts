// Download hooks or scripts as a Word file, a PDF or an Excel sheet. Everything is built in the browser,
// and the libraries are only loaded when you press a format, so they never slow the pages down.

export type ExportData = {
  title: string; // shown at the top of the Word and PDF files
  filename: string; // without the extension
  columns: string[]; // Excel headers (and the labels in a Word table)
  rows: string[][]; // one row per hook or script
  widths?: number[]; // Excel column widths
  // when given, Word and PDF read like a document: one section per item
  docs?: { heading: string; meta?: string; body: string }[];
};

export type ExportFormat = "word" | "pdf" | "excel";

const safeName = (s: string) => s.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "export";

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function toExcel(d: ExportData) {
  const writeExcelFile = (await import("write-excel-file/browser")).default;
  const data = [
    d.columns.map((c) => ({ value: c, fontWeight: "bold" as const })),
    ...d.rows.map((r) => r.map((v) => ({ value: v ?? "", wrap: true }))),
  ];
  await writeExcelFile(data, { columns: d.columns.map((_, i) => ({ width: d.widths?.[i] ?? 26 })) }).toFile(`${safeName(d.filename)}.xlsx`);
}

async function toWord(d: ExportData) {
  const { Document, Packer, Paragraph, HeadingLevel, TextRun, Table, TableRow, TableCell, WidthType } = await import("docx");
  const children: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = [new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(d.title)] })];
  if (d.docs && d.docs.length > 0) {
    for (const item of d.docs) {
      children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 360, after: 80 }, children: [new TextRun(item.heading)] }));
      if (item.meta) children.push(new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: item.meta, italics: true, color: "6B6B69" })] }));
      for (const line of item.body.split("\n")) children.push(new Paragraph({ spacing: { after: 100 }, children: [new TextRun(line)] }));
    }
  } else {
    const cell = (text: string, bold = false) =>
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text, bold })] })], width: { size: 100 / d.columns.length, type: WidthType.PERCENTAGE } });
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [new TableRow({ tableHeader: true, children: d.columns.map((c) => cell(c, true)) }), ...d.rows.map((r) => new TableRow({ children: r.map((v) => cell(String(v ?? ""))) }))],
      }),
    );
  }
  const blob = await Packer.toBlob(new Document({ sections: [{ children }] }));
  save(blob, `${safeName(d.filename)}.docx`);
}

async function toPdf(d: ExportData) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "pt", format: "letter" });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const M = 54;
  const maxW = W - M * 2;
  let y = M;
  const line = (text: string, size: number, bold = false, color = 0, gap = 4) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(size);
    pdf.setTextColor(color);
    for (const part of pdf.splitTextToSize(text, maxW) as string[]) {
      if (y + size > H - M) {
        pdf.addPage();
        y = M;
      }
      pdf.text(part, M, y);
      y += size * 1.3;
    }
    y += gap;
  };
  line(d.title, 20, true, 0, 10);
  if (d.docs && d.docs.length > 0) {
    for (const item of d.docs) {
      y += 8;
      line(item.heading, 14, true, 0, 2);
      if (item.meta) line(item.meta, 10, false, 110, 4);
      for (const l of item.body.split("\n")) line(l, 11, false, 20, 2);
    }
  } else {
    d.rows.forEach((r, n) => {
      y += 6;
      line(`${n + 1}. ${r[0] ?? ""}`, 12, true, 0, 2);
      r.slice(1).forEach((v, i) => {
        if (v) line(`${d.columns[i + 1]}: ${v}`, 10, false, 90, 1);
      });
    });
  }
  pdf.save(`${safeName(d.filename)}.pdf`);
}

export async function downloadExport(format: ExportFormat, d: ExportData) {
  if (format === "excel") return toExcel(d);
  if (format === "word") return toWord(d);
  return toPdf(d);
}
