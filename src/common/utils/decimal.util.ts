/**
 * Exact decimal arithmetic for money, backed by BigInt minor units (cents).
 *
 * All monetary columns are Postgres `numeric(18,2)`, which TypeORM returns
 * as strings. Doing arithmetic on those strings with plain JS numbers would
 * introduce floating-point rounding error - unacceptable for a ledger that
 * must satisfy SUM(DEBIT) = SUM(CREDIT) exactly. Everything here works in
 * integer minor units instead, so addition/comparison is exact.
 */

const SCALE = 100n; // 2 decimal places

/** Parses a decimal string into an integer scaled by 10^decimals, with no floating point involved. */
export function toScaledUnits(value: string | number, decimals: number): bigint {
  const normalized = typeof value === 'number' ? value.toFixed(decimals) : value.trim();
  const negative = normalized.startsWith('-');
  const unsigned = negative ? normalized.slice(1) : normalized;
  const parts = unsigned.split('.');
  if (parts.length > 2) {
    throw new Error(`Invalid decimal value: "${value}"`);
  }
  const [wholePart, fractionPartRaw = ''] = parts;

  if (!/^\d+$/.test(wholePart) || !/^\d*$/.test(fractionPartRaw)) {
    throw new Error(`Invalid decimal value: "${value}"`);
  }

  const fractionPart = (fractionPartRaw + '0'.repeat(decimals)).slice(0, decimals);
  const scale = 10n ** BigInt(decimals);
  const units = BigInt(wholePart) * scale + BigInt(fractionPart || '0');
  return negative ? -units : units;
}

export function toMinorUnits(value: string | number): bigint {
  return toScaledUnits(value, 2);
}

export function fromMinorUnits(value: bigint): string {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const whole = abs / SCALE;
  const fraction = abs % SCALE;
  const sign = negative && (whole !== 0n || fraction !== 0n) ? '-' : '';
  return `${sign}${whole.toString()}.${fraction.toString().padStart(2, '0')}`;
}

export function sumMinorUnits(values: Array<string | number>): bigint {
  return values.reduce<bigint>((acc, value) => acc + toMinorUnits(value), 0n);
}

export function addDecimal(a: string, b: string): string {
  return fromMinorUnits(toMinorUnits(a) + toMinorUnits(b));
}

export function subtractDecimal(a: string, b: string): string {
  return fromMinorUnits(toMinorUnits(a) - toMinorUnits(b));
}

export function isZeroDecimal(value: string): boolean {
  return toMinorUnits(value) === 0n;
}

export function compareDecimal(a: string, b: string): -1 | 0 | 1 {
  const diff = toMinorUnits(a) - toMinorUnits(b);
  if (diff === 0n) return 0;
  return diff > 0n ? 1 : -1;
}

const RATE_DECIMALS = 6;
const RATE_SCALE = 10n ** BigInt(RATE_DECIMALS);

/** Converts a money amount to another currency using an exact-decimal exchange rate (no floats). */
export function convertWithRate(amount: string, rate: string): string {
  const amountMinor = toMinorUnits(amount);
  if (amountMinor === 0n) return '0.00';
  const rateUnits = toScaledUnits(rate, RATE_DECIMALS);
  const resultMinor = (amountMinor * rateUnits) / RATE_SCALE;
  return fromMinorUnits(resultMinor);
}
