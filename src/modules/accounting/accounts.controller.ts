import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccountsService } from './accounts.service';
import { JournalService } from './journal.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/constants/permissions.constant';

@ApiTags('accounting')
@ApiBearerAuth('access-token')
@Controller('accounting/accounts')
export class AccountsController {
  constructor(
    private readonly accountsService: AccountsService,
    private readonly journalService: JournalService,
  ) {}

  @Post()
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  create(@Body() dto: CreateAccountDto) {
    return this.accountsService.create(dto);
  }

  @Get()
  findAll() {
    return this.accountsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.accountsService.findById(id);
  }

  @Post(':id/deactivate')
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.accountsService.deactivate(id);
  }

  @Get(':id/movements')
  @RequirePermissions(Permission.ANALYTICS_READ)
  movements(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.journalService.accountMovements(id, from, to);
  }
}
