import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SharePostDto {
  @ApiProperty({
    example: '123456789',
    description: 'ID của bài post gốc cần share',
  })
  @IsNotEmpty()
  @IsString()
  original_post_id: string;

  @ApiPropertyOptional({
    example: 'Chia sẻ bài này vì quá hay!',
    description: 'Nội dung kèm khi share (tuỳ chọn)',
  })
  @IsOptional()
  @IsString()
  content?: string;
}
