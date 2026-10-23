import { IsString, MaxLength, MinLength } from 'class-validator';

export class OpenConversationDto {
  @IsString()
  userId!: string;
}

export class SendMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  content!: string;
}
