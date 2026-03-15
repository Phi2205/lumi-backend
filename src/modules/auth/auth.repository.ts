import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AuthRepository {
  constructor(private prisma: PrismaService) { }

  /**
   * Tìm user theo email
   */
  async findByEmail(email: string) {
    return this.prisma.users.findUnique({
      where: { email },
      include: { user_location: true },
    });
  }

  /**
   * Tìm user theo id
   */
  async findById(id: bigint | string | number) {
    return this.prisma.users.findUnique({
      where: { id: BigInt(id) },
      include: { user_location: true },
    });
  }

  /**
   * Tìm user theo username
   */
  async findByUsername(username: string) {
    return this.prisma.users.findUnique({
      where: { username },
      include: { user_location: true },
    });
  }

  /**
   * Tạo user mới
   */
  async createUser(data: {
    email: string;
    username: string;
    name: string;
    password_hash: string;
  }) {
    return this.prisma.users.create({
      data: {
        email: data.email,
        username: data.username,
        name: data.name,
        password_hash: data.password_hash,
      },
      include: { user_location: true },
    });
  }
}
