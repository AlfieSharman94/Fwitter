import { ArrayMaxSize, IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePostDto {
  @IsString()
  @MaxLength(500)
  content!: string;

  @IsOptional()
  @IsString()
  parentPostId?: string;

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
}
