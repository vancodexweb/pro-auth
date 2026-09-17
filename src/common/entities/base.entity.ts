import { CreateDateColumn, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Shared columns for every entity in the system.
 * Entities that need optimistic locking add their own `@VersionColumn()`
 * explicitly instead of inheriting one, so it stays visible which
 * tables are concurrency-sensitive.
 */
export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
