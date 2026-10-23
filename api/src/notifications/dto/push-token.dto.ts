import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class PushTokenDto {
  @IsString()
  @MaxLength(200)
  token!: string;

  @IsOptional()
  @IsIn(['ios', 'android', 'web'])
  platform?: string;
}

export class RemovePushTokenDto {
  @IsString()
  @MaxLength(200)
  token!: string;
}
