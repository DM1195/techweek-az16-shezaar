#!/usr/bin/env python3
"""
Script to check what's currently in the Supabase database.
"""

import os
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv()

def get_supabase_client() -> Client:
    """Initialize and return Supabase client."""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_ANON_KEY")
    
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env file")
    
    return create_client(url, key)

def check_database():
    """Check what's in the Supabase database."""
    print("🔍 Checking Supabase database...")
    print("=" * 50)
    
    try:
        supabase = get_supabase_client()
        
        # Get total count
        count_response = supabase.table('Event List').select('id', count='exact').execute()
        total_count = count_response.count
        print(f"📊 Total events in database: {total_count}")
        
        if total_count == 0:
            print("❌ No events found in database")
            return
        
        # Get sample events
        print(f"\n📅 Sample events (first 5):")
        response = supabase.table('Event List').select('*').limit(5).execute()
        
        if response.data:
            for i, event in enumerate(response.data, 1):
                print(f"\n{i}. {event.get('event_name', 'No name')}")
                print(f"   Date: {event.get('event_date', 'N/A')}")
                print(f"   Location: {event.get('event_location', 'N/A')}")
                print(f"   Event Tags: {event.get('event_tags', [])}")
                print(f"   Usage Tags: {event.get('usage_tags', [])}")
                print(f"   Industry Tags: {event.get('industry_tags', [])}")
                print(f"   Women Specific: {event.get('women_specific', False)}")
                print(f"   Event Name & Link: {event.get('event_name_and_link', 'N/A')}")
        
        # Check for events with tags (JSON/JSONB columns)
        print(f"\n🏷️  Checking for events with tags...")
        
        # Check event_tags (JSON column)
        event_tagged_response = supabase.table('Event List').select('id,event_name,event_tags').not_('event_tags', 'is', 'null').execute()
        if event_tagged_response.data:
            # Filter out events where event_tags is an empty array or null
            valid_event_tags = [e for e in event_tagged_response.data if e.get('event_tags') and len(e.get('event_tags', [])) > 0]
            print(f"✅ Found {len(valid_event_tags)} events with event_tags (JSON)")
        else:
            print("❌ No events with event_tags found")
        
        # Check usage_tags (JSONB column)
        usage_tagged_response = supabase.table('Event List').select('id,event_name,usage_tags').not_('usage_tags', 'is', 'null').execute()
        if usage_tagged_response.data:
            valid_usage_tags = [e for e in usage_tagged_response.data if e.get('usage_tags') and len(e.get('usage_tags', [])) > 0]
            print(f"✅ Found {len(valid_usage_tags)} events with usage_tags (JSONB)")
        else:
            print("❌ No events with usage_tags found")
        
        # Check industry_tags (JSONB column)
        industry_tagged_response = supabase.table('Event List').select('id,event_name,industry_tags').not_('industry_tags', 'is', 'null').execute()
        if industry_tagged_response.data:
            valid_industry_tags = [e for e in industry_tagged_response.data if e.get('industry_tags') and len(e.get('industry_tags', [])) > 0]
            print(f"✅ Found {len(valid_industry_tags)} events with industry_tags (JSONB)")
        else:
            print("❌ No events with industry_tags found")
            
    except Exception as e:
        print(f"❌ Error checking database: {e}")

if __name__ == "__main__":
    check_database()
