import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ExchangeRatesService } from './exchange-rates.service';
import { SetExchangeRateDto } from './dto/set-exchange-rate.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/constants/permissions.constant';

@ApiTags('accounting')
@ApiBearerAuth('access-token')
@Controller('accounting/exchange-rates')
export class ExchangeRatesController {
  constructor(private readonly exchangeRatesService: ExchangeRatesService) {}

  @Post()
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  set(@Body() dto: SetExchangeRateDto) {
    return this.exchangeRatesService.set(dto);
  }

  @Get()
  findAll(@Query('currency') currency?: string) {
    return this.exchangeRatesService.findAll(currency);
  }
}
