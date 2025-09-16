#!/usr/bin/env python3
"""
Script to load CSV data into Supabase using service role key to bypass RLS.
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
    """Initialize and return Supabase client with service role key."""
    url = os.getenv("SUPABASE_URL")
    # Try service role key first, fall back to anon key
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) must be set in .env file")
    
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

def generate_event_category(event_name: str, event_description: str, event_tags: List[str]) -> str:
    """Generate event category based on event name, description, and tags."""
    # Convert all text to lowercase for case-insensitive matching
    name = (event_name or '').lower()
    description = (event_description or '').lower()
    tags = [tag.lower() for tag in event_tags] if event_tags else []
    all_text = f"{name} {description} {' '.join(tags)}"
    
    # Business Casual - Networking Mixers, Happy Hours, Co-founder Matchups, Pitch Nights, Demo Days, Investor Panels, Startup Showcases
    business_casual_keywords = [
        'networking', 'mixer', 'happy hour', 'co-founder', 'cofounder', 'co founder',
        'founder', 'entrepreneur', 'startup', 'business', 'professional', 'meetup',
        'connect', 'collaboration', 'partnership', 'matchup', 'venture', 'funding',
        'angel', 'vc', 'investment', 'capital', 'investor', 'tech', 'ai', 'fintech',
        'wellness', 'health', 'sustainability', 'blockchain', 'web3', 'crypto',
        'pitch night', 'demo day', 'investor panel', 'startup showcase', 'presentation',
        'pitch', 'showcase', 'demo', 'equity round', 'series round', 'seed round'
    ]
    
    # Casual Creative - Community Events, Creative Collabs, Founder Therapy, Coffee Walks, AI Bootcamps, Coding Nights, Founder Work Sessions
    casual_creative_keywords = [
        'community', 'creative', 'collab', 'therapy', 'coffee walk', 'ai bootcamp',
        'coding night', 'work session', 'workshop', 'learning', 'education', 'skill',
        'development', 'creative', 'art', 'design', 'innovation', 'brainstorm',
        'ideation', 'hackathon', 'build', 'create', 'collaborative'
    ]
    
    # Activity - Pickleball, Hiking, Morning Yoga, Run Clubs
    activity_keywords = [
        'pickleball', 'hiking', 'yoga', 'run club', 'running', 'fitness', 'exercise',
        'sport', 'physical', 'outdoor', 'walk', 'jog', 'workout', 'gym', 'tennis',
        'basketball', 'soccer', 'volleyball', 'cycling', 'bike', 'swimming'
    ]
    
    # Daytime Social - Brunches, Founder Lunches, Garden Parties
    daytime_social_keywords = [
        'brunch', 'lunch', 'garden party', 'daytime', 'morning', 'afternoon',
        'breakfast', 'dining', 'food', 'meal', 'social', 'gathering', 'party',
        'celebration', 'festival', 'fair', 'market', 'outdoor dining'
    ]
    
    # Evening Social - Dinners, House Parties, Rooftop Hangouts, After Parties
    evening_social_keywords = [
        'dinner', 'house party', 'rooftop', 'after party', 'evening', 'night',
        'party', 'social', 'hangout', 'get together', 'celebration', 'drinks',
        'cocktail', 'wine', 'beer', 'socializing', 'nightlife', 'club', 'bar'
    ]
    
    # Check for matches in order of specificity
    def check_keywords(keywords):
        return any(keyword in all_text or keyword in name or keyword in description or 
                  any(keyword in tag for tag in tags) for keyword in keywords)
    
    # Return category based on keyword matches
    if check_keywords(business_casual_keywords):
        return 'Business Casual'
    elif check_keywords(casual_creative_keywords):
        return 'Casual Creative'
    elif check_keywords(activity_keywords):
        return 'Activity'
    elif check_keywords(daytime_social_keywords):
        return 'Daytime Social'
    elif check_keywords(evening_social_keywords):
        return 'Evening Social'
    else:
        # Default fallback based on common patterns
        if any(word in all_text for word in ['networking', 'meet', 'connect']):
            return 'Business Casual'
        elif any(word in all_text for word in ['party', 'social', 'hangout']):
            return 'Evening Social'
        elif any(word in all_text for word in ['workshop', 'learn', 'education']):
            return 'Casual Creative'
        else:
            return 'Business Casual'  # Default fallback

def load_events_from_csv(csv_path: str) -> List[Dict[str, Any]]:
    """Load events from CSV file with proper parsing."""
    events = []
    
    print(f"📖 Reading events from {csv_path}...")
    
    with open(csv_path, 'r', encoding='utf-8') as file:
        reader = csv.DictReader(file)
        
        for row_num, row in enumerate(reader, 1):
            try:
                # Parse the event data
                event_name = clean_text(row.get('event_name', ''))
                event_description = clean_text(row.get('event_description', ''))
                event_tags = parse_tags(row.get('event_tags', ''))
                
                event = {
                    'event_name': event_name,
                    'event_date': clean_text(row.get('event_date', '')),
                    'event_time': clean_time_field(row.get('event_time', '')),
                    'event_location': clean_text(row.get('event_location', '')),
                    'event_description': event_description,
                    'hosted_by': clean_text(row.get('hosted_by', '')),
                    'price': clean_text(row.get('price', '')),
                    'event_url': clean_text(row.get('event_url', '')),
                    'event_tags': event_tags,
                    'usage_tags': parse_tags(row.get('usage_tags', '')),
                    'industry_tags': parse_tags(row.get('industry_tags', '')),
                    'event_type': clean_text(row.get('event_type', '')),
                    'outfit_category': clean_text(row.get('outfit_category', '')),
                    'women_specific': parse_boolean(row.get('women_specific', '')),
                    'invite_only': parse_boolean(row.get('invite_only', '')),
                    'event_name_and_link': clean_text(row.get('event_name_and_link', '')),
                    'updated_at': clean_text(row.get('updated_at', ''))
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

def upload_events_to_supabase(supabase: Client, events: List[Dict[str, Any]], batch_size: int = 20) -> int:
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
                print(f"   Date: {event.get('event_date', 'N/A')}")
                print(f"   Time: {event.get('event_time', 'N/A')}")
                print(f"   Location: {event.get('event_location', 'N/A')}")
                # Category not available in current database schema
                print(f"   Event Type: {event.get('event_type', 'N/A')}")
                print(f"   Outfit Category: {event.get('outfit_category', 'N/A')}")
                print(f"   Event Tags: {event.get('event_tags', [])}")
                print(f"   Usage Tags: {event.get('usage_tags', [])}")
                print(f"   Industry Tags: {event.get('industry_tags', [])}")
                print(f"   Women Specific: {event.get('women_specific', False)}")
                print(f"   Updated At: {event.get('updated_at', 'N/A')}")
        else:
            print("❌ No events found in database")
            
    except Exception as e:
        print(f"❌ Error verifying upload: {e}")

def main():
    """Main function to load CSV data into Supabase."""
    print("🚀 Starting CSV to Supabase data loader (Service Role)...")
    print("=" * 60)
    
    # Check for required environment variables
    if not os.getenv("SUPABASE_URL") or (not os.getenv("SUPABASE_SERVICE_ROLE_KEY") and not os.getenv("SUPABASE_ANON_KEY")):
        print("❌ Missing Supabase credentials!")
        print("   Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) in your .env file")
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
        
        # Show tag distribution instead of category
        print(f"\n📊 Tag Distribution:")
        try:
            response = supabase.table('Event List').select('event_tags,usage_tags,industry_tags').execute()
            if response.data:
                event_tag_count = sum(1 for event in response.data if event.get('event_tags'))
                usage_tag_count = sum(1 for event in response.data if event.get('usage_tags'))
                industry_tag_count = sum(1 for event in response.data if event.get('industry_tags'))
                print(f"   Events with event_tags: {event_tag_count}")
                print(f"   Events with usage_tags: {usage_tag_count}")
                print(f"   Events with industry_tags: {industry_tag_count}")
        except Exception as e:
            print(f"   Could not fetch tag distribution: {e}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
