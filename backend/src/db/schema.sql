-- Run this once against your Railway PostgreSQL instance

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform VARCHAR(20) NOT NULL CHECK (platform IN ('instagram','tiktok','facebook','youtube','x')),
  handle VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  profile_picture_url TEXT,
  followers_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  posts_count INTEGER DEFAULT 0,
  bio TEXT,
  last_scraped_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(platform, handle)
);

CREATE TABLE IF NOT EXISTS metrics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  followers_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  posts_count INTEGER DEFAULT 0,
  avg_engagement_rate DECIMAL(6,3) DEFAULT 0,
  snapshot_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(account_id, snapshot_date)
);

CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  platform_post_id VARCHAR(255),
  content_type VARCHAR(50),
  caption TEXT,
  media_url TEXT,
  thumbnail_url TEXT,
  post_url TEXT,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  saves_count INTEGER DEFAULT 0,
  views_count INTEGER DEFAULT 0,
  engagement_rate DECIMAL(6,3) DEFAULT 0,
  posted_at TIMESTAMP,
  scraped_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(account_id, platform_post_id)
);

CREATE TABLE IF NOT EXISTS competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform VARCHAR(20) NOT NULL,
  handle VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  profile_picture_url TEXT,
  followers_count INTEGER DEFAULT 0,
  posts_count INTEGER DEFAULT 0,
  avg_engagement_rate DECIMAL(6,3) DEFAULT 0,
  notes TEXT,
  last_scraped_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(platform, handle)
);

CREATE TABLE IF NOT EXISTS competitor_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id UUID REFERENCES competitors(id) ON DELETE CASCADE,
  platform_post_id VARCHAR(255),
  content_type VARCHAR(50),
  caption TEXT,
  media_url TEXT,
  thumbnail_url TEXT,
  post_url TEXT,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  views_count INTEGER DEFAULT 0,
  engagement_rate DECIMAL(6,3) DEFAULT 0,
  posted_at TIMESTAMP,
  scraped_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(competitor_id, platform_post_id)
);

CREATE TABLE IF NOT EXISTS ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  insight_type VARCHAR(50),
  content TEXT,
  raw_data JSONB,
  generated_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '24 hours'
);

CREATE INDEX IF NOT EXISTS idx_posts_account_id ON posts(account_id);
CREATE INDEX IF NOT EXISTS idx_posts_posted_at ON posts(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_account_date ON metrics_snapshots(account_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_competitor_posts_competitor_id ON competitor_posts(competitor_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_account ON ai_insights(account_id, insight_type);
