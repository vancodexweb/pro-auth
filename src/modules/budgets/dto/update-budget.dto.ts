import { PartialType } from '@nestjs/swagger';
import { CreateBudgetDto } from './create-budget.dto';

/** Only reachable while the budget is DRAFT (see BudgetsService.update). */
export class UpdateBudgetDto extends PartialType(CreateBudgetDto) {}
