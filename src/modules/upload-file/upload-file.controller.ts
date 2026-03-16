import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFiles,
  UseGuards,
  Body,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { UploadFileService } from './upload-file.service';
import { GetSignatureDto } from './dto/get-signature.dto';

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
      message: 'Files uploaded successfully',
      data: result,
    };
  }

  @Post('signature')
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
