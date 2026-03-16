import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class ReelCommentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: bigint | number | string) {
    return this.prisma.reel_comments.findUnique({
      where: { id: BigInt(id) },
    });
  }

  async create(data: {
    user_id: bigint | number | string;
    reel_id: bigint | number | string;
    content: string;
    parent_id?: bigint | number | string | null;
    depth: number;
  }) {
    return this.prisma.reel_comments.create({
      data: {
        user_id: BigInt(data.user_id),
        reel_id: BigInt(data.reel_id),
        content: data.content,
        parent_id: data.parent_id ? BigInt(data.parent_id) : null,
        depth: data.depth,
      },
      include: {
        user: {
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

  async findByReelId(
    reelId: bigint | number | string,
    skip?: number,
    take?: number,
    cursor?: any,
  ) {
    return this.prisma.reel_comments.findMany({
      where: {
        reel_id: BigInt(reelId),
        parent_id: null, // Get root comments (depth = 0)
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            avatar_url: true,
          },
        },
        _count: {
          select: {
            replies: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
      skip,
      take,
      cursor,
    });
  }

  async findByParentId(
    parentId: bigint | number | string,
    skip?: number,
    take?: number,
    cursor?: any,
  ) {
    return this.prisma.reel_comments.findMany({
      where: {
        parent_id: BigInt(parentId),
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            avatar_url: true,
          },
        },
        _count: {
          select: {
            replies: true,
          },
        },
      },
      orderBy: {
        created_at: 'asc',
      },
      skip,
      take,
      cursor,
    });
  }

  async countByReelId(reelId: bigint | number | string) {
    return this.prisma.reel_comments.count({
      where: {
        reel_id: BigInt(reelId),
        parent_id: null,
      },
    });
  }

  async countByParentId(parentId: bigint | number | string) {
    return this.prisma.reel_comments.count({
      where: {
        parent_id: BigInt(parentId),
      },
    });
  }

  async delete(id: bigint | number | string, tx?: Prisma.TransactionClient) {
    return (tx || this.prisma).reel_comments.delete({
      where: {
        id: BigInt(id),
      },
    });
  }
}
