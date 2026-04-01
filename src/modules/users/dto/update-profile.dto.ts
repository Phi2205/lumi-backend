import { IsString, IsOptional, IsDateString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UpdateProfileDto {
  @ApiProperty({
    description: 'Bio of the user',
    example: 'Software Engineer and traveler',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  bio?: string;

  @ApiProperty({
    description: 'Latitude',
    example: 10.762622,
    required: false,
  })
  @Type(() => Number)
  @IsOptional()
  lat?: number;

  @ApiProperty({
    description: 'Longitude',
    example: 106.760172,
    required: false,
  })
  @Type(() => Number)
  @IsOptional()
  lng?: number;

  @ApiProperty({
    description: 'Place name',
    example: 'Bitexco Financial Tower',
    required: false,
  })
  @IsString()
  @IsOptional()
  place_name?: string;

  @ApiProperty({
    description: 'Full address',
    example: '2 Hai Trieu, Ben Nghe, District 1, Ho Chi Minh City',
    required: false,
  })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({
    description: 'Google Place ID',
    example: 'ChIJVXealLUxdTERI6pm9YvduSc',
    required: false,
  })
  @IsString()
  @IsOptional()
  place_id?: string;

  @ApiProperty({
    description: 'Birthday of the user (YYYY-MM-DD)',
    example: '1995-05-20',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  birthday?: string;
}
