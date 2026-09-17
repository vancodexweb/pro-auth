export interface ReportColumn {
  key: string;
  header: string;
  numeric?: boolean;
}

export interface ReportTable {
  title: string;
  columns: ReportColumn[];
  rows: Record<string, string | number>[];
  totals?: Record<string, string | number>;
}

export interface ReportPayload {
  title: string;
  periodLabel: string;
  generatedAt: Date;
  generatedByEmail: string;
  filters: Record<string, string>;
  tables: ReportTable[];
}

export interface GeneratedFile {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}

export interface ReportGenerator {
  generate(payload: ReportPayload): Promise<GeneratedFile>;
}
