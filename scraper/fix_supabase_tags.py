#!/usr/bin/env python3
"""
Script to fix existing Supabase data by converting string tags to proper JSON arrays.
This script reads the CSV file and updates existing events in Supabase with properly formatted tags.
"""

import csv
import json
import os
import sys
import ast
from typing import List, Dict, Any
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

def parse_tags(tag_string: str) -> List[str]:
    """Parse tag string from CSV into a proper list for JSON/JSONB columns."""
    if not tag_string or tag_string.strip() == '' or tag_string.lower() == 'nan':
        return []
    
    try:
        # Handle string representation of Python list
        if tag_string.startswith('[') and tag_string.endswith(']'):
            # Use ast.literal_eval to safely parse the string as a Python literal
            parsed = ast.literal_eval(tag_string)
            if isinstance(parsed, list):
                # Clean and filter the tags
                cleaned_tags = []
                for item in parsed:
                    if item and str(item).strip():
                        cleaned_tags.append(str(item).strip())
                return cleaned_tags
        return []
    except (ValueError, SyntaxError) as e:
        print(f"Warning: Could not parse tags '{tag_string}': {e}")
        return []

def parse_boolean(value: str) -> bool:
    """Parse boolean value from CSV."""
    if not value or value.lower() in ['', 'nan', 'false', '0']:
        return False
    return value.lower() in ['true', '1', 'yes']

def clean_text(text: str) -> str:
    """Clean text field."""
    if not text or text.lower() == 'nan':
        return ''
    return str(text).strip()

def load_events_from_csv(csv_path: str) -> Dict[str, Dict[str, Any]]:
    """Load events from CSV file and create a lookup by event_name_and_link."""
    events = {}
    
    print(f"📖 Reading events from {csv_path}...")
    
    with open(csv_path, 'r', encoding='utf-8') as file:
        reader = csv.DictReader(file)
        
        for row_num, row in enumerate(reader, 1):
            try:
                # Parse the event data
                event = {
                    'event_name': clean_text(row.get('event_name', '')),
                    'event_date': clean_text(row.get('event_date', '')),
                    'event_time': clean_text(row.get('event_time', '')),
                    'event_location': clean_text(row.get('event_location', '')),
                    'event_description': clean_text(row.get('event_description', '')),
                    'hosted_by': clean_text(row.get('hosted_by', '')),
                    'price': clean_text(row.get('price', '')),
                    'event_url': clean_text(row.get('event_url', '')),
                    'event_tags': parse_tags(row.get('event_tags', '')),
                    'usage_tags': parse_tags(row.get('usage_tags', '')),
                    'industry_tags': parse_tags(row.get('industry_tags', '')),
                    'women_specific': parse_boolean(row.get('women_specific', '')),
                    'invite_only': parse_boolean(row.get('invite_only', '')),
                    'event_name_and_link': clean_text(row.get('event_name_and_link', ''))
                }
                
                # Skip events with empty names or event_name_and_link
                if not event['event_name'] or not event['event_name_and_link']:
                    print(f"⚠️  Skipping row {row_num}: Missing event name or event_name_and_link")
                    continue
                
                events[event['event_name_and_link']] = event
                
            except Exception as e:
                print(f"❌ Error parsing row {row_num}: {e}")
                continue
    
    print(f"✅ Loaded {len(events)} events from CSV")
    return events

def get_existing_events(supabase: Client) -> List[Dict[str, Any]]:
    """Get all existing events from Supabase."""
    print("📥 Fetching existing events from Supabase...")
    
    try:
        response = supabase.table('Event List').select('*').execute()
        
        if response.data:
            print(f"✅ Found {len(response.data)} existing events in Supabase")
            return response.data
        else:
            print("❌ No events found in Supabase")
            return []
            
    except Exception as e:
        print(f"❌ Error fetching events from Supabase: {e}")
        return []

def update_event_tags(supabase: Client, event_id: int, event_tags: List[str], usage_tags: List[str], industry_tags: List[str]) -> bool:
    """Update tags for a specific event."""
    try:
        update_data = {
            'event_tags': event_tags,
            'usage_tags': usage_tags,
            'industry_tags': industry_tags
        }
        
        response = supabase.table('Event List').update(update_data).eq('id', event_id).execute()
        
        if response.data:
            return True
        else:
            print(f"⚠️  No data returned for event ID {event_id}")
            return False
            
    except Exception as e:
        print(f"❌ Error updating event ID {event_id}: {e}")
        return False

def main():
    """Main function to fix Supabase tags."""
    print("🔧 Starting Supabase tags fix...")
    print("=" * 60)
    
    # Check for required environment variables
    if not os.getenv("SUPABASE_URL") or not os.getenv("SUPABASE_ANON_KEY"):
        print("❌ Missing Supabase credentials!")
        print("   Please set SUPABASE_URL and SUPABASE_ANON_KEY in your .env file")
        return
    
    # Path to CSV file
    csv_path = "data/sf_tech_week_events.csv"
    
    if not os.path.exists(csv_path):
        print(f"❌ CSV file not found: {csv_path}")
        return
    
    try:
        # Initialize Supabase client
        print("🔧 Initializing Supabase client...")
        supabase = get_supabase_client()
        print("✅ Supabase client initialized")
        
        # Load events from CSV
        csv_events = load_events_from_csv(csv_path)
        
        if not csv_events:
            print("❌ No events loaded from CSV")
            return
        
        # Get existing events from Supabase
        existing_events = get_existing_events(supabase)
        
        if not existing_events:
            print("❌ No events found in Supabase")
            return
        
        # Update events with proper tags
        updated_count = 0
        not_found_count = 0
        
        print(f"\n🔄 Updating events with proper tags...")
        
        for event in existing_events:
            event_name_and_link = event.get('event_name_and_link', '')
            
            if event_name_and_link in csv_events:
                csv_event = csv_events[event_name_and_link]
                
                # Check if tags need updating
                current_event_tags = event.get('event_tags', [])
                current_usage_tags = event.get('usage_tags', [])
                current_industry_tags = event.get('industry_tags', [])
                
                csv_event_tags = csv_event.get('event_tags', [])
                csv_usage_tags = csv_event.get('usage_tags', [])
                csv_industry_tags = csv_event.get('industry_tags', [])
                
                # Check if any tags are different
                if (current_event_tags != csv_event_tags or 
                    current_usage_tags != csv_usage_tags or 
                    current_industry_tags != csv_industry_tags):
                    
                    print(f"📝 Updating: {event.get('event_name', 'Unknown')[:50]}...")
                    
                    success = update_event_tags(
                        supabase, 
                        event['id'], 
                        csv_event_tags, 
                        csv_usage_tags, 
                        csv_industry_tags
                    )
                    
                    if success:
                        updated_count += 1
                        print(f"   ✅ Updated tags for event ID {event['id']}")
                    else:
                        print(f"   ❌ Failed to update event ID {event['id']}")
                else:
                    print(f"⏭️  Skipping: {event.get('event_name', 'Unknown')[:50]}... (tags already correct)")
            else:
                not_found_count += 1
                print(f"⚠️  Event not found in CSV: {event.get('event_name', 'Unknown')[:50]}...")
        
        print(f"\n🎉 Tags fix complete!")
        print(f"📊 Events updated: {updated_count}")
        print(f"📊 Events not found in CSV: {not_found_count}")
        print(f"📊 Total events in Supabase: {len(existing_events)}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
