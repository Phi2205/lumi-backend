# Hướng dẫn sử dụng Module Realtime

Module `Realtime` cung cấp khả năng giao tiếp thời gian thực (WebSocket) cho ứng dụng, sử dụng thư viện `socket.io` và `redis-adapter` để hỗ trợ scaling.

## 1. Cấu trúc

Module bao gồm các thành phần chính:
- **`RealtimeModule`**: Module chính, quản lý các gateway và service.
- **`RealtimeService`**: Service cung cấp các phương thức để gửi tin nhắn (emit events) từ server xuống client.
- **`NotificationGateway`**: Gateway chính để xử lý kết nối, xác thực người dùng và quản lý room.
- **Các Gateway khác**: `PostGateway`, `CommentGateway`, `ChatGateway` xử lý logic cụ thể cho từng tính năng.

## 2. Xác thực (Authentication)

Client khi kết nối cần cung cấp JWT token để xác thực. Token có thể được gửi qua:
- `auth.token`: (Khuyên dùng)
- `headers.authorization`: Bearer token.

Khi xác thực thành công, user sẽ tự động join vào room riêng có tên là `userId` của họ.

## 3. Cách sử dụng trong Backend (NestJS)

Để sử dụng tính năng realtime trong các module khác (ví dụ: `UserModule`, `PostModule`), bạn cần thực hiện các bước sau:

### Bước 1: Import `RealtimeModule`

Import `RealtimeModule` vào module bạn muốn sử dụng:

```typescript
// some.module.ts
import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { SomeService } from './some.service';

@Module({
  imports: [RealtimeModule], // <--- Import RealtimeModule
  providers: [SomeService],
})
export class SomeModule {}
```

### Bước 2: Inject `RealtimeService`

Inject `RealtimeService` vào service hoặc controller của bạn:

```typescript
// some.service.ts
import { Injectable } from '@nestjs/common';
import { RealtimeService } from '../realtime/realtime.service';
import { RealtimeGateway } from '../realtime/gateways/realtime.gateway'; // Or use string token if needed

@Injectable()
export class SomeService {
  constructor(
    private readonly realtimeService: RealtimeService // <--- Inject service
  ) {}

  async notifyUser(userId: string, message: string) {
    // Gửi sự kiện 'notification' tới user cụ thể
    this.realtimeService.emitToUser(userId, 'notification', { message });
  }

  async broadcastUpdate(data: any) {
    // Gửi sự kiện 'update' tới tất cả user đang kết nối
    this.realtimeService.emitToAll('update', data);
  }
}
```

### Các phương thức có sẵn trong `RealtimeService`:

- `emitToUser(userId: string, event: string, data: any)`: Gửi event tới một user cụ thể.
- `emitToAll(event: string, data: any)`: Gửi event tới tất cả user.
- `emitToRoom(room: string, event: string, data: any)`: Gửi event tới một room cụ thể.

## 4. Cách sử dụng ở Client (Frontend)

Sử dụng thư viện `socket.io-client` để kết nối:

```javascript
import { io } from "socket.io-client";

const socket = io("http://localhost:3000", {
  auth: {
    token: "Bearer YOUR_JWT_TOKEN" // <--- Token xác thực
  }
});

socket.on("connect", () => {
  console.log("Connected to server");
});

// Lắng nghe sự kiện từ server
socket.on("notification", (data) => {
  console.log("Received notification:", data);
});

socket.on("disconnect", () => {
  console.log("Disconnected");
});
```
