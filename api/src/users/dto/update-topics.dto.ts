import { ArrayMaxSize, IsArray, IsString } from 'class-validator';

export class UpdateTopicsDto {
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  topicIds!: string[];
}
