import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CompleteOnboardingDto, GuardianEmailDto } from './guardian.dto';

async function errorsFor<T extends object>(cls: new () => T, plain: unknown) {
  return validate(plainToInstance(cls, plain ?? {}) as object);
}

describe('CompleteOnboardingDto', () => {
  it('accepts an empty body (STANDARD accounts send nothing)', async () => {
    expect(await errorsFor(CompleteOnboardingDto, {})).toHaveLength(0);
    expect(await errorsFor(CompleteOnboardingDto, undefined)).toHaveLength(0);
  });

  it('accepts a guardian email', async () => {
    expect(await errorsFor(CompleteOnboardingDto, { guardianEmail: 'parent@example.com' })).toHaveLength(0);
  });

  it('rejects a malformed guardian email', async () => {
    expect(await errorsFor(CompleteOnboardingDto, { guardianEmail: 'nope' })).not.toHaveLength(0);
  });
});

describe('GuardianEmailDto', () => {
  it('requires a valid email', async () => {
    expect(await errorsFor(GuardianEmailDto, {})).not.toHaveLength(0);
    expect(await errorsFor(GuardianEmailDto, { guardianEmail: 'nope' })).not.toHaveLength(0);
    expect(await errorsFor(GuardianEmailDto, { guardianEmail: 'parent@example.com' })).toHaveLength(0);
  });

  it('rejects addresses over 255 characters', async () => {
    const long = `${'a'.repeat(250)}@example.com`;
    expect(await errorsFor(GuardianEmailDto, { guardianEmail: long })).not.toHaveLength(0);
  });
});
