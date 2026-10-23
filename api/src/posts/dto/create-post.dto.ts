import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export const POLL_DURATIONS_HOURS = [24, 72, 168] as const;

export class PollDto {
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(4)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  options!: string[];

  @IsIn(POLL_DURATIONS_HOURS as unknown as number[])
  durationHours!: number;
}

export class CreatePostDto {
  @IsString()
  @MaxLength(500)
  content!: string;

  @IsOptional()
  @IsString()
  parentPostId?: string;

  @IsOptional()
  @IsString()
  quotedPostId?: string;

  @IsOptional()
  @IsString()
  matchId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  teamIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  topicIds?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => PollDto)
  poll?: PollDto;
}
