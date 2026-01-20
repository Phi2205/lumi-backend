import { Injectable } from '@nestjs/common';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  // Tìm kiếm user theo name (chứa chuỗi, không phân biệt hoa/thường)
  async findByName(
    name?: string,
    page = 1,
    limit = 20,
  ) {
    const safePage = page < 1 ? 1 : page;
    const safeLimit = limit < 1 ? 1 : limit;
    const skip = (safePage - 1) * safeLimit;

    const { data, total } = await this.usersRepository.findByName(
      name,
      skip,
      safeLimit,
    );

    const serializedData = data.map((user) => ({
      ...user,
      id: user.id.toString(),
    }));

    return {
      data: serializedData,
      total,
      page: safePage,
      limit: safeLimit,
    };
  }
}
