-- Supabase Database Schema for SF Tech Week App
-- Run these SQL commands in your Supabase SQL editor to create the required tables

-- Table for logging user interactions
CREATE TABLE IF NOT EXISTS "Query List" (
  id SERIAL PRIMARY KEY,
  session_id TEXT,
  email TEXT,
  interaction_type VARCHAR(50) NOT NULL, -- 'email_provided', 'search_query', 'button_click', etc.
  data JSONB NOT NULL, -- Contains the interaction data
  user_agent TEXT,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
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
CREATE INDEX IF NOT EXISTS idx_query_list_interaction_type ON "Query List"(interaction_type);
CREATE INDEX IF NOT EXISTS idx_query_list_timestamp ON "Query List"(timestamp);
CREATE INDEX IF NOT EXISTS idx_query_list_created_at ON "Query List"(created_at);
CREATE INDEX IF NOT EXISTS idx_query_list_session_id ON "Query List"(session_id);
CREATE INDEX IF NOT EXISTS idx_query_list_email ON "Query List"(email);

-- Indexes for Event List table
CREATE INDEX IF NOT EXISTS idx_event_list_usage_tags ON "Event List" USING GIN(usage_tags);
CREATE INDEX IF NOT EXISTS idx_event_list_industry_tags ON "Event List" USING GIN(industry_tags);
CREATE INDEX IF NOT EXISTS idx_event_list_event_tags ON "Event List" USING GIN(event_tags);
CREATE INDEX IF NOT EXISTS idx_event_list_event_date ON "Event List"(event_date);
CREATE INDEX IF NOT EXISTS idx_event_list_updated_at ON "Event List"(updated_at);

-- Optional: Create a view for analytics
CREATE OR REPLACE VIEW interaction_analytics AS
SELECT 
  interaction_type as type,
  DATE(created_at) as date,
  COUNT(*) as count,
  COUNT(DISTINCT user_agent) as unique_users,
  COUNT(DISTINCT session_id) as unique_sessions,
  COUNT(DISTINCT email) as unique_emails
FROM "Query List"
GROUP BY interaction_type, DATE(created_at)
ORDER BY date DESC, interaction_type;

-- Table for outfit recommendations
CREATE TABLE IF NOT EXISTS "Outfit Recommendations" (
  id SERIAL PRIMARY KEY,
  event_category TEXT NOT NULL, -- Event type (Business Casual, Activity, etc.)
  gender TEXT NOT NULL, -- Gender preference (female, male, gender-neutral)
  body_comfort TEXT NOT NULL, -- Comfort level (modest, bold, mid)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for outfit recommendations
CREATE INDEX IF NOT EXISTS idx_outfit_recommendations_event_category ON "Outfit Recommendations"(event_category);
CREATE INDEX IF NOT EXISTS idx_outfit_recommendations_gender ON "Outfit Recommendations"(gender);
CREATE INDEX IF NOT EXISTS idx_outfit_recommendations_body_comfort ON "Outfit Recommendations"(body_comfort);

-- Grant necessary permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT ON "Query List" TO authenticated;
-- GRANT SELECT ON "Outfit Recommendations" TO authenticated;
-- GRANT SELECT ON interaction_analytics TO authenticated;
