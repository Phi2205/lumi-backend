/**
 * Pagination utilities
 */

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginationResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

/**
 * Parse và validate pagination parameters từ query string
 * @param page - Page number từ query (string hoặc number)
 * @param limit - Limit từ query (string hoặc number)
 * @param defaultPage - Default page number (mặc định: 1)
 * @param defaultLimit - Default limit (mặc định: 20)
 * @param maxLimit - Maximum limit allowed (mặc định: 100)
 * @returns PaginationParams với page, limit, và offset đã được validate
 */
export function parsePaginationParams(
  page?: string | number,
  limit?: string | number,
  defaultPage: number = 1,
  defaultLimit: number = 20,
  maxLimit: number = 100,
): PaginationParams {
  // Parse page
  let pageNumber: number;
  if (typeof page === 'string') {
    pageNumber = parseInt(page, 10);
    if (isNaN(pageNumber) || pageNumber < 1) {
      pageNumber = defaultPage;
    }
  } else if (typeof page === 'number') {
    pageNumber = page < 1 ? defaultPage : page;
  } else {
    pageNumber = defaultPage;
  }

  // Parse limit
  let limitNumber: number;
  if (typeof limit === 'string') {
    limitNumber = parseInt(limit, 10);
    if (isNaN(limitNumber) || limitNumber < 1) {
      limitNumber = defaultLimit;
    }
  } else if (typeof limit === 'number') {
    limitNumber = limit < 1 ? defaultLimit : limit;
  } else {
    limitNumber = defaultLimit;
  }

  // Giới hạn limit tối đa
  if (limitNumber > maxLimit) {
    limitNumber = maxLimit;
  }

  // Tính offset
  const offset = (pageNumber - 1) * limitNumber;

  return {
    page: pageNumber,
    limit: limitNumber,
    offset,
  };
}

/**
 * Tạo pagination metadata từ kết quả query
 * @param page - Current page number
 * @param limit - Items per page
 * @param total - Total number of items
 * @returns PaginationMeta với đầy đủ thông tin phân trang
 */
export function createPaginationMeta(
  page: number,
  limit: number,
  total: number,
): PaginationMeta {
  const totalPages = Math.ceil(total / limit);

  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

/**
 * Tạo pagination response chuẩn
 * @param data - Array of data items
 * @param page - Current page number
 * @param limit - Items per page
 * @param total - Total number of items
 * @returns PaginationResponse với data và pagination metadata
 */
export function createPaginationResponse<T>(
  data: T[],
  page: number,
  limit: number,
  total: number,
): PaginationResponse<T> {
  return {
    data,
    pagination: createPaginationMeta(page, limit, total),
  };
}
