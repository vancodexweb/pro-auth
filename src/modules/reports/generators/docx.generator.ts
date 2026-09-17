import { Injectable } from '@nestjs/common';
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import {
  GeneratedFile,
  ReportGenerator,
  ReportPayload,
  ReportTable,
} from '../report-payload.types';

@Injectable()
export class DocxReportGenerator implements ReportGenerator {
  async generate(payload: ReportPayload): Promise<GeneratedFile> {
    const children: (Paragraph | Table)[] = [
      new Paragraph({ text: payload.title, heading: HeadingLevel.HEADING_1 }),
      new Paragraph({ text: `Period: ${payload.periodLabel}` }),
      new Paragraph({
        text: `Generated: ${payload.generatedAt.toISOString()} by ${payload.generatedByEmail}`,
      }),
      ...Object.entries(payload.filters).map(
        ([key, value]) => new Paragraph({ text: `${key}: ${value}` }),
      ),
      new Paragraph({ text: '' }),
    ];

    for (const table of payload.tables) {
      children.push(new Paragraph({ text: table.title, heading: HeadingLevel.HEADING_2 }));
      children.push(this.buildTable(table));
      children.push(new Paragraph({ text: '' }));
    }

    children.push(
      new Paragraph({ text: '' }),
      new Paragraph({ text: '_________________________     _________________________' }),
      new Paragraph({ text: 'Prepared by                                   Approved by' }),
    );

    const document = new Document({
      creator: payload.generatedByEmail,
      sections: [{ children }],
    });

    const buffer = await Packer.toBuffer(document);
    return {
      buffer,
      filename: `${slugify(payload.title)}.docx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
  }

  private buildTable(table: ReportTable): Table {
    const headerRow = new TableRow({
      children: table.columns.map(
        (col) =>
          new TableCell({
            children: [
              new Paragraph({ children: [new TextRun({ text: col.header, bold: true })] }),
            ],
          }),
      ),
    });

    const dataRows = table.rows.map(
      (row) =>
        new TableRow({
          children: table.columns.map(
            (col) =>
              new TableCell({
                children: [
                  new Paragraph({
                    alignment: col.numeric ? AlignmentType.RIGHT : AlignmentType.LEFT,
                    text: String(row[col.key] ?? ''),
                  }),
                ],
              }),
          ),
        }),
    );

    const rows = [headerRow, ...dataRows];

    if (table.totals) {
      rows.push(
        new TableRow({
          children: table.columns.map(
            (col) =>
              new TableCell({
                children: [
                  new Paragraph({
                    alignment: col.numeric ? AlignmentType.RIGHT : AlignmentType.LEFT,
                    children: [
                      new TextRun({ text: String(table.totals?.[col.key] ?? ''), bold: true }),
                    ],
                  }),
                ],
              }),
          ),
        }),
      );
    }

    return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows });
  }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
