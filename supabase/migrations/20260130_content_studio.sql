-- Content Studio: Tables for trends, scripts, and Instagram metrics

-- 1. Content Trends (scraped from social media)
CREATE TABLE IF NOT EXISTS content_trends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL CHECK (source IN ('instagram', 'tiktok', 'twitter')),
  source_url TEXT,
  content_type TEXT DEFAULT 'post',
  caption TEXT,
  thumbnail_url TEXT,
  engagement_score INTEGER DEFAULT 0,
  hashtags TEXT[],
  raw_data JSONB,
  scraped_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'processing', 'processed', 'archived')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Video Scripts (AI-generated)
CREATE TABLE IF NOT EXISTS video_scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trend_id UUID REFERENCES content_trends(id) ON DELETE CASCADE,
  style TEXT NOT NULL CHECK (style IN ('funny', 'educational', 'storytelling', 'testimonial')),
  hook TEXT,
  script_text TEXT NOT NULL,
  duration_seconds INTEGER DEFAULT 30,
  score INTEGER DEFAULT 0, -- AI confidence score 0-100
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'approved', 'rejected', 'produced')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Instagram Accounts (connected for tracking)
CREATE TABLE IF NOT EXISTS instagram_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  profile_pic_url TEXT,
  bio TEXT,
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, username)
);

-- 4. Instagram Metrics (daily snapshots)
CREATE TABLE IF NOT EXISTS instagram_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES instagram_accounts(id) ON DELETE CASCADE,
  followers INTEGER,
  following INTEGER,
  posts_count INTEGER,
  avg_likes INTEGER,
  avg_comments INTEGER,
  engagement_rate DECIMAL(5,2),
  recorded_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_content_trends_status ON content_trends(status);
CREATE INDEX IF NOT EXISTS idx_content_trends_scraped_at ON content_trends(scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_scripts_trend_id ON video_scripts(trend_id);
CREATE INDEX IF NOT EXISTS idx_video_scripts_status ON video_scripts(status);
CREATE INDEX IF NOT EXISTS idx_instagram_metrics_account_id ON instagram_metrics(account_id);
CREATE INDEX IF NOT EXISTS idx_instagram_metrics_recorded_at ON instagram_metrics(recorded_at DESC);

-- RLS Policies (allow authenticated users)
ALTER TABLE content_trends ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE instagram_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE instagram_metrics ENABLE ROW LEVEL SECURITY;

-- Public read for trends and scripts
CREATE POLICY "Anyone can read trends" ON content_trends FOR SELECT USING (true);
CREATE POLICY "Anyone can read scripts" ON video_scripts FOR SELECT USING (true);

-- Authenticated users can manage
CREATE POLICY "Authenticated can insert trends" ON content_trends FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update trends" ON content_trends FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can insert scripts" ON video_scripts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update scripts" ON video_scripts FOR UPDATE TO authenticated USING (true);

-- Instagram: users can only see their own accounts
CREATE POLICY "Users see own IG accounts" ON instagram_accounts FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own IG accounts" ON instagram_accounts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users see own IG metrics" ON instagram_metrics FOR SELECT TO authenticated USING (
  account_id IN (SELECT id FROM instagram_accounts WHERE user_id = auth.uid())
);
