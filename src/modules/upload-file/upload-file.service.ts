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

  /**
   * Tạo signature để frontend upload trực tiếp lên Cloudinary
   */
  async getUploadSignature(params: Record<string, any> = {}) {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const apiSecret = cloudinary.config().api_secret;
    const apiKey = cloudinary.config().api_key;
    const cloudName = cloudinary.config().cloud_name;

    if (!apiSecret) {
      throw new Error('Cloudinary config is missing api_secret');
    }

    const paramsToSign = {
      ...params,
      timestamp,
    };
    console.log('paramsToSign', paramsToSign);

    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      apiSecret,
    );

    return {
      signature,
      timestamp,
      api_key: apiKey,
      cloud_name: cloudName,
    };
  }
}
