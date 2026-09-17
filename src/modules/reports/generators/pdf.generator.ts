import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import {
  GeneratedFile,
  ReportGenerator,
  ReportPayload,
  ReportTable,
} from '../report-payload.types';

const PAGE_MARGIN = 40;
const ROW_HEIGHT = 18;

@Injectable()
export class PdfReportGenerator implements ReportGenerator {
  async generate(payload: ReportPayload): Promise<GeneratedFile> {
    const doc = new PDFDocument({ margin: PAGE_MARGIN, size: 'A4', bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));

    const done = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    this.renderHeader(doc, payload);

    for (const table of payload.tables) {
      this.renderTable(doc, table);
      doc.moveDown();
    }

    this.renderPageNumbers(doc);
    doc.end();

    const buffer = await done;
    return {
      buffer,
      filename: `${slugify(payload.title)}.pdf`,
      mimeType: 'application/pdf',
    };
  }

  private renderHeader(doc: PDFKit.PDFDocument, payload: ReportPayload): void {
    doc.fontSize(16).text(payload.title, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Period: ${payload.periodLabel}`);
    doc.text(`Generated: ${payload.generatedAt.toISOString()} by ${payload.generatedByEmail}`);
    for (const [key, value] of Object.entries(payload.filters)) {
      doc.text(`${key}: ${value}`);
    }
    doc.moveDown();
  }

  private renderTable(doc: PDFKit.PDFDocument, table: ReportTable): void {
    doc.fontSize(12).text(table.title, { underline: true });
    doc.moveDown(0.3);

    const usableWidth = doc.page.width - PAGE_MARGIN * 2;
    const columnWidth = usableWidth / table.columns.length;

    const drawHeader = () => {
      const y = doc.y;
      doc.fontSize(9).font('Helvetica-Bold');
      table.columns.forEach((col, index) => {
        doc.text(col.header, PAGE_MARGIN + index * columnWidth, y, {
          width: columnWidth,
          align: col.numeric ? 'right' : 'left',
        });
      });
      doc.font('Helvetica');
      doc.moveDown();
      doc
        .moveTo(PAGE_MARGIN, doc.y)
        .lineTo(PAGE_MARGIN + usableWidth, doc.y)
        .stroke();
      doc.moveDown(0.2);
    };

    const ensureSpace = () => {
      if (doc.y + ROW_HEIGHT > doc.page.height - PAGE_MARGIN) {
        doc.addPage();
        drawHeader();
      }
    };

    drawHeader();

    for (const row of table.rows) {
      ensureSpace();
      const y = doc.y;
      table.columns.forEach((col, index) => {
        const value = row[col.key] ?? '';
        doc.fontSize(9).text(String(value), PAGE_MARGIN + index * columnWidth, y, {
          width: columnWidth,
          align: col.numeric ? 'right' : 'left',
        });
      });
      doc.moveDown(0.6);
    }

    if (table.totals) {
      ensureSpace();
      const y = doc.y;
      doc.font('Helvetica-Bold');
      table.columns.forEach((col, index) => {
        const value = table.totals?.[col.key] ?? '';
        doc.fontSize(9).text(String(value), PAGE_MARGIN + index * columnWidth, y, {
          width: columnWidth,
          align: col.numeric ? 'right' : 'left',
        });
      });
      doc.font('Helvetica');
    }
  }

  private renderPageNumbers(doc: PDFKit.PDFDocument): void {
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc
        .fontSize(8)
        .text(`Page ${i + 1} of ${range.count}`, PAGE_MARGIN, doc.page.height - PAGE_MARGIN / 2, {
          width: doc.page.width - PAGE_MARGIN * 2,
          align: 'center',
        });
    }
  }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
