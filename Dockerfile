# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Install openssl for Prisma
RUN apk add --no-cache openssl

# Copy package files và prisma schema
COPY package*.json ./
COPY tsconfig*.json ./
COPY prisma ./prisma/

# Install tất cả dependencies
RUN npm install

# Copy source code
COPY . .

# Generate Prisma Client và Build project
RUN npx prisma generate
RUN npm run build

# Stage 2: Runner
FROM node:20-alpine

WORKDIR /app

# Install openssl cho runtime Prisma
RUN apk add --no-cache openssl

# Copy các file cần thiết từ builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/tsconfig*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Render sẽ tự động cung cấp biến PORT
EXPOSE 4000

# Chạy lệnh start:prod
CMD ["npm", "run", "start:prod"]

