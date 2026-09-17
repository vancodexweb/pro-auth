import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { DateRangeDto } from './dto/date-range.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/constants/permissions.constant';

@ApiTags('analytics')
@ApiBearerAuth('access-token')
@Controller('analytics')
@RequirePermissions(Permission.ANALYTICS_READ)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('profit-and-loss')
  profitAndLoss(@Query() query: DateRangeDto) {
    return this.analyticsService.profitAndLoss(query.from, query.to);
  }

  @Get('cash-flow')
  cashFlow(@Query() query: DateRangeDto) {
    return this.analyticsService.cashFlow(query.from, query.to);
  }

  @Get('trial-balance')
  trialBalance(@Query() query: DateRangeDto) {
    return this.analyticsService.trialBalance(query.from, query.to);
  }

  @Get('counterparty-balances')
  counterpartyBalances(
    @Query('asOfDate') asOfDate: string,
    @Query('counterpartyId') counterpartyId?: string,
  ) {
    return this.analyticsService.counterpartyBalances(asOfDate, counterpartyId);
  }

  @Get('account-balances')
  accountBalances(@Query('asOfDate') asOfDate: string) {
    return this.analyticsService.accountBalances(asOfDate);
  }
}
