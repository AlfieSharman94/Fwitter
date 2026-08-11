import { IsEnum, IsNotEmpty, IsOptional, IsString, Length, Matches, Validate } from 'class-validator';
import { AgeTier } from '@prisma/client';
import { IsMinAgeConstraint } from './min-age.validator';

export class CreateProfileDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 30)
  @Matches(/^[a-zA-Z0-9_]+$/)
  username!: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  displayName!: string;

  // Must be a valid YYYY-MM-DD date representing someone at least 13 years old.
  @Validate(IsMinAgeConstraint, [13])
  dateOfBirth!: string;

  // The server derives the authoritative tier from dateOfBirth (see the controller
  // and age-tier.util). Optional + whitelisted so the client's field is accepted
  // but ignored; validated only to reject an obviously malformed value if sent.
  @IsOptional()
  @IsEnum(AgeTier)
  ageTier?: AgeTier;
}
