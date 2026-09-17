import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { ReportFormat, ReportStatus, ReportType } from '../enums/report-type.enum';

@Entity('report_history')
export class ReportHistory extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  requestedByUserId: string;

  @Column({ type: 'enum', enum: ReportType })
  reportType: ReportType;

  @Column({ type: 'enum', enum: ReportFormat })
  format: ReportFormat;

  @Column({ type: 'jsonb' })
  parameters: Record<string, unknown>;

  @Column({ type: 'date', nullable: true })
  periodFrom: string | null;

  @Column({ type: 'date', nullable: true })
  periodTo: string | null;

  @Column({ type: 'enum', enum: ReportStatus, default: ReportStatus.PENDING })
  status: ReportStatus;

  @Column({ type: 'uuid', nullable: true })
  fileId: string | null;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  errorMessage: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;
}
