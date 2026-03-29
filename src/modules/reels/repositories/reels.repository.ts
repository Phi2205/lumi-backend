import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ReelsRepository {
  constructor(private prisma: PrismaService) { }

  async create(data: {
    user_id: bigint;
    video_url: string;
    public_id: string;
    thumbnail_url: string | null;
    caption?: string;
    music_name?: string;
    duration?: number | null;
  }) {
    return this.prisma.reels.create({
      data,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar_url: true,
          },
        },
      },
    });
  }

  async findMany(skip: number, take: number) {
    return this.prisma.reels.findMany({
      skip,
      take,
      orderBy: { created_at: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar_url: true,
          },
        },
      },
    });
  }

  async findByUserId(userId: bigint, cursor?: string, limit: number = 10) {
    return this.prisma.reels.findMany({
      where: {
        user_id: userId,
        ...(cursor ? { id: { lt: BigInt(cursor) } } : {}),
      },
      take: limit,
      orderBy: { created_at: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar_url: true,
          },
        },
      },
    });
  }

  async findById(id: bigint) {
    return this.prisma.reels.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar_url: true,
          },
        },
      },
    });
  }

  async incrementCommentCount(id: bigint | number | string, tx?: any) {
    return (tx || this.prisma).reels.update({
      where: { id: BigInt(id) },
      data: { comment_count: { increment: 1 } },
    });
  }

  async decrementCommentCount(id: bigint | number | string, tx?: any) {
    return (tx || this.prisma).reels.update({
      where: { id: BigInt(id) },
      data: { comment_count: { decrement: 1 } },
    });
  }

  async incrementViewCount(id: bigint | number | string) {
    return this.prisma.reels.update({
      where: { id: BigInt(id) },
      data: { view_count: { increment: 1 } },
    });
  }
}
