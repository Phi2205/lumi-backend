import { Injectable } from '@nestjs/common';
import { CreateReelDto } from '../dto/create-reel.dto';
import { ReelsRepository } from '../repositories/reels.repository';
import { ReelLikeRepository } from '../repositories/reel-like.repository';

@Injectable()
export class ReelsService {
  constructor(
    private readonly reelsRepository: ReelsRepository,
    private readonly reelLikeRepository: ReelLikeRepository,
  ) {}

  async createReel(
    userId: string,
    videoUrl: string,
    publicId: string,
    dto: CreateReelDto,
  ) {
    // Ưu tiên dùng thumbnail_url từ FE gửi lên, nếu không có mới tự tạo
    const cloudName =
      process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_NAME;
    const generatedThumbnail = cloudName
      ? `https://res.cloudinary.com/${cloudName}/video/upload/${publicId}.jpg`
      : null;

    const reel = await this.reelsRepository.create({
      user_id: BigInt(userId),
      video_url: videoUrl,
      public_id: publicId,
      thumbnail_url: dto.thumbnail_url || generatedThumbnail,
      caption: dto.caption,
      music_name: dto.music_name,
      duration: dto.duration ? Number(dto.duration) : null,
    });

    return {
      ...reel,
      id: reel.id.toString(),
      user_id: reel.user_id.toString(),
      created_at: reel.created_at,
      user: {
        ...reel.user,
        id: (reel as any).user.id.toString(),
      },
    };
  }

  async getReels(
    requestingUserId: string,
    page: number = 1,
    limit: number = 10,
  ) {
    const skip = (page - 1) * limit;
    const reels = await this.reelsRepository.findMany(skip, limit);

    const cloudName =
      process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_NAME;

    // Check likes
    const likedReels = await this.reelLikeRepository.findLikesForReels(
      requestingUserId,
      reels.map((r) => r.id),
    );
    const likedReelIds = new Set(likedReels.map((lr) => lr.reel_id.toString()));

    return reels.map((reel) => ({
      ...reel,
      id: reel.id.toString(),
      user_id: reel.user_id.toString(),
      has_liked: likedReelIds.has(reel.id.toString()),
      user: {
        ...reel.user,
        id: reel.user.id.toString(),
      },
      // Thêm link streaming HLS nếu cần
      streaming_url: cloudName
        ? `https://res.cloudinary.com/${cloudName}/video/upload/sp_auto/${reel.public_id}.m3u8`
        : null,
    }));
  }

  async getUserReels(
    userId: string,
    cursor?: string,
    limit: number = 10,
    requestingUserId?: string,
  ) {
    const viewerId = requestingUserId || userId;
    const reels = await this.reelsRepository.findByUserId(
      BigInt(userId),
      cursor,
      limit,
    );

    const cloudName =
      process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_NAME;

    const nextCursor =
      reels.length === limit ? reels[reels.length - 1].id.toString() : null;

    // Check likes
    const likedReels = await this.reelLikeRepository.findLikesForReels(
      viewerId,
      reels.map((r) => r.id),
    );
    const likedReelIds = new Set(likedReels.map((lr) => lr.reel_id.toString()));

    return {
      items: reels.map((reel) => ({
        ...reel,
        id: reel.id.toString(),
        user_id: reel.user_id.toString(),
        has_liked: likedReelIds.has(reel.id.toString()),
        user: {
          ...reel.user,
          id: reel.user.id.toString(),
        },
        streaming_url: cloudName
          ? `https://res.cloudinary.com/${cloudName}/video/upload/sp_auto/${reel.public_id}.m3u8`
          : null,
      })),
      nextCursor,
      hasMore: reels.length === limit,
    };
  }
}
