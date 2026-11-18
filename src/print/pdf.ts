import { jsPDF } from 'jspdf';
import type { Capture } from './capture';
import type { InventoryEntry } from './inventory';

export type PdfOptions = {
  title: string;
  description?: string;
  /** Ruta del diagrama (pie de página) */
  source: string;
  image: Capture;
  orientation: 'landscape' | 'portrait';
  inventory?: InventoryEntry[];
};

const MARGIN = 14; // mm
const INK = '#1a192b';
const MUTED = '#6b6b7b';

/**
 * Genera el PDF: primera página con título, descripción e imagen; después,
 * si se pide, el inventario con una ficha por nodo. Las fuentes estándar del
 * PDF sólo cubren Latin-1: las flechas se escriben como "->" y "<-".
 */
export function buildPdf(o: PdfOptions): jsPDF {
  const doc = new jsPDF({ orientation: o.orientation, unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const textW = pageW - 2 * MARGIN;
  let y = MARGIN;

  const footer = () => {
    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(MUTED);
      doc.text(o.source, MARGIN, pageH - 7);
      doc.text(`${p} / ${pages}`, pageW - MARGIN, pageH - 7, { align: 'right' });
    }
  };
  const ensure = (h: number) => {
    if (y + h > pageH - MARGIN - 6) {
      doc.addPage('a4', o.orientation);
      y = MARGIN;
    }
  };
  const paragraph = (text: string, size: number, color = INK, style: 'normal' | 'bold' = 'normal', indent = 0) => {
    doc.setFont('helvetica', style).setFontSize(size).setTextColor(color);
    const lines: string[] = doc.splitTextToSize(text, textW - indent);
    const lh = size * 0.42;
    for (const line of lines) {
      ensure(lh);
      doc.text(line, MARGIN + indent, y + lh * 0.8);
      y += lh;
    }
  };

  // Página 1: título, descripción e imagen ajustada al espacio libre
  paragraph(o.title, 18, INK, 'bold');
  y += 2;
  if (o.description) {
    paragraph(o.description, 10, MUTED);
    y += 3;
  }
  const availH = pageH - MARGIN - 8 - y;
  const scale = Math.min(textW / o.image.width, availH / o.image.height);
  const imgW = o.image.width * scale;
  const imgH = o.image.height * scale;
  doc.addImage(o.image.dataUrl, 'PNG', MARGIN + (textW - imgW) / 2, y, imgW, imgH, undefined, 'FAST');

  // Inventario
  if (o.inventory?.length) {
    doc.addPage('a4', o.orientation);
    y = MARGIN;
    paragraph('Inventario', 16, INK, 'bold');
    paragraph(`${o.inventory.length} elementos`, 9, MUTED);
    y += 3;
    for (const e of o.inventory) {
      ensure(20);
      doc.setDrawColor('#e3e3e8').line(MARGIN, y, pageW - MARGIN, y);
      y += 3;
      paragraph(e.title, 12, INK, 'bold');
      paragraph(`${e.typeTitle} · ${e.id}`, 8.5, MUTED);
      y += 1;
      for (const err of e.errors) paragraph(`Error: ${err}`, 9.5, '#dc2626');
      for (const w of e.warns) paragraph(`Aviso: ${w}`, 9.5, '#d97706');
      if (e.description) {
        paragraph(e.description, 9.5);
        y += 1;
      }
      if (e.fields.length) {
        paragraph('Propiedades', 9, MUTED, 'bold');
        for (const f of e.fields) paragraph(`${f.label}: ${f.value}`, 9.5, INK, 'normal', 3);
        y += 1;
      }
      if (e.outgoing.length || e.incoming.length) {
        paragraph('Relaciones', 9, MUTED, 'bold');
        for (const t of e.outgoing) paragraph(`-> ${t}`, 9.5, INK, 'normal', 3);
        for (const t of e.incoming) paragraph(`<- ${t}`, 9.5, INK, 'normal', 3);
      }
      if (!e.description && !e.fields.length && !e.outgoing.length && !e.incoming.length) paragraph('Sin propiedades', 9.5, MUTED);
      y += 4;
    }
  }

  footer();
  return doc;
}
