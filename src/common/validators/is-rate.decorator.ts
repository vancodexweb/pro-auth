import { registerDecorator, ValidationOptions } from 'class-validator';

const RATE_REGEX = /^\d+(\.\d{1,6})?$/;

/** Validates a positive decimal string with at most 6 fraction digits, e.g. "1.085000" (an exchange rate). */
export function IsRate(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'IsRate',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return typeof value === 'string' && RATE_REGEX.test(value) && parseFloat(value) > 0;
        },
        defaultMessage(): string {
          return `${propertyName} must be a positive decimal string with at most 6 fraction digits (e.g. "1.085000")`;
        },
      },
    });
  };
}
