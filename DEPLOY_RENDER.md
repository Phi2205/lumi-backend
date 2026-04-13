# Hướng dẫn deploy NestJS lên Render bằng Docker

Tài liệu này hướng dẫn các bước để deploy ứng dụng NestJS của bạn lên Render.com sử dụng Docker.

## 1. Tối ưu hóa Dockerfile (Khuyên dùng)

Hiện tại `Dockerfile` của bạn đang chạy trực tiếp bằng `ts-node`, điều này không tối ưu cho môi trường production. Chúng ta nên chuyển sang multi-stage build để ứng dụng nhẹ và nhanh hơn.

### Cập nhật Dockerfile
```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files và prisma schema
COPY package*.json ./
COPY prisma ./prisma/

# Install tất cả dependencies (bao gồm devDeps để build)
RUN npm install

# Copy source code
COPY . .

# Generate Prisma Client và Build project
RUN npx prisma generate
RUN npm run build

# Stage 2: Runner
FROM node:20-alpine

WORKDIR /app

# Copy các file cần thiết từ builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Mở cổng (Render sẽ tự động ghi đè bằng biến môi trường PORT)
EXPOSE 4000

# Chạy lệnh start:prod đã có trong package.json
CMD ["npm", "run", "start:prod"]
```

## 2. Các bước thực hiện trên Render Dashboard

### Bước 1: Tạo Web Service mới
1. Đăng nhập vào [Render.com](https://render.com/).
2. Nhấn nút **New +** và chọn **Web Service**.
3. Kết nối với repository GitHub/GitLab chứa code của bạn.

### Bước 2: Cấu hình Web Service
1. **Name**: Đặt tên cho service (ví dụ: `lumi-backend`).
2. **Region**: Chọn vùng gần bạn nhất (ví dụ: `Singapore` cho Việt Nam).
3. **Branch**: Chọn branch bạn muốn deploy (thường là `main` hoặc `master`).
4. **Runtime**: Chọn **Docker**. (Render sẽ tự động tìm thấy file `Dockerfile` ở root).

### Bước 3: Cấu hình Biến môi trường (Environment Variables)
Nhấn vào nút **Advanced** hoặc tab **Environment** để thêm các biến cần thiết từ file `.env` của bạn:
- `PORT`: `4000` (Render sẽ tự động gán cổng thực tế vào biến này, NestJS sẽ lắng nghe theo).
- `DATABASE_URL`: URL kết nối Database của bạn (PostgreSQL).
- `FRONT_END_URL`: URL của frontend đã deploy.
- `JWT_SECRET`, `REDIS_URL`, v.v.

> [!IMPORTANT]
> Nếu bạn sử dụng **Render PostgreSQL** hoặc **Render Redis**, hãy copy URL kết nối từ các service đó dán vào đây.

### Bước 4: Deploy
1. Nhấn **Create Web Service**.
2. Render sẽ bắt đầu build Docker image và deploy. Bạn có thể theo dõi log ở tab **Logs**.

## 3. Lưu ý quan trọng
- **Database**: Nếu DB của bạn nằm trên Render, hãy đảm bảo gán đúng `DATABASE_URL`.
- **Redis**: Trong `package.json` có `ioredis`, hãy chắc chắn đã tạo Redis instance (ví dụ trên Render hoặc Upstash).
- **Prisma**: Dockerfile trên đã bao gồm `npx prisma generate` để đảm bảo client được tạo đúng cho môi trường Linux.

## 4. Kiểm tra sau khi Deploy
Sau khi log báo `🚀 Server is running on: ...`, truy cập vào URL mà Render cung cấp phối hợp với path `/docs` để kiểm tra Swagger.
