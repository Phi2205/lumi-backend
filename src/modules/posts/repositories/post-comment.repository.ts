import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

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
        replies: {
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
          orderBy: {
            created_at: 'asc',
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

  async countByPostId(postId: bigint | number | string) {
    return this.prisma.post_comments.count({
      where: {
        post_id: BigInt(postId),
        parent_id: null,
      },
    });
  }
}
