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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_interactions_type ON "UserInteractions"(type);
CREATE INDEX IF NOT EXISTS idx_user_interactions_timestamp ON "UserInteractions"(timestamp);
CREATE INDEX IF NOT EXISTS idx_user_interactions_created_at ON "UserInteractions"(created_at);

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
