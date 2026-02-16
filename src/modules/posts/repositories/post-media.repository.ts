import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class PostMediaRepository {
  constructor(private prisma: PrismaService) {}

  /**
   * Tạo một post media
   */
  async create(data: {
    post_id: bigint | number | string;
    media_url: string;
    media_type: string;
    order?: number;
  }) {
    return this.prisma.post_media.create({
      data: {
        post_id: BigInt(data.post_id),
        media_url: data.media_url,
        media_type: data.media_type,
        order: data.order ?? 0,
      },
    });
  }

  /**
   * Tạo nhiều post media cùng lúc
   */
  async createMany(
    postId: bigint | number | string,
    mediaItems: Array<{
      media_url: string;
      media_type: string;
      order?: number;
    }>,
  ) {
    return this.prisma.post_media.createMany({
      data: mediaItems.map((item, index) => ({
        post_id: BigInt(postId),
        media_url: item.media_url,
        media_type: item.media_type,
        order: item.order ?? index,
      })),
    });
  }

  /**
   * Tìm tất cả media của một post
   */
  async findByPostId(postId: bigint | number | string) {
    return this.prisma.post_media.findMany({
      where: {
        post_id: BigInt(postId),
      },
      orderBy: {
        order: 'asc',
      },
    });
  }

  /**
   * Tìm post media theo id
   */
  async findById(id: bigint | number | string) {
    return this.prisma.post_media.findUnique({
      where: {
        id: BigInt(id),
      },
    });
  }

  /**
   * Xóa một post media
   */
  async delete(id: bigint | number | string) {
    return this.prisma.post_media.delete({
      where: {
        id: BigInt(id),
      },
    });
  }

  /**
   * Xóa tất cả media của một post
   */
  async deleteByPostId(postId: bigint | number | string) {
    return this.prisma.post_media.deleteMany({
      where: {
        post_id: BigInt(postId),
      },
    });
  }

  /**
   * Cập nhật thứ tự của media
   */
  async updateOrder(id: bigint | number | string, order: number) {
    return this.prisma.post_media.update({
      where: {
        id: BigInt(id),
      },
      data: {
        order,
      },
    });
  }

  /**
   * Cập nhật nhiều media cùng lúc (dùng để sắp xếp lại thứ tự)
   */
  async updateOrders(
    updates: Array<{
      id: bigint | number | string;
      order: number;
    }>,
  ) {
    return Promise.all(
      updates.map((update) =>
        this.prisma.post_media.update({
          where: {
            id: BigInt(update.id),
          },
          data: {
            order: update.order,
          },
        }),
      ),
    );
  }

  /**
   * Đếm số lượng media của một post
   */
  async countByPostId(postId: bigint | number | string) {
    return this.prisma.post_media.count({
      where: {
        post_id: BigInt(postId),
      },
    });
  }
}
