-- Supabase Database Schema for SF Tech Week App
-- Run these SQL commands in your Supabase SQL editor to create the required tables

-- Table for logging user interactions
CREATE TABLE IF NOT EXISTS "UserInteractions" (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL, -- 'query', 'find_events', 'find_outfit'
  data JSONB NOT NULL, -- Contains the user's message and other relevant data
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for events (if not already exists)
CREATE TABLE IF NOT EXISTS "Event List" (
  id SERIAL PRIMARY KEY,
  event_name TEXT NOT NULL,
  event_date TEXT,
  event_time TEXT,
  event_location TEXT,
  event_description TEXT,
  hosted_by TEXT,
  price TEXT,
  event_url TEXT,
  event_tags TEXT[], -- General event tags
  usage_tags TEXT[], -- What the event is good for (find-cofounder, find-angels, etc.)
  industry_tags TEXT[], -- Industry-specific tags (ai, fintech, wellness, etc.)
  women_specific BOOLEAN DEFAULT FALSE, -- Whether the event is specifically for women
  invite_only BOOLEAN DEFAULT FALSE,
  event_name_and_link TEXT,
  embedding VECTOR(1536), -- For semantic search
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_interactions_type ON "UserInteractions"(type);
CREATE INDEX IF NOT EXISTS idx_user_interactions_timestamp ON "UserInteractions"(timestamp);
CREATE INDEX IF NOT EXISTS idx_user_interactions_created_at ON "UserInteractions"(created_at);

-- Indexes for Event List table
CREATE INDEX IF NOT EXISTS idx_event_list_usage_tags ON "Event List" USING GIN(usage_tags);
CREATE INDEX IF NOT EXISTS idx_event_list_industry_tags ON "Event List" USING GIN(industry_tags);
CREATE INDEX IF NOT EXISTS idx_event_list_event_tags ON "Event List" USING GIN(event_tags);
CREATE INDEX IF NOT EXISTS idx_event_list_event_date ON "Event List"(event_date);
CREATE INDEX IF NOT EXISTS idx_event_list_updated_at ON "Event List"(updated_at);

-- Optional: Create a view for analytics
CREATE OR REPLACE VIEW interaction_analytics AS
SELECT 
  type,
  DATE(created_at) as date,
  COUNT(*) as count,
  COUNT(DISTINCT user_agent) as unique_users
FROM "UserInteractions"
GROUP BY type, DATE(created_at)
ORDER BY date DESC, type;

-- Grant necessary permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT ON "UserInteractions" TO authenticated;
-- GRANT SELECT ON interaction_analytics TO authenticated;
