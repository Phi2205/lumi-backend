import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFiles,
  UseGuards,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { UploadFileService } from './upload-file.service';

@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadFileController {
  constructor(private readonly uploadFileService: UploadFileService) {}

  @Post()
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: memoryStorage(),
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    }),
  )
  async uploadFiles(@UploadedFiles() files: Express.Multer.File[]) {
    const result = await this.uploadFileService.uploadFiles(files);

    return {
      success: true,
      data: result,
    };
  }
}
