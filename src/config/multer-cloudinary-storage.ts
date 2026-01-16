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
      const params = await Promise.resolve(this.params(req, file));
      
      let uploadPromise: Promise<any>;
      
      if (file.buffer) {
        // Memory storage - upload from buffer
        uploadPromise = this.cloudinary.uploader.upload(
          `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
          {
            resource_type: 'auto',
            ...params,
          },
        );
      } else if (file.path) {
        // Disk storage - upload from file path
        uploadPromise = this.cloudinary.uploader.upload(file.path, {
          resource_type: 'auto',
          ...params,
        });
      } else {
        // Stream upload - pipe trực tiếp file.stream vào Cloudinary
        return new Promise((resolve, reject) => {
          const uploadStream = this.cloudinary.uploader.upload_stream(
            {
              resource_type: 'auto',
              ...params,
            },
            (error, result) => {
              if (error) {
                callback(error);
                reject(error);
              } else {
                callback(null, {
                  fieldname: file.fieldname,
                  originalname: file.originalname,
                  encoding: file.encoding,
                  mimetype: file.mimetype,
                  size: result?.bytes,
                  url: result?.secure_url,
                  public_id: result?.public_id,
                } as any);
                resolve(undefined);
              }
            },
          );
          
          // Pipe trực tiếp file.stream vào uploadStream
          if (file.stream) {
            file.stream.pipe(uploadStream);
            file.stream.on('error', (err) => {
              callback(err);
              reject(err);
            });
          } else {
            const error = new Error('No stream, buffer, or path available');
            callback(error);
            reject(error);
          }
        });
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
