import { registerDecorator, ValidationOptions } from 'class-validator';

const MONEY_REGEX = /^\d+(\.\d{1,2})?$/;

/** Validates a non-negative decimal string with at most 2 fraction digits, e.g. "1250.00". */
export function IsMoneyAmount(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'IsMoneyAmount',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return typeof value === 'string' && MONEY_REGEX.test(value);
        },
        defaultMessage(): string {
          return `${propertyName} must be a non-negative decimal string with at most 2 fraction digits (e.g. "1250.00")`;
        },
      },
    });
  };
}
