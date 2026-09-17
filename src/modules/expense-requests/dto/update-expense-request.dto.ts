import { PartialType } from '@nestjs/swagger';
import { CreateExpenseRequestDto } from './create-expense-request.dto';

export class UpdateExpenseRequestDto extends PartialType(CreateExpenseRequestDto) {}
