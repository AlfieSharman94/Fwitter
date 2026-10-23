import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { Role } from '@prisma/client';

export class NoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class WarnDto {
  @IsString()
  @MaxLength(300)
  note!: string;
}

export class SuspendDto {
  @IsInt()
  @Min(1)
  @Max(365)
  days!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class SetRoleDto {
  @IsIn(Object.values(Role))
  role!: Role;
}

export class BannedWordDto {
  @IsString()
  @MaxLength(50)
  @Matches(/^[\p{L}\p{N}_' -]+$/u, { message: 'word must be letters, numbers, spaces, hyphens or apostrophes' })
  word!: string;
}
