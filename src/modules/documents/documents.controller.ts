import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { QueryDocumentsDto } from './dto/query-documents.dto';
import { ReasonDto } from '../../common/dto/reason.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/constants/permissions.constant';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

@ApiTags('documents')
@ApiBearerAuth('access-token')
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  @RequirePermissions(Permission.DOCUMENTS_MANAGE)
  create(@Body() dto: CreateDocumentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.documentsService.create(dto, user.sub);
  }

  @Get()
  findAll(@Query() query: QueryDocumentsDto) {
    return this.documentsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.documentsService.findById(id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.DOCUMENTS_MANAGE)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDocumentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documentsService.update(id, dto, user.sub);
  }

  @Post(':id/submit')
  @RequirePermissions(Permission.DOCUMENTS_MANAGE)
  submit(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.documentsService.submit(id, user.sub);
  }

  @Post(':id/approve')
  @RequirePermissions(Permission.DOCUMENTS_APPROVE)
  approve(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.documentsService.approve(id, user.sub);
  }

  @Post(':id/reject')
  @RequirePermissions(Permission.DOCUMENTS_APPROVE)
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documentsService.reject(id, user.sub, dto.reason);
  }

  @Post(':id/cancel')
  @RequirePermissions(Permission.DOCUMENTS_MANAGE)
  cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.documentsService.cancel(id, user.sub);
  }

  @Post(':id/post')
  @RequirePermissions(Permission.DOCUMENTS_POST)
  post(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.documentsService.post(id, user.sub);
  }

  @Post(':id/reverse')
  @RequirePermissions(Permission.DOCUMENTS_POST)
  reverse(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documentsService.reverse(id, user.sub, dto.reason);
  }
}
