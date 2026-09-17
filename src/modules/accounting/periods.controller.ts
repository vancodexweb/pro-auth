import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PeriodsService } from './periods.service';
import { CreatePeriodDto } from './dto/create-period.dto';
import { TransitionPeriodDto } from './dto/transition-period.dto';
import { ReasonDto } from '../../common/dto/reason.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/constants/permissions.constant';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

@ApiTags('accounting')
@ApiBearerAuth('access-token')
@Controller('accounting/periods')
@RequirePermissions(Permission.ACCOUNTING_MANAGE)
export class PeriodsController {
  constructor(private readonly periodsService: PeriodsService) {}

  @Post()
  create(@Body() dto: CreatePeriodDto) {
    return this.periodsService.create(dto);
  }

  @Get()
  findAll() {
    return this.periodsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.periodsService.findById(id);
  }

  @Patch(':id/status')
  transition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransitionPeriodDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.periodsService.transition(id, user.sub, dto.status);
  }

  @Post(':id/reopen')
  reopen(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.periodsService.reopenClosedPeriod(id, user.sub, dto.reason);
  }
}
