import {
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Body,
  Query,
  Res,
  ConflictException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { QueryReportHistoryDto } from './dto/query-report-history.dto';
import { ReportStatus } from './enums/report-type.enum';
import { FilesService } from '../files/files.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/constants/permissions.constant';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

@ApiTags('reports')
@ApiBearerAuth('access-token')
@Controller('reports')
@RequirePermissions(Permission.REPORTS_GENERATE)
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly filesService: FilesService,
  ) {}

  @Post()
  request(@Body() dto: CreateReportDto, @CurrentUser() user: AuthenticatedUser) {
    return this.reportsService.requestReport(dto, user.sub, user.email);
  }

  @Get()
  findAll(@Query() query: QueryReportHistoryDto, @CurrentUser() user: AuthenticatedUser) {
    if (!user.permissions.includes(Permission.REPORTS_READ_ALL)) {
      query.requestedByUserId = user.sub;
    }
    return this.reportsService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    const report = await this.reportsService.findById(id);
    this.assertVisible(report.requestedByUserId, user);
    return report;
  }

  @Get(':id/download')
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const report = await this.reportsService.findById(id);
    this.assertVisible(report.requestedByUserId, user);

    if (report.status !== ReportStatus.COMPLETED || !report.fileId) {
      throw new ConflictException(`Report is not ready (status: ${report.status})`);
    }

    const file = await this.filesService.findById(report.fileId);
    if (!file) throw new NotFoundException('Report file not found');

    const buffer = await this.filesService.readBuffer(file);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.originalName}"`);
    res.send(buffer);
  }

  private assertVisible(ownerId: string, user: AuthenticatedUser): void {
    if (ownerId !== user.sub && !user.permissions.includes(Permission.REPORTS_READ_ALL)) {
      throw new ForbiddenException('You are not allowed to access this report');
    }
  }
}
