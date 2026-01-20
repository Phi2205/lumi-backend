import { v2 as cloudinary } from 'cloudinary';
import { ConfigService } from '@nestjs/config';

export const configureCloudinary = (configService: ConfigService) => {
  // Option 1: Use CLOUDINARY_URL (if available) - recommended
  const cloudinaryUrl = configService.get<string>('CLOUDINARY_URL');
  
  if (cloudinaryUrl) {
    cloudinary.config({
      cloudinary_url: cloudinaryUrl,
    });
  } else {
    // Option 2: Use individual config values
    cloudinary.config({
      cloud_name: configService.get<string>('CLOUDINARY_NAME') || configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: configService.get<string>('CLOUDINARY_API_SECRET'),
    });
  }

  return cloudinary;
};

// Export configured cloudinary instance for direct import
export default cloudinary;
