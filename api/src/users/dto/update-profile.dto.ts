import { IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(2, 30)
  @Matches(/^[a-zA-Z0-9_]+$/)
  username?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  bio?: string;
}
