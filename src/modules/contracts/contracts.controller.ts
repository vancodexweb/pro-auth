import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ContractsService } from './contracts.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { QueryContractsDto } from './dto/query-contracts.dto';
import { ChangeContractStatusDto } from './dto/change-contract-status.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/constants/permissions.constant';

@ApiTags('contracts')
@ApiBearerAuth('access-token')
@Controller('contracts')
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Post()
  @RequirePermissions(Permission.CONTRACTS_MANAGE)
  create(@Body() dto: CreateContractDto) {
    return this.contractsService.create(dto);
  }

  @Get()
  findAll(@Query() query: QueryContractsDto) {
    return this.contractsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.contractsService.findById(id);
  }

  @Patch(':id/status')
  @RequirePermissions(Permission.CONTRACTS_MANAGE)
  changeStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ChangeContractStatusDto) {
    return this.contractsService.changeStatus(id, dto.status);
  }
}
