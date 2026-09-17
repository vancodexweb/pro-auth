import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { EmployeeStatus } from '../enums/employee-status.enum';

@Entity('employees')
export class Employee extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'uuid' })
  userId: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 20 })
  employeeNumber: string;

  @Column({ type: 'uuid', nullable: true })
  departmentId: string | null;

  @Column({ type: 'varchar', length: 150 })
  position: string;

  @Column({ type: 'date' })
  hireDate: string;

  @Column({ type: 'enum', enum: EmployeeStatus, default: EmployeeStatus.ACTIVE })
  status: EmployeeStatus;

  @Column({ type: 'timestamptz', nullable: true })
  terminatedAt: Date | null;
}
