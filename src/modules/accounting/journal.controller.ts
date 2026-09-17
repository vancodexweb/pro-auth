import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JournalService } from './journal.service';
import { QueryJournalEntriesDto } from './dto/query-journal-entries.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/constants/permissions.constant';

@ApiTags('accounting')
@ApiBearerAuth('access-token')
@Controller('accounting/journal-entries')
@RequirePermissions(Permission.ANALYTICS_READ)
export class JournalController {
  constructor(private readonly journalService: JournalService) {}

  @Get()
  findAll(@Query() query: QueryJournalEntriesDto) {
    return this.journalService.findEntries(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.journalService.findEntryById(id);
  }
}
