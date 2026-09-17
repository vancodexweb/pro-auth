import { ColumnOptions } from 'typeorm';

/**
 * Standard options for a monetary column. Always `numeric(18,2)`, never
 * `float`/`double` - floating point cannot represent money exactly.
 * The pg driver returns this as a string, which is what keeps
 * common/utils/decimal.util.ts calculations exact.
 */
export const MONEY_COLUMN: ColumnOptions = {
  type: 'numeric',
  precision: 18,
  scale: 2,
};

/** Six-decimal precision used for currency exchange rates. */
export const RATE_COLUMN: ColumnOptions = {
  type: 'numeric',
  precision: 18,
  scale: 6,
};
