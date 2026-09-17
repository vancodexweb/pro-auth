import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileEntity } from './file.entity';
import { FilesService } from './files.service';

/**
 * Pure infrastructure: storing bytes and metadata. It exposes no HTTP
 * routes of its own - each domain module (people, expense-requests, ...)
 * mounts its own download endpoint and applies its own authorization
 * rules before calling FilesService for the actual bytes.
 */
@Module({
  imports: [TypeOrmModule.forFeature([FileEntity])],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}
