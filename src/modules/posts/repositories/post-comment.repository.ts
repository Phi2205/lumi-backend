import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class PostCommentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: bigint | number | string) {
    return this.prisma.post_comments.findUnique({
      where: { id: BigInt(id) },
    });
  }

  async create(data: {
    user_id: bigint | number | string;
    post_id: bigint | number | string;
    content: string;
    parent_id?: bigint | number | string | null;
    depth: number;
  }) {
    return this.prisma.post_comments.create({
      data: {
        user_id: BigInt(data.user_id),
        post_id: BigInt(data.post_id),
        content: data.content,
        parent_id: data.parent_id ? BigInt(data.parent_id) : null,
        depth: data.depth,
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
  }

  async findByPostId(
    postId: bigint | number | string,
    skip?: number,
    take?: number,
  ) {
    return this.prisma.post_comments.findMany({
      where: {
        post_id: BigInt(postId),
        parent_id: null, // Get root comments (depth = 0)
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
    });
  }

  async findByParentId(
    parentId: bigint | number | string,
    skip?: number,
    take?: number,
  ) {
    return this.prisma.post_comments.findMany({
      where: {
        parent_id: BigInt(parentId),
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
    });
  }

  async countByPostId(postId: bigint | number | string) {
    return this.prisma.post_comments.count({
      where: {
        post_id: BigInt(postId),
        parent_id: null,
      },
    });
  }

  async countByParentId(parentId: bigint | number | string) {
    return this.prisma.post_comments.count({
      where: {
        parent_id: BigInt(parentId),
      },
    });
  }

  async delete(id: bigint | number | string, tx?: Prisma.TransactionClient) {
    return (tx || this.prisma).post_comments.delete({
      where: {
        id: BigInt(id),
      },
    });
  }
}
