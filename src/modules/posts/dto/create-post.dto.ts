import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreatePostDto {
  @ApiPropertyOptional({ example: 'Hello world' })
  @IsOptional()
  @IsString()
  content?: string;
}
