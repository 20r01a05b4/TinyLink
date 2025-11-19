CREATE TABLE IF NOT EXISTS links (
  code VARCHAR(8) PRIMARY KEY,
  target_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  clicks INTEGER DEFAULT 0,
  last_clicked TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_links_target_url ON links (target_url);
