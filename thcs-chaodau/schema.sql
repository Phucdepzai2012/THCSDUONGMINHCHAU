-- Bảng bài viết
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  cat TEXT NOT NULL,              -- 'Tin tức' | 'Sự kiện' | 'Thông báo' | 'Tuyển sinh'
  date TEXT,                       -- ISO date 'YYYY-MM-DD'
  icon TEXT DEFAULT '📰',          -- emoji
  color INTEGER DEFAULT 0,         -- 0-5 tương ứng class bg0-bg5
  excerpt TEXT,                    -- mô tả ngắn
  content TEXT,                    -- nội dung chi tiết
  image_url TEXT,                  -- URL ảnh (từ R2)
  image_path TEXT,                 -- key trong R2
  created_at INTEGER               -- timestamp ms
);

-- Bảng thông báo chạy chữ
CREATE TABLE IF NOT EXISTS notices (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at INTEGER
);

-- Bảng văn bản PDF
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,              -- số/ký hiệu văn bản
  title TEXT NOT NULL,
  date TEXT,                       -- ngày ban hành
  description TEXT,
  file_url TEXT,                   -- URL file PDF
  file_path TEXT,                  -- key trong R2
  file_name TEXT,                  -- tên file gốc
  created_at INTEGER
);

-- Bảng cài đặt trang (chỉ 1 row với key='site')
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT                       -- JSON string
);

-- Bảng đếm lượt truy cập
CREATE TABLE IF NOT EXISTS visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day TEXT,                        -- 'YYYY-MM-DD'
  ts INTEGER                       -- timestamp ms
);

-- Bảng presence (session online)
CREATE TABLE IF NOT EXISTS presence (
  sid TEXT PRIMARY KEY,            -- session id
  last_seen INTEGER                -- timestamp ms
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_posts_cat ON posts(cat);
CREATE INDEX IF NOT EXISTS idx_posts_date ON posts(date DESC);
CREATE INDEX IF NOT EXISTS idx_visits_day ON visits(day);
CREATE INDEX IF NOT EXISTS idx_presence_seen ON presence(last_seen);
