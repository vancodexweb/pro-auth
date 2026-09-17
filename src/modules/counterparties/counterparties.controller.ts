import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CounterpartiesService } from './counterparties.service';
import {
  CreateBankAccountDto,
  CreateContactDto,
  CreateCounterpartyDto,
} from './dto/create-counterparty.dto';
import { UpdateCounterpartyDto } from './dto/update-counterparty.dto';
import { QueryCounterpartiesDto } from './dto/query-counterparties.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/constants/permissions.constant';

@ApiTags('counterparties')
@ApiBearerAuth('access-token')
@Controller('counterparties')
export class CounterpartiesController {
  constructor(private readonly counterpartiesService: CounterpartiesService) {}

  @Post()
  @RequirePermissions(Permission.COUNTERPARTIES_MANAGE)
  create(@Body() dto: CreateCounterpartyDto) {
    return this.counterpartiesService.create(dto);
  }

  @Get()
  findAll(@Query() query: QueryCounterpartiesDto) {
    return this.counterpartiesService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.counterpartiesService.findById(id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.COUNTERPARTIES_MANAGE)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCounterpartyDto) {
    return this.counterpartiesService.update(id, dto);
  }

  @Post(':id/deactivate')
  @RequirePermissions(Permission.COUNTERPARTIES_MANAGE)
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.counterpartiesService.deactivate(id);
  }

  @Post(':id/contacts')
  @RequirePermissions(Permission.COUNTERPARTIES_MANAGE)
  addContact(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateContactDto) {
    return this.counterpartiesService.addContact(id, dto);
  }

  @Post(':id/bank-accounts')
  @RequirePermissions(Permission.COUNTERPARTIES_MANAGE)
  addBankAccount(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateBankAccountDto) {
    return this.counterpartiesService.addBankAccount(id, dto);
  }
}
