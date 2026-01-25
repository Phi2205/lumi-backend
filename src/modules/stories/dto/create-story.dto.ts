import { ApiProperty } from '@nestjs/swagger';

export class CreateStoryDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Image or video file for the story',
  })
  file: Express.Multer.File;
}
