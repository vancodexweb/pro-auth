import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { FileCategory } from './file-category.enum';

/**
 * Storage metadata only. Bytes live on disk (or, later, an object store)
 * under storage/files/<storageKey>; that path is never exposed to clients.
 * Cross-module ownership is a plain uuid column, not a TypeORM relation -
 * Files is generic infrastructure and must not import User/Document/etc.
 */
@Entity('files')
export class FileEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  ownerUserId: string;

  @Column({ type: 'enum', enum: FileCategory })
  category: FileCategory;

  @Column({ type: 'varchar', length: 255 })
  originalName: string;

  @Column({ type: 'varchar', length: 100 })
  mimeType: string;

  // 'integer' (max ~2GB) is intentional: uploads are capped far below that
  // by multer limits, so we avoid the bigint-as-string handling entirely.
  @Column({ type: 'integer' })
  sizeBytes: number;

  @Column({ type: 'varchar', length: 512 })
  storageKey: string;

  @Column({ type: 'char', length: 64 })
  checksumSha256: string;
}
