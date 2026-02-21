# Hướng Dẫn Sử Dụng Socket Realtime

Tài liệu này hướng dẫn cách tích hợp và sử dụng hệ thống WebSocket (Socket.IO) trong Lumi Backend để xây dựng các tính năng thời gian thực như Bình luận (Comments), Chat và Thông báo (Notifications).

## 1. Tổng Quan Kết Nối

Module Realtime sử dụng thư viện `socket.io`.

- **Endpoint Websocket**: `ws://<HOST>:<PORT>` (Ví dụ: `ws://localhost:4000`)
- **Path**: `/socket.io/` (Mặc định)
- **Namespace**: `/` (Mặc định cho tất cả các tính năng hiện tại)

### Xác Thực (Authentication)

Để kết nối thành công, Client **bắt buộc** phải gửi kèm JWT Token hợp lệ. Nếu không có token hoặc token hết hạn, kết nối có thể bị từ chối hoặc người dùng sẽ bị gán quyền `guest`.

Cách gửi Token từ Client (Sử dụng `socket.io-client`):

1.  **Qua `auth` object (Khuyên dùng)**:
    ```javascript
    import { io } from "socket.io-client";

    const socket = io("http://localhost:4000", {
      auth: {
        token: "Bearer <YOUR_JWT_TOKEN>" // Token lấy từ login
      }
    });
    ```

2.  **Qua `headers`**:
    ```javascript
    const socket = io("http://localhost:4000", {
      transportOptions: {
        polling: {
          extraHeaders: {
            Authorization: "Bearer <YOUR_JWT_TOKEN>"
          }
        }
      }
    });
    ```

---

## 2. Tính Năng & Sự Kiện (Events)

### A. Bình Luận (Real-time Comments)

Sử dụng để cập nhật bình luận mới ngay lập tức khi người dùng đang xem bài viết.

**Quy trình:**
1.  Client kết nối Socket.
2.  Khi người dùng vào xem chi tiết bài viết (hoặc mở modal comment), Client gửi sự kiện `join_post`.
3.  Khi có ai đó bình luận, Server sẽ gửi sự kiện `new_comment` tới **tất cả** Client đang join bài viết đó.
4.  Khi người dùng rời bài viết, Client gửi sự kiện `leave_post`.

#### 1. Tham gia phòng (`join_post`)
Gửi khi bắt đầu xem bài viết.

- **Event Name**: `join_post`
- **Payload**:
  ```json
  {
    "postId": "550e8400-e29b-41d4-a716-446655440000"
  }
  ```
- **Xử lý Server**: Add socket id vào room `post:<postId>`.

#### 2. Rời phòng (`leave_post`)
Gửi khi ngừng xem bài viết để tránh nhận thông báo thừa.

- **Event Name**: `leave_post`
- **Payload**:
  ```json
  {
    "postId": "550e8400-e29b-41d4-a716-446655440000"
  }
  ```
- **Xử lý Server**: Remove socket id khỏi room `post:<postId>`.

#### 3. Gửi bình luận (`new_comment`) [Client -> Server]
Gửi nội dung bình luận lên server. (Ngoài ra có thể dùng REST API, nhưng nếu dùng Socket thì dùng event này).

- **Event Name**: `new_comment`
- **Payload**:
  ```json
  {
    "postId": "550e8400-e29b-41d4-a716-446655440000",
    "content": "Bài viết rất hay!",
    "parentId": null // Hoặc UUID của comment cha nếu là reply
  }
  ```
- **Phản hồi**: Server sẽ broadcast lại sự kiện `new_comment` cho mọi người trong room.

#### 4. Nhận bình luận mới (`new_comment`) [Server -> Client]
Lắng nghe để cập nhật UI.

- **Event Name**: `new_comment`
- **Data (Response Structure)**:
  ```json
  {
    "success": true,
    "message": "Comment created successfully",
    "data": {
      "id": "1",
      "post_id": "...",
      "user_id": "...",
      "content": "Bài viết rất hay!",
      "parent_id": null,
      "depth": 0,
      "created_at": "2024-02-19T...",
      "user": {
        "id": "...",
        "username": "...",
        "name": "...",
        "avatar_url": "..."
      }
    }
  }
  ```

---

### B. Chat (Nhắn Tin)

Hiện tại hỗ trợ gửi nhận tin nhắn cơ bản (Broadcast hoặc P2P tuỳ logic mở rộng).

#### 1. Gửi tin nhắn (`send_message`)
- **Event Name**: `send_message`
- **Payload**: Object tin nhắn (Tuỳ định nghĩa client/server).
  ```json
  {
    "content": "Hello world",
    "receiverId": "..."
  }
  ```

#### 2. Nhận tin nhắn (`receive_message`)
- **Event Name**: `receive_message`
- **Data**: Object tin nhắn vừa nhận.

---

### C. Thông Báo (Notifications)

Mỗi User sau khi đăng nhập và kết nối Socket sẽ tự động được join vào một "Room riêng" trùng với `userId` của họ.

- **Room Name**: `<UserId>` (Ví dụ: `user-123-uuid`)
- **Cách dùng**: Server có thể gửi thông báo riêng tới từng user thông qua room này.
- **Sự kiện (Ví dụ)**: `new_notification` (Cần định nghĩa thêm trong tương lai nếu chưa có).

---

### D. Bài Viết Mới (New Posts)

- **Event Name**: `new_post`
- **Mô tả**: Hiện tại chỉ log sự kiện nhận được bài viết mới, chưa có broadcast tới Feed của người dùng.

---

## Tóm Tắt Code Mẫu (Client React)

```javascript
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const useSocket = (token, postId) => {
  const [socket, setSocket] = useState(null);
  const [comments, setComments] = useState([]);

  useEffect(() => {
    // 1. Khởi tạo connection
    const newSocket = io('http://localhost:4000', {
      auth: { token: `Bearer ${token}` }
    });

    setSocket(newSocket);

    // 2. Lắng nghe sự kiện connect
    newSocket.on('connect', () => {
      console.log('Connected to socket');
      
      // 3. Join vào room bài viết
      if (postId) {
        newSocket.emit('join_post', { postId });
      }
    });

    // 4. Lắng nghe comment mới
    newSocket.on('new_comment', (response) => {
      // response là kết quả trả về từ createComment service
      if (response && response.data) {
        setComments(prev => [...prev, response.data]);
      }
    });

    // Cleanup
    return () => {
      if (postId) {
        newSocket.emit('leave_post', { postId });
      }
      newSocket.disconnect();
    };
  }, [token, postId]);

  const sendComment = (content) => {
    if (socket) {
      socket.emit('new_comment', { postId, content });
    }
  };

  return { comments, sendComment };
};
```
