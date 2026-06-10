import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFiles,
  UseGuards,
  Body,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { UploadFileService } from './upload-file.service';
import { GetSignatureDto } from './dto/get-signature.dto';

@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadFileController {
  constructor(private readonly uploadFileService: UploadFileService) {}

  @Post()
  @Throttle({
    short: { limit: 2, ttl: 1000 },
    medium: { limit: 5, ttl: 10000 },
    long: { limit: 10, ttl: 60000 },
  })
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
      message: 'Files uploaded successfully',
      data: result,
    };
  }

  @Post('signature')
  @Throttle({
    short: { limit: 3, ttl: 1000 },
    medium: { limit: 10, ttl: 10000 },
    long: { limit: 30, ttl: 60000 },
  })
  async getSignature(@Body() getSignatureDto: GetSignatureDto) {
    const result = await this.uploadFileService.getUploadSignature(
      getSignatureDto.params,
    );

    return {
      success: true,
      message: 'Signature generated successfully',
      data: result,
    };
  }
}
