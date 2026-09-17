import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BudgetsService } from './budgets.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/constants/permissions.constant';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

@ApiTags('budgets')
@ApiBearerAuth('access-token')
@Controller('budgets')
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Post()
  @RequirePermissions(Permission.BUDGETS_MANAGE)
  create(@Body() dto: CreateBudgetDto, @CurrentUser() user: AuthenticatedUser) {
    return this.budgetsService.create(dto, user.sub);
  }

  @Get()
  findAll() {
    return this.budgetsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.budgetsService.findById(id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.BUDGETS_MANAGE)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBudgetDto) {
    return this.budgetsService.update(id, dto);
  }

  @Post(':id/approve')
  @RequirePermissions(Permission.BUDGETS_APPROVE)
  approve(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.budgetsService.approve(id, user.sub);
  }

  @Post(':id/close')
  @RequirePermissions(Permission.BUDGETS_APPROVE)
  close(@Param('id', ParseUUIDPipe) id: string) {
    return this.budgetsService.close(id);
  }

  @Get(':id/execution')
  @RequirePermissions(Permission.ANALYTICS_READ)
  execution(@Param('id', ParseUUIDPipe) id: string) {
    return this.budgetsService.getExecution(id);
  }
}
