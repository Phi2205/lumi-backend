import { IsString, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateReelDto {
  @ApiProperty({ description: 'Cloudinary video URL', required: true })
  @IsString()
  video_url: string;

  @ApiProperty({ description: 'Cloudinary public ID', required: true })
  @IsString()
  public_id: string;

  @ApiProperty({ description: 'Thumbnail URL for the reel', required: false })
  @IsString()
  @IsOptional()
  thumbnail_url?: string;

  @ApiProperty({ description: 'Caption for the reel', required: false })
  @IsString()
  @IsOptional()
  caption?: string;

  @ApiProperty({ description: 'Music name used in the reel', required: false })
  @IsString()
  @IsOptional()
  music_name?: string;

  @ApiProperty({
    description: 'Duration of the video in seconds',
    required: false,
  })
  @IsNumber()
  @IsOptional()
  duration?: number;
}
