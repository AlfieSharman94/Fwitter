import { IsEmail, IsOptional, MaxLength } from 'class-validator';

// Sent by the app with POST /users/me/onboarding/complete. Only JUNIOR accounts need it; the
// server ignores it for STANDARD accounts and the pending screen collects it when missing.
export class CompleteOnboardingDto {
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  guardianEmail?: string;
}

export class GuardianEmailDto {
  @IsEmail()
  @MaxLength(255)
  guardianEmail!: string;
}
