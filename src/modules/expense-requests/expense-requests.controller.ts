import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ExpenseRequestsService } from './expense-requests.service';
import { CreateExpenseRequestDto } from './dto/create-expense-request.dto';
import { UpdateExpenseRequestDto } from './dto/update-expense-request.dto';
import { QueryExpenseRequestsDto } from './dto/query-expense-requests.dto';
import { ApproveExpenseRequestDto } from './dto/approve-expense-request.dto';
import { ReasonDto } from '../../common/dto/reason.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/constants/permissions.constant';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

@ApiTags('expense-requests')
@ApiBearerAuth('access-token')
@Controller('expense-requests')
export class ExpenseRequestsController {
  constructor(private readonly expenseRequestsService: ExpenseRequestsService) {}

  @Post()
  @RequirePermissions(Permission.EXPENSE_REQUESTS_MANAGE)
  create(@Body() dto: CreateExpenseRequestDto, @CurrentUser() user: AuthenticatedUser) {
    return this.expenseRequestsService.create(dto, user.sub);
  }

  @Get()
  findAll(@Query() query: QueryExpenseRequestsDto) {
    return this.expenseRequestsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.expenseRequestsService.findById(id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.EXPENSE_REQUESTS_MANAGE)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExpenseRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.expenseRequestsService.update(id, dto, user.sub);
  }

  @Post(':id/submit')
  @RequirePermissions(Permission.EXPENSE_REQUESTS_MANAGE)
  submit(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.expenseRequestsService.submit(id, user.sub);
  }

  @Post(':id/approve')
  @RequirePermissions(Permission.EXPENSE_REQUESTS_APPROVE)
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveExpenseRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.expenseRequestsService.approve(id, user.sub, dto.comment);
  }

  @Post(':id/reject')
  @RequirePermissions(Permission.EXPENSE_REQUESTS_APPROVE)
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.expenseRequestsService.reject(id, user.sub, dto.reason);
  }

  @Post(':id/cancel')
  @RequirePermissions(Permission.EXPENSE_REQUESTS_MANAGE)
  cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.expenseRequestsService.cancel(id, user.sub);
  }
}
