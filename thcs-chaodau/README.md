# THCS Chao Đâu — Cloudflare Workers + D1 + R2

## Cài đặt & Deploy
1. **Chuẩn bị local**:
   ```bash
   npm install
   npx wrangler login
   ```
2. **Tạo D1 Database**:
   ```bash
   npx wrangler d1 create duongminhchau
   # Copy database_id vào wrangler.toml
   ```
3. **Tạo R2 Bucket**:
   ```bash
   npx wrangler r2 bucket create chaodau-files
   npx wrangler r2 bucket create chaodau-files-dev
   ```
4. **Tạo bảng D1**:
   ```bash
   npx wrangler d1 execute duongminhchau --file=./schema.sql --remote
   ```
5. **Test local**:
   ```bash
   npm run dev
   # Mở http://localhost:8787
   ```
6. **Deploy**:
   ```bash
   npm run deploy
   ```

## Deploy tự động qua GitHub
1. Push repo lên GitHub
2. Cloudflare Dashboard → Workers & Pages → Create Application → Pages → Connect to Git
3. Chọn repo → Framework preset: None
4. Build command: `npx wrangler deploy`
5. Deploy command: `npx wrangler deploy`

> Lưu ý: với Worker + `wrangler deploy`, repo có thể deploy trực tiếp bằng Wrangler. Phần cấu hình Pages ở trên giữ theo quy trình yêu cầu; nếu Dashboard của bạn hiển thị Worker thay vì Pages, chọn luồng Workers tương ứng.

## Tài khoản admin mặc định
- Username: `admin`
- Password: `admin123` (đổi trong `wrangler.toml` biến `ADMIN_PASS`)
- JWT Secret: đổi biến `JWT_SECRET` trước khi production

## Upload ảnh / video / PDF / file
`POST /api/upload` nhận `multipart/form-data` với `file` và `folder`. File được lưu vào R2 và response trả về cả `path` và **URL tuyệt đối** dạng `https://ten-worker-cua-ban.../files/...`, nên có thể lưu URL đó vào D1 và dùng ngay trên website. Video cũng dùng cùng endpoint này; MIME type được giữ qua `Content-Type` của R2.

## Danh sách API
| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| POST | `/api/login` | ❌ | Đăng nhập |
| POST | `/api/logout` | ❌ | Đăng xuất |
| GET | `/api/posts` | ❌ | Danh sách bài viết |
| POST | `/api/posts` | ✅ | Tạo bài viết |
| DELETE | `/api/posts/:id` | ✅ | Xóa bài viết |
| GET | `/api/notices` | ❌ | Danh sách thông báo |
| POST | `/api/notices` | ✅ | Thêm thông báo |
| DELETE | `/api/notices/:id` | ✅ | Xóa thông báo |
| GET | `/api/documents` | ❌ | Danh sách văn bản |
| POST | `/api/documents` | ✅ | Đăng văn bản |
| DELETE | `/api/documents/:id` | ✅ | Xóa văn bản |
| GET | `/api/settings` | ❌ | Đọc cài đặt |
| POST | `/api/settings` | ✅ | Lưu cài đặt |
| GET | `/api/stats` | ❌ | Thống kê truy cập |
| POST | `/api/stats/hit` | ❌ | Ghi nhận 1 lượt |
| POST | `/api/presence` | ❌ | Heartbeat session |
| POST | `/api/upload` | ✅ | Upload file lên R2, trả URL |
| GET | `/files/*` | ❌ | Serve file từ R2 |

## Cấu trúc thư mục
```text
thcs-chaodau/
├── public/          # Static files (HTML/CSS/JS frontend)
├── src/             # Worker source code
├── wrangler.toml    # Cấu hình Cloudflare
├── schema.sql       # Schema D1
└── package.json
```
