-- Migration script to fix the Query List table structure
-- Run this in your Supabase SQL editor

-- First, let's check if the table exists and what its structure is
SELECT table_name, column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'Query List'
ORDER BY ordinal_position;

-- Drop the table if it exists with wrong structure
DROP TABLE IF EXISTS "Query List";

-- Recreate the table with correct structure
CREATE TABLE "Query List" (
  id SERIAL PRIMARY KEY,
  session_id TEXT,
  email TEXT,
  interaction_type VARCHAR(50) NOT NULL, -- 'email_provided', 'search_query', 'button_click', etc.
  data JSONB NOT NULL, -- Contains the interaction data
  user_agent TEXT,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_query_list_interaction_type ON "Query List"(interaction_type);
CREATE INDEX IF NOT EXISTS idx_query_list_timestamp ON "Query List"(timestamp);
CREATE INDEX IF NOT EXISTS idx_query_list_created_at ON "Query List"(created_at);
CREATE INDEX IF NOT EXISTS idx_query_list_session_id ON "Query List"(session_id);
CREATE INDEX IF NOT EXISTS idx_query_list_email ON "Query List"(email);

-- Verify the table structure
SELECT table_name, column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'Query List'
ORDER BY ordinal_position;
