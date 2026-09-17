import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import {
  GeneratedFile,
  ReportGenerator,
  ReportPayload,
  ReportTable,
} from '../report-payload.types';

@Injectable()
export class XlsxReportGenerator implements ReportGenerator {
  async generate(payload: ReportPayload): Promise<GeneratedFile> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = payload.generatedByEmail;
    workbook.created = payload.generatedAt;

    for (const table of payload.tables) {
      this.addSheet(workbook, payload, table);
    }

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      filename: `${slugify(payload.title)}.xlsx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  private addSheet(workbook: ExcelJS.Workbook, payload: ReportPayload, table: ReportTable): void {
    const sheet = workbook.addWorksheet(table.title.slice(0, 31) || 'Sheet');

    sheet.addRow([payload.title]).font = { bold: true, size: 14 };
    sheet.addRow([`Period: ${payload.periodLabel}`]);
    sheet.addRow([
      `Generated: ${payload.generatedAt.toISOString()} by ${payload.generatedByEmail}`,
    ]);
    for (const [key, value] of Object.entries(payload.filters)) {
      sheet.addRow([`${key}: ${value}`]);
    }
    sheet.addRow([]);

    const headerRow = sheet.addRow(table.columns.map((c) => c.header));
    headerRow.font = { bold: true };
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
      cell.border = { bottom: { style: 'thin' } };
    });
    sheet.views = [{ state: 'frozen', ySplit: headerRow.number }];

    for (const row of table.rows) {
      const values = table.columns.map((c) => row[c.key] ?? '');
      const excelRow = sheet.addRow(values);
      table.columns.forEach((c, index) => {
        if (c.numeric) excelRow.getCell(index + 1).numFmt = '#,##0.00';
      });
    }

    if (table.totals) {
      const totalsRow = sheet.addRow(table.columns.map((c) => table.totals?.[c.key] ?? ''));
      totalsRow.font = { bold: true };
      table.columns.forEach((c, index) => {
        if (c.numeric) totalsRow.getCell(index + 1).numFmt = '#,##0.00';
      });
    }

    sheet.columns.forEach((column) => {
      let maxLength = 12;
      column.eachCell?.({ includeEmpty: false }, (cell) => {
        const length = cell.value ? String(cell.value).length : 0;
        if (length > maxLength) maxLength = length;
      });
      column.width = Math.min(maxLength + 2, 50);
    });
  }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
