import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByName(
    name: string | undefined,
    skip: number,
    take: number,
  ) {
    const where = name
      ? {
          name: {
            contains: name,
            mode: 'insensitive' as const,
          },
        }
      : undefined;

    const [data, total] = await Promise.all([
      this.prisma.users.findMany({
        where,
        select: {
          id: true,
          username: true,
          name: true,
          email: true,
          avatar_url: true,
          bio: true,
          created_at: true,
        },
        orderBy: {
          name: 'asc',
        },
        skip,
        take,
      }),
      this.prisma.users.count({ where }),
    ]);

    return { data, total };
  }

  async findByUsername(username: string) {
    return this.prisma.users.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        avatar_url: true,
        bio: true,
        created_at: true,
      },
    });
  }
}

