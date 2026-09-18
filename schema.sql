-- Chạy: wrangler d1 execute duongminhchau --file=./schema.sql --remote

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  cat TEXT NOT NULL,
  date TEXT,
  icon TEXT DEFAULT '📰',
  color INTEGER DEFAULT 0,
  excerpt TEXT,
  content TEXT,
  image_url TEXT,
  image_path TEXT,
  created_at INTEGER
);

CREATE TABLE IF NOT EXISTS notices (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at INTEGER
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  date TEXT,
  description TEXT,
  file_url TEXT,
  file_path TEXT,
  file_name TEXT,
  created_at INTEGER
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day TEXT,
  ts INTEGER
);

CREATE TABLE IF NOT EXISTS presence (
  sid TEXT PRIMARY KEY,
  last_seen INTEGER
);

CREATE INDEX IF NOT EXISTS idx_posts_cat ON posts(cat);
CREATE INDEX IF NOT EXISTS idx_visits_day ON visits(day);
CREATE INDEX IF NOT EXISTS idx_presence_seen ON presence(last_seen);
