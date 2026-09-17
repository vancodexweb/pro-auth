import {
  Injectable,
  Logger,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { createHash, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { FileEntity } from './file.entity';
import { FileCategory } from './file-category.enum';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * Allow-list is per category: KYC categories only ever receive a
 * user-supplied upload (photo or scanned page) and are validated tightly;
 * REPORT_EXPORT only ever receives a buffer this application generated
 * itself in reports/generators/*, so its list just matches what those
 * generators produce.
 */
const ALLOWED_MIME_TYPES: Record<FileCategory, Set<string>> = {
  [FileCategory.PASSPORT_MAIN_PAGE]: new Set(['image/jpeg', 'image/png', 'application/pdf']),
  [FileCategory.PASSPORT_REGISTRATION_PAGE]: new Set([
    'image/jpeg',
    'image/png',
    'application/pdf',
  ]),
  [FileCategory.FACE_PHOTO]: new Set(['image/jpeg', 'image/png']),
  [FileCategory.DOCUMENT_ATTACHMENT]: new Set(['image/jpeg', 'image/png', 'application/pdf']),
  [FileCategory.REPORT_EXPORT]: new Set(['application/pdf', XLSX_MIME, DOCX_MIME]),
};

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export interface StoreFileInput {
  ownerUserId: string;
  category: FileCategory;
  buffer: Buffer;
  originalName: string;
  mimeType: string;
}

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);
  private readonly rootPath: string;

  constructor(
    @InjectRepository(FileEntity)
    private readonly fileRepository: Repository<FileEntity>,
    private readonly configService: ConfigService,
  ) {
    this.rootPath = path.resolve(this.configService.get<string>('storage.filesPath')!);
  }

  async store(input: StoreFileInput, manager?: EntityManager): Promise<FileEntity> {
    if (input.buffer.length > MAX_FILE_SIZE_BYTES) {
      throw new PayloadTooLargeException(
        `File exceeds the maximum allowed size of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB`,
      );
    }
    const allowedForCategory = ALLOWED_MIME_TYPES[input.category];
    if (!allowedForCategory.has(input.mimeType)) {
      throw new UnsupportedMediaTypeException(
        `Unsupported file type "${input.mimeType}" for ${input.category}. Allowed: ${[...allowedForCategory].join(', ')}`,
      );
    }

    const checksum = createHash('sha256').update(input.buffer).digest('hex');
    const extension = this.extensionFor(input.mimeType);
    const storageKey = path.posix.join(input.category, `${randomUUID()}${extension}`);
    const absolutePath = path.join(this.rootPath, storageKey);

    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, input.buffer, { mode: 0o600 });

    const repository = manager ? manager.getRepository(FileEntity) : this.fileRepository;
    const file = repository.create({
      ownerUserId: input.ownerUserId,
      category: input.category,
      originalName: input.originalName,
      mimeType: input.mimeType,
      sizeBytes: input.buffer.length,
      storageKey,
      checksumSha256: checksum,
    });
    return repository.save(file);
  }

  async findById(id: string): Promise<FileEntity | null> {
    return this.fileRepository.findOne({ where: { id } });
  }

  async readBuffer(file: FileEntity): Promise<Buffer> {
    return fs.readFile(path.join(this.rootPath, file.storageKey));
  }

  async delete(file: FileEntity): Promise<void> {
    await this.fileRepository.remove(file);
    try {
      await fs.unlink(path.join(this.rootPath, file.storageKey));
    } catch (error) {
      this.logger.warn(
        `Could not remove file blob ${file.storageKey}: ${(error as Error).message}`,
      );
    }
  }

  private extensionFor(mimeType: string): string {
    switch (mimeType) {
      case 'image/jpeg':
        return '.jpg';
      case 'image/png':
        return '.png';
      case 'application/pdf':
        return '.pdf';
      case XLSX_MIME:
        return '.xlsx';
      case DOCX_MIME:
        return '.docx';
      default:
        return '';
    }
  }
}
