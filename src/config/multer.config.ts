import multer from 'multer';
import { CloudinaryStorage } from './multer-cloudinary-storage';
import cloudinary from './cloudinary';

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const isVideo = file.mimetype.startsWith('video');

    return {
      folder: 'stories',
      resource_type: isVideo ? 'video' : 'image',
      allowed_formats: isVideo
        ? ['mp4', 'webm']
        : ['jpg', 'png', 'jpeg', 'webp'],
      public_id: `${Date.now()}-${file.originalname}`,
    };
  },
});

const postStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const isVideo = file.mimetype.startsWith('video');

    return {
      folder: 'posts',
      resource_type: isVideo ? 'video' : 'image',
      allowed_formats: isVideo
        ? ['mp4', 'webm']
        : ['jpg', 'png', 'jpeg', 'webp'],
      public_id: `${Date.now()}-${file.originalname}`,
    };
  },
});

const reelStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const isVideo = file.mimetype.startsWith('video');

    return {
      folder: 'reels',
      resource_type: isVideo ? 'video' : 'image',
      allowed_formats: isVideo
        ? ['mp4', 'webm', 'mov']
        : ['jpg', 'png', 'jpeg', 'webp'],
      public_id: `${Date.now()}-${file.originalname}`,
    };
  },
});

export const upload = multer({ storage });
export { storage as cloudinaryStorage };
export { postStorage as cloudinaryPostStorage };
export { reelStorage as cloudinaryReelStorage };
