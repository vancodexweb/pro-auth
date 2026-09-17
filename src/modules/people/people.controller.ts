import {
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { PeopleService } from './people.service';
import { FilesService } from '../files/files.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/constants/permissions.constant';
import { QueryEmployeesDto } from './dto/query-employees.dto';

@ApiTags('people')
@ApiBearerAuth('access-token')
@Controller('people')
export class PeopleController {
  constructor(
    private readonly peopleService: PeopleService,
    private readonly filesService: FilesService,
  ) {}

  @Get('me')
  async getMyProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.peopleService.findByUserId(user.sub);
  }

  @Get('employees')
  @RequirePermissions(Permission.USERS_MANAGE)
  findAllEmployees(@Query() query: QueryEmployeesDto) {
    return this.peopleService.findAllEmployees(query);
  }

  @Get(':userId')
  @RequirePermissions(Permission.USERS_MANAGE)
  findProfileByUserId(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.peopleService.findByUserId(userId);
  }

  @Get('documents/:fileId/download')
  async downloadDocument(
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const file = await this.filesService.findById(fileId);
    if (!file) throw new NotFoundException('File not found');

    const isOwner = file.ownerUserId === user.sub;
    const isReviewer = user.permissions.includes(Permission.USERS_MANAGE);
    if (!isOwner && !isReviewer) {
      throw new ForbiddenException('You are not allowed to access this file');
    }

    const buffer = await this.filesService.readBuffer(file);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${file.originalName}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(buffer);
  }
}
