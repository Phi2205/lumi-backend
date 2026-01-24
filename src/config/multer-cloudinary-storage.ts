import { StorageEngine } from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

interface CloudinaryStorageOptions {
  cloudinary: typeof cloudinary;
  params?: (req: any, file: Express.Multer.File) => Promise<any> | any;
}

export class CloudinaryStorage implements StorageEngine {
  private cloudinary: typeof cloudinary;
  private params: (req: any, file: Express.Multer.File) => Promise<any> | any;

  constructor(options: CloudinaryStorageOptions) {
    this.cloudinary = options.cloudinary;
    this.params = options.params || (() => ({}));
  }

  async _handleFile(
    req: any,
    file: Express.Multer.File,
    callback: (error?: any, info?: any) => void,
  ): Promise<void> {
    try {
      const isVideo = file.mimetype.startsWith('video/');

      // ❌ Không cho video đi qua buffer/path
      if (isVideo && !file.stream) {
        return callback(new Error('Video must be uploaded as stream'));
      }

      // ✅ VIDEO → STREAM
      if (isVideo) {
        const uploadStream = this.cloudinary.uploader.upload_stream(
          {
            resource_type: 'video',
            streaming_profile: 'auto',
            public_id: `stories/${Date.now()}`,
            use_filename: false,
            unique_filename: true,
          },
          (err, result) => {
            if (err) return callback(err);

            const cloudName = this.cloudinary.config().cloud_name;
            if (!cloudName) {
              return callback(new Error('Cloudinary cloud_name not configured'));
            }

            callback(null, {
              fieldname: file.fieldname,
              originalname: file.originalname,
              encoding: file.encoding,
              mimetype: file.mimetype,
              size: result?.bytes,
              url: result?.secure_url,
              public_id: result?.public_id,
              streaming_url: `https://res.cloudinary.com/${cloudName}/video/upload/sp_auto/${result?.public_id}.m3u8`,
            } as any);
          },
        );

        file.stream.pipe(uploadStream);
        file.stream.on('error', (err) => {
          callback(err);
        });
        return;
      }

      // ✅ IMAGE → upload bình thường
      const params = await Promise.resolve(this.params(req, file));
      let uploadPromise: Promise<any>;

      if (file.buffer) {
        // Memory storage - upload from buffer
        uploadPromise = this.cloudinary.uploader.upload(
          `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
          {
            resource_type: 'image',
            folder: 'images',
            ...params,
          },
        );
      } else if (file.path) {
        // Disk storage - upload from file path
        uploadPromise = this.cloudinary.uploader.upload(file.path, {
          resource_type: 'image',
          folder: 'images',
          ...params,
        });
      } else if (file.stream) {
        // Stream upload for images
        return new Promise((resolve, reject) => {
          const uploadStream = this.cloudinary.uploader.upload_stream(
            {
              resource_type: 'image',
              folder: 'images',
              ...params,
            },
            (error, result) => {
              if (error) {
                callback(error);
                reject(error);
              } else if (result) {
                callback(null, {
                  fieldname: file.fieldname,
                  originalname: file.originalname,
                  encoding: file.encoding,
                  mimetype: file.mimetype,
                  size: result.bytes,
                  url: result.secure_url,
                  public_id: result.public_id,
                } as any);
                resolve(undefined);
              } else {
                const error = new Error('Upload result is null');
                callback(error);
                reject(error);
              }
            },
          );

          file.stream.pipe(uploadStream);
          file.stream.on('error', (err) => {
            callback(err);
            reject(err);
          });
        });
      } else {
        return callback(new Error('No stream, buffer, or path available'));
      }

      const result = await uploadPromise;
      callback(null, {
        fieldname: file.fieldname,
        originalname: file.originalname,
        encoding: file.encoding,
        mimetype: file.mimetype,
        size: result?.bytes,
        url: result?.secure_url,
        public_id: result?.public_id,
      } as any);
    } catch (error) {
      callback(error);
    }
  }

  _removeFile(
    req: any,
    file: Express.Multer.File & { public_id?: string },
    callback: (error: Error | null) => void,
  ): void {
    if (file.public_id) {
      this.cloudinary.uploader.destroy(file.public_id, callback);
    } else {
      callback(null);
    }
  }
}
