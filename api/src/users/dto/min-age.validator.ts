import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

/**
 * Rejects a YYYY-MM-DD date-of-birth string that represents a person younger
 * than the required minimum age (default 13). Also rejects malformed or
 * non-calendar dates, so it fully replaces @IsDateString for this field.
 *
 * Usage: @Validate(IsMinAgeConstraint, [13])
 */
@ValidatorConstraint({ name: 'isMinAge', async: false })
export class IsMinAgeConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    if (typeof value !== 'string') return false;

    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return false;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    // Reject impossible calendar dates (e.g. 2010-13-40). UTC avoids TZ drift.
    const dob = new Date(Date.UTC(year, month - 1, day));
    if (
      dob.getUTCFullYear() !== year ||
      dob.getUTCMonth() !== month - 1 ||
      dob.getUTCDate() !== day
    ) {
      return false;
    }

    const minAge = this.minAge(args);
    const now = new Date();
    let age = now.getUTCFullYear() - year;
    const monthDiff = now.getUTCMonth() - (month - 1);
    if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < day)) {
      age--;
    }
    return age >= minAge;
  }

  defaultMessage(args: ValidationArguments): string {
    return `You must be at least ${this.minAge(args)} years old`;
  }

  private minAge(args: ValidationArguments): number {
    return (args.constraints?.[0] as number) ?? 13;
  }
}
