import { Injectable } from '@nestjs/common';
import cloudinary from 'src/config/cloudinary';
import { Readable } from 'stream';

@Injectable()
export class UploadFileService {
  /**
   * Upload multiple files lên Cloudinary
   */
  async uploadFiles(files: Express.Multer.File[]) {
    const uploadPromises = files.map((file) => this.uploadSingle(file));
    return Promise.all(uploadPromises);
  }

  private async uploadSingle(
    file: Express.Multer.File,
  ): Promise<{ public_id: string; type: string }> {
    const isVideo = file.mimetype.startsWith('video/');
    const isImage = file.mimetype.startsWith('image/');
    const resourceType = isVideo ? 'video' : isImage ? 'image' : 'raw';
    const fileType = isVideo ? 'video' : isImage ? 'image' : 'file';

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: resourceType as any,
          folder: 'uploads',
          public_id: `${Date.now()}-${file.originalname.replace(/\.[^/.]+$/, '')}`,
        },
        (error, result) => {
          if (error) return reject(error);
          resolve({
            public_id: result!.public_id,
            type: fileType,
          });
        },
      );

      const stream = Readable.from(file.buffer);
      stream.pipe(uploadStream);
    });
  }
}
