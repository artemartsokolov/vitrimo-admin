-- Add video_url column for Reel analysis
ALTER TABLE content_trends ADD COLUMN IF NOT EXISTS video_url TEXT;
