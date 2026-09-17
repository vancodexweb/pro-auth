import {
  addDecimal,
  compareDecimal,
  convertWithRate,
  fromMinorUnits,
  isZeroDecimal,
  subtractDecimal,
  sumMinorUnits,
  toMinorUnits,
} from './decimal.util';

describe('decimal.util', () => {
  describe('toMinorUnits / fromMinorUnits', () => {
    it('round-trips whole and fractional amounts exactly', () => {
      expect(toMinorUnits('1000.00')).toBe(100000n);
      expect(toMinorUnits('0.01')).toBe(1n);
      expect(toMinorUnits('-42.50')).toBe(-4250n);
      expect(fromMinorUnits(100000n)).toBe('1000.00');
      expect(fromMinorUnits(1n)).toBe('0.01');
      expect(fromMinorUnits(-4250n)).toBe('-42.50');
    });

    it('pads missing fraction digits', () => {
      expect(toMinorUnits('5')).toBe(500n);
      expect(toMinorUnits('5.1')).toBe(510n);
    });

    it('rejects malformed input rather than silently truncating', () => {
      expect(() => toMinorUnits('abc')).toThrow();
      expect(() => toMinorUnits('1.2.3')).toThrow();
    });
  });

  describe('sumMinorUnits', () => {
    it('never accumulates floating-point error across many small amounts', () => {
      const amounts = Array.from({ length: 100000 }, () => '0.01');
      // 100000 * 0.01 = 1000.00 exactly; plain JS float addition would drift here.
      expect(sumMinorUnits(amounts)).toBe(100000n);
    });
  });

  describe('addDecimal / subtractDecimal / compareDecimal', () => {
    it('performs exact arithmetic', () => {
      expect(addDecimal('10.10', '0.05')).toBe('10.15');
      expect(subtractDecimal('10.00', '3.33')).toBe('6.67');
      expect(compareDecimal('10.00', '10.00')).toBe(0);
      expect(compareDecimal('10.01', '10.00')).toBe(1);
      expect(compareDecimal('9.99', '10.00')).toBe(-1);
    });
  });

  describe('isZeroDecimal', () => {
    it('treats differently-formatted zero as zero', () => {
      expect(isZeroDecimal('0.00')).toBe(true);
      expect(isZeroDecimal('0')).toBe(true);
      expect(isZeroDecimal('0.01')).toBe(false);
    });
  });

  describe('convertWithRate', () => {
    it('converts using a 6-decimal exchange rate without floating point drift', () => {
      expect(convertWithRate('100.00', '1.085000')).toBe('108.50');
      expect(convertWithRate('0.00', '1.085000')).toBe('0.00');
    });

    it('truncates sub-cent remainders consistently (banker-free truncation)', () => {
      // 33.33 * 1.5 = 49.995 -> truncates to 49.99, never silently rounds up.
      expect(convertWithRate('33.33', '1.500000')).toBe('49.99');
    });
  });
});
