import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) { }

  async findByName(name: string | undefined, skip: number, take: number) {
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
          cover_image: true,
          bio: true,
          user_location: true,
          birthday: true,
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
        cover_image: true,
        bio: true,
        user_location: true,
        birthday: true,
        created_at: true,
      },
    });
  }

  async findById(id: bigint | string) {
    return this.prisma.users.findUnique({
      where: { id: BigInt(id) },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        avatar_url: true,
        cover_image: true,
        bio: true,
        user_location: true,
        birthday: true,
        created_at: true,
      },
    });
  }

  async findByIds(ids: string[]) {
    return this.prisma.users.findMany({
      where: {
        id: {
          in: ids.map((id) => BigInt(id)),
        },
      },
      select: {
        id: true,
        username: true,
        name: true,
        avatar_url: true,
      },
    });
  }

  async updateProfile(
    userId: bigint | string,
    data: { bio?: string; birthday?: Date; user_location?: any },
  ) {
    const { user_location, ...userData } = data;
    return this.prisma.users.update({
      where: { id: BigInt(userId) },
      data: {
        ...userData,
        ...(user_location
          ? {
            user_location: {
              upsert: {
                create: user_location,
                update: user_location,
              },
            },
          }
          : {}),
      },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        avatar_url: true,
        cover_image: true,
        bio: true,
        user_location: true,
        birthday: true,
        created_at: true,
      },
    });
  }

  async updateAvatar(userId: bigint | string, avatarUrl: string) {
    return this.prisma.users.update({
      where: { id: BigInt(userId) },
      data: {
        avatar_url: avatarUrl,
      },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        avatar_url: true,
      },
    });
  }

  async updateCoverImage(userId: bigint | string, coverImageUrl: string) {
    return this.prisma.users.update({
      where: { id: BigInt(userId) },
      data: {
        cover_image: coverImageUrl,
      },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        cover_image: true,
      },
    });
  }
}
