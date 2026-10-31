import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { LinkShare } from '@prisma/client';

export class LinkSharesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(6)
  @IsEnum(LinkShare, { each: true })
  shares!: LinkShare[];
}

export class LinkRequestDto extends LinkSharesDto {
  @IsUUID()
  viewerId!: string;
}

export class LinkDecisionDto {
  @IsBoolean()
  yes!: boolean;
}

export class ConsentApproveDto {
  @IsOptional()
  @IsBoolean()
  link?: boolean;
}
