-- Run this once in your Neon DB (SQL editor or psql)

CREATE TABLE IF NOT EXISTS post_scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  competitor_post_id UUID REFERENCES competitor_posts(id) ON DELETE CASCADE,
  post_url TEXT,
  transcript TEXT,
  hook TEXT,
  hook_type TEXT,
  body_structure TEXT,
  cta TEXT,
  tone TEXT,
  key_phrases JSONB DEFAULT '[]',
  analyzed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(post_id),
  UNIQUE(competitor_post_id)
);

CREATE TABLE IF NOT EXISTS generated_scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  inspired_by_competitor_id UUID REFERENCES competitors(id) ON DELETE SET NULL,
  topic TEXT,
  full_script TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
