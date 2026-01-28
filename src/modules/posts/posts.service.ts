import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { PostsRepository } from './posts.repository';
import { PostMediaRepository } from '../post-media/post-media.repository';

@Injectable()
export class PostsService {
  constructor(
    private prisma: PrismaService,
    private postsRepository: PostsRepository,
    private postMediaRepository: PostMediaRepository,
  ) {}

  /**
   * Tạo post với transaction
   * Sử dụng cả 2 repository: PostsRepository và PostMediaRepository
   */
  async createPost(data: {
    user_id: bigint | number | string;
    content?: string | null;
    media?: Array<{
      media_url: string;
      media_type: string;
      order?: number;
    }>;
  }) {
    // Sử dụng Prisma transaction để đảm bảo tính nhất quán
    return this.prisma.$transaction(async (tx) => {
      // 1. Tạo post và trả về luôn user (post_media sẽ được tạo ở bước 2)
      const post = await tx.posts.create({
        data: {
          user_id: BigInt(data.user_id),
          content: data.content ?? null,
        },
        include: {
          users: {
            select: {
              id: true,
              username: true,
              name: true,
              avatar_url: true,
            },
          },
        },
      });

      // 2. Nếu có media, tạo media bằng PostMediaRepository.createMany
      // Sử dụng transaction client để đảm bảo atomicity
      if (data.media && data.media.length > 0) {
        await tx.post_media.createMany({
          data: data.media.map((item, index) => ({
            post_id: post.id,
            media_url: item.media_url,
            media_type: item.media_type,
            order: item.order ?? index,
          })),
        });
      }

      // 3. Lấy media của post (createMany không return records)
      const media = await tx.post_media.findMany({
        where: { post_id: post.id },
        orderBy: { order: 'asc' },
      });

      return {
        success: true,
        message: 'Post created successfully',
        data: {
          id: post.id.toString(),
          user_id: post.user_id.toString(),
          content: post.content,
          created_at: post.created_at,
          user: {
            id: post.users.id.toString(),
            username: post.users.username,
            name: post.users.name,
            avatar_url: post.users.avatar_url,
          },
          post_media: media.map((m) => ({
            id: m.id.toString(),
            media_url: m.media_url,
            media_type: m.media_type,
            order: m.order,
            created_at: m.created_at,
          })),
        },
      };
    });
  }
}
