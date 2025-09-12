#!/usr/bin/env python3
"""
Script to load CSV data into Supabase with proper tag parsing.
This script reads the CSV file and uploads events to Supabase with correctly formatted arrays.
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

def clean_time_field(time_str: str) -> str:
    """Clean time field to handle empty values properly."""
    if not time_str or time_str.strip() == '' or time_str.lower() == 'nan':
        return None  # Return None for empty time fields
    return str(time_str).strip()

def load_events_from_csv(csv_path: str) -> List[Dict[str, Any]]:
    """Load events from CSV file with proper parsing."""
    events = []
    
    print(f"📖 Reading events from {csv_path}...")
    
    with open(csv_path, 'r', encoding='utf-8') as file:
        reader = csv.DictReader(file)
        
        for row_num, row in enumerate(reader, 1):
            try:
                # Parse the event data
                event = {
                    'event_name': clean_text(row.get('event_name', '')),
                    'event_date': clean_text(row.get('event_date', '')),
                    'event_time': clean_time_field(row.get('event_time', '')),
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
                
                # Skip events with empty names
                if not event['event_name']:
                    print(f"⚠️  Skipping row {row_num}: Empty event name")
                    continue
                
                events.append(event)
                
            except Exception as e:
                print(f"❌ Error parsing row {row_num}: {e}")
                continue
    
    print(f"✅ Loaded {len(events)} events from CSV")
    return events

def upload_events_to_supabase(supabase: Client, events: List[Dict[str, Any]], batch_size: int = 50) -> int:
    """Upload events to Supabase in batches."""
    total_uploaded = 0
    
    print(f"🚀 Uploading {len(events)} events to Supabase in batches of {batch_size}...")
    
    for i in range(0, len(events), batch_size):
        batch = events[i:i + batch_size]
        batch_num = (i // batch_size) + 1
        total_batches = (len(events) + batch_size - 1) // batch_size
        
        print(f"📤 Uploading batch {batch_num}/{total_batches} ({len(batch)} events)...")
        
        try:
            # Use upsert to handle duplicates based on event_name_and_link
            response = supabase.table('Event List').upsert(
                batch,
                on_conflict='event_name_and_link'
            ).execute()
            
            if response.data:
                uploaded_count = len(response.data)
                total_uploaded += uploaded_count
                print(f"✅ Batch {batch_num}: Uploaded {uploaded_count} events")
            else:
                print(f"⚠️  Batch {batch_num}: No data returned from Supabase")
                
        except Exception as e:
            print(f"❌ Error uploading batch {batch_num}: {e}")
            # Try to upload individual events from this batch
            for j, event in enumerate(batch):
                try:
                    response = supabase.table('Event List').upsert([event], on_conflict='event_name_and_link').execute()
                    if response.data:
                        total_uploaded += 1
                        print(f"  ✅ Individual event {i+j+1}: {event['event_name'][:50]}...")
                    else:
                        print(f"  ⚠️  Individual event {i+j+1}: No data returned")
                except Exception as individual_error:
                    print(f"  ❌ Individual event {i+j+1}: {individual_error}")
    
    return total_uploaded

def verify_upload(supabase: Client, sample_size: int = 5) -> None:
    """Verify the upload by checking a few sample events."""
    print(f"\n🔍 Verifying upload with {sample_size} sample events...")
    
    try:
        response = supabase.table('Event List').select('*').limit(sample_size).execute()
        
        if response.data:
            print(f"✅ Found {len(response.data)} events in database")
            
            for i, event in enumerate(response.data, 1):
                print(f"\n📅 Event {i}: {event.get('event_name', 'No name')}")
                print(f"   Tags: {event.get('event_tags', [])}")
                print(f"   Usage Tags: {event.get('usage_tags', [])}")
                print(f"   Industry Tags: {event.get('industry_tags', [])}")
                print(f"   Women Specific: {event.get('women_specific', False)}")
        else:
            print("❌ No events found in database")
            
    except Exception as e:
        print(f"❌ Error verifying upload: {e}")

def main():
    """Main function to load CSV data into Supabase."""
    print("🚀 Starting CSV to Supabase data loader...")
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
        events = load_events_from_csv(csv_path)
        
        if not events:
            print("❌ No events loaded from CSV")
            return
        
        # Upload events to Supabase
        uploaded_count = upload_events_to_supabase(supabase, events)
        
        print(f"\n🎉 Upload complete!")
        print(f"📊 Total events uploaded: {uploaded_count}")
        print(f"📊 Total events in CSV: {len(events)}")
        
        # Verify upload
        verify_upload(supabase)
        
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
