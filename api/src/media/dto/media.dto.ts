import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export class PresignDto {
  @IsIn(IMAGE_TYPES as unknown as string[])
  contentType!: string;

  @IsInt()
  @Min(1)
  @Max(MAX_IMAGE_BYTES)
  sizeBytes!: number;

  @IsIn(['post', 'avatar'])
  purpose!: 'post' | 'avatar';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  width?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  height?: number;
}

export class CompleteDto {
  @IsOptional()
  @IsString()
  _?: string;
}
