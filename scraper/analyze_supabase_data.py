#!/usr/bin/env python3
"""
Script to analyze the Supabase data to understand why there are 1070 events instead of 1011.
"""

import os
from dotenv import load_dotenv
from supabase import create_client, Client
from collections import Counter

# Load environment variables
load_dotenv()

def get_supabase_client() -> Client:
    """Initialize and return Supabase client with service role key."""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) must be set in .env file")
    
    return create_client(url, key)

def analyze_database():
    """Analyze the Supabase database to understand the data."""
    print("🔍 Analyzing Supabase database...")
    print("=" * 60)
    
    try:
        supabase = get_supabase_client()
        
        # Get actual count first
        print("📊 Getting actual event count...")
        count_response = supabase.table('Event List').select('id', count='exact').execute()
        actual_count = count_response.count
        print(f"📊 Actual events in database: {actual_count}")
        
        # Get all events in batches to handle large datasets (up to 5000)
        print("📊 Fetching all events in batches...")
        events = []
        batch_size = 1000
        max_events = 5000
        offset = 0
        
        while len(events) < min(actual_count, max_events):
            remaining = min(actual_count, max_events) - len(events)
            current_batch_size = min(batch_size, remaining)
            
            response = supabase.table('Event List').select('*').range(offset, offset + current_batch_size - 1).execute()
            batch_events = response.data
            events.extend(batch_events)
            
            print(f"   Fetched batch {offset//batch_size + 1}: {len(batch_events)} events (total: {len(events)})")
            
            if len(batch_events) < current_batch_size:
                break
            offset += current_batch_size
        
        total_count = len(events)
        print(f"📊 Total events fetched: {total_count}")
        
        # Check for events without event_name_and_link
        events_without_key = [e for e in events if not e.get('event_name_and_link')]
        print(f"📊 Events without event_name_and_link: {len(events_without_key)}")
        
        if events_without_key:
            print("   Sample events without key:")
            for i, event in enumerate(events_without_key[:5], 1):
                print(f"   {i}. {event.get('event_name', 'No name')} (ID: {event.get('id', 'No ID')})")
        
        # Check for duplicate event_name_and_link values
        event_keys = [e.get('event_name_and_link') for e in events if e.get('event_name_and_link')]
        key_counts = Counter(event_keys)
        duplicates = {k: v for k, v in key_counts.items() if v > 1}
        
        print(f"📊 Duplicate event_name_and_link values: {len(duplicates)}")
        if duplicates:
            print("   Sample duplicates:")
            for key, count in list(duplicates.items())[:5]:
                print(f"   '{key}': {count} occurrences")
        
        # Check for events with different updated_at timestamps
        print(f"\n📅 Checking update timestamps...")
        updated_today = [e for e in events if e.get('updated_at', '').startswith('2025-09-22')]
        print(f"📊 Events updated today (2025-09-22): {len(updated_today)}")
        
        # Check for events with different event names but same URLs
        url_to_names = {}
        for event in events:
            url = event.get('event_url', '')
            name = event.get('event_name', '')
            if url and url != '#':
                if url not in url_to_names:
                    url_to_names[url] = []
                url_to_names[url].append(name)
        
        url_duplicates = {url: names for url, names in url_to_names.items() if len(set(names)) > 1}
        print(f"📊 URLs with different event names: {len(url_duplicates)}")
        
        if url_duplicates:
            print("   Sample URL duplicates:")
            for url, names in list(url_duplicates.items())[:3]:
                print(f"   URL: {url[:50]}...")
                for name in set(names):
                    print(f"     - {name}")
        
        # Check for events with empty or missing critical fields
        empty_names = [e for e in events if not e.get('event_name')]
        empty_dates = [e for e in events if not e.get('event_date')]
        empty_locations = [e for e in events if not e.get('event_location')]
        
        print(f"\n📊 Data quality issues:")
        print(f"   Events with empty names: {len(empty_names)}")
        print(f"   Events with empty dates: {len(empty_dates)}")
        print(f"   Events with empty locations: {len(empty_locations)}")
        
        # Show some sample events from different time periods
        print(f"\n📅 Sample events by update time:")
        sorted_events = sorted(events, key=lambda x: x.get('updated_at', ''), reverse=True)
        
        print("   Most recently updated:")
        for i, event in enumerate(sorted_events[:3], 1):
            print(f"   {i}. {event.get('event_name', 'No name')} - {event.get('updated_at', 'No timestamp')}")
        
        print("   Oldest updated:")
        for i, event in enumerate(sorted_events[-3:], 1):
            print(f"   {i}. {event.get('event_name', 'No name')} - {event.get('updated_at', 'No timestamp')}")
            
    except Exception as e:
        print(f"❌ Error analyzing database: {e}")

if __name__ == "__main__":
    analyze_database()
