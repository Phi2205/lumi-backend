import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class PostsRepository {
  constructor(private prisma: PrismaService) {}

  /**
   * Tạo post (hỗ trợ tạo nhiều media thông qua relation post_media)
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
    return this.prisma.posts.create({
      data: {
        user_id: BigInt(data.user_id),
        content: data.content ?? null,
        ...(data.media?.length
          ? {
              post_media: {
                create: data.media.map((m, idx) => ({
                  media_url: m.media_url,
                  media_type: m.media_type,
                  order: m.order ?? idx,
                })),
              },
            }
          : {}),
      },
      include: {
        post_media: {
          orderBy: { order: 'asc' },
        },
      },
    });
  }

  /**
   * Lấy post theo id
   */
  async findById(id: bigint | number | string) {
    return this.prisma.posts.findUnique({
      where: { id: BigInt(id) },
      include: {
        post_media: { orderBy: { order: 'asc' } },
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
  }

  /**
   * Lấy danh sách post của 1 user
   */
  async findByUserId(
    userId: bigint | number | string,
    skip?: number,
    take?: number,
  ) {
    return this.prisma.posts.findMany({
      where: { user_id: BigInt(userId) },
      include: { post_media: { orderBy: { order: 'asc' } } },
      orderBy: { created_at: 'desc' },
      skip,
      take,
    });
  }

  /**
   * Xóa post (cascade sẽ xóa post_media, comments, likes nếu FK onDelete: Cascade)
   */
  async delete(id: bigint | number | string) {
    return this.prisma.posts.delete({
      where: { id: BigInt(id) },
    });
  }
}

