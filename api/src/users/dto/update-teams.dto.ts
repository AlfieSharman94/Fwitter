import { ArrayMaxSize, IsArray, IsNotEmpty, IsString } from 'class-validator';

export class UpdateTeamsDto {
  @IsString()
  @IsNotEmpty()
  primaryTeamId!: string;

  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  teamIds!: string[];
}
