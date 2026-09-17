import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateCounterpartyDto } from './create-counterparty.dto';

export class UpdateCounterpartyDto extends PartialType(
  OmitType(CreateCounterpartyDto, ['contacts', 'bankAccounts'] as const),
) {}
