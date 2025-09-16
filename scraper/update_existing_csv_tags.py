#!/usr/bin/env python3
"""
Update existing CSV file with comprehensive tags using the new single API call approach.
"""

import csv
import os
import sys
import json
from dotenv import load_dotenv

# Add the current directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from scrape_tech_week_sf import generate_all_event_tags

def update_csv_with_comprehensive_tags(csv_path: str) -> None:
    """Update the CSV file by adding comprehensive tags to each event using OpenAI."""
    print(f"🔄 Updating CSV with comprehensive tags: {csv_path}")
    print("=" * 60)
    
    # Load environment variables
    load_dotenv()
    
    # Check for OpenAI API key
    if not os.getenv("OPENAI_API_KEY"):
        print("❌ OpenAI API key not found. Please set OPENAI_API_KEY in your .env file.")
        return
    
    # Read existing CSV
    events = []
    with open(csv_path, 'r', encoding='utf-8') as file:
        reader = csv.DictReader(file)
        events = list(reader)
    
    print(f"📊 Found {len(events)} events to process")
    print()
    
    # Process each event
    for i, event in enumerate(events, 1):
        event_name = event.get('event_name', '')
        description = event.get('event_description', '')
        hosted_by = event.get('hosted_by', '')
        
        print(f"Processing event {i}/{len(events)}: {event_name[:50]}...")
        
        # Skip if we already have comprehensive tags (check if usage_tags is not empty)
        if event.get('usage_tags') and event['usage_tags'] not in ['[]', '', 'null']:
            try:
                # Try to parse existing usage_tags to see if it's already populated
                existing_tags = json.loads(event['usage_tags']) if event['usage_tags'] else []
                if len(existing_tags) > 0:
                    print(f"  ⏭️  Skipping - already has {len(existing_tags)} usage tags")
                    continue
            except:
                pass  # If parsing fails, continue with update
        
        # Generate comprehensive tags
        try:
            all_tags = generate_all_event_tags(description, event_name, hosted_by)
            
            # Update the event with new tags
            event['event_tags'] = json.dumps(all_tags['event_tags'])
            event['usage_tags'] = json.dumps(all_tags['usage_tags'])
            event['industry_tags'] = json.dumps(all_tags['industry_tags'])
            event['event_type'] = all_tags['event_type']
            event['outfit_category'] = all_tags['outfit_category']
            event['women_specific'] = str(all_tags['women_specific']).lower()
            event['invite_only'] = str(all_tags['invite_only']).lower()
            
            print(f"  ✅ Generated {len(all_tags['event_tags'])} event tags, {len(all_tags['usage_tags'])} usage tags, {len(all_tags['industry_tags'])} industry tags")
            print(f"  📋 Event type: {all_tags['event_type']}, Outfit: {all_tags['outfit_category']}, Women specific: {all_tags['women_specific']}, Invite only: {all_tags['invite_only']}")
            
        except Exception as e:
            print(f"  ❌ Error processing event: {e}")
            # Set empty values on error
            event['event_tags'] = json.dumps([])
            event['usage_tags'] = json.dumps([])
            event['industry_tags'] = json.dumps([])
            event['event_type'] = ''
            event['outfit_category'] = ''
            event['women_specific'] = 'false'
            event['invite_only'] = 'false'
        
        print()
    
    # Write updated CSV
    print("💾 Writing updated CSV...")
    with open(csv_path, 'w', newline='', encoding='utf-8') as file:
        if events:
            fieldnames = events[0].keys()
            writer = csv.DictWriter(file, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(events)
    
    print("✅ CSV update completed successfully!")
    print(f"📊 Updated {len(events)} events with comprehensive tags")

def main():
    """Main function to update the CSV with comprehensive tags."""
    csv_path = "data/sf_tech_week_events.csv"
    
    if not os.path.exists(csv_path):
        print(f"❌ CSV file not found: {csv_path}")
        return
    
    update_csv_with_comprehensive_tags(csv_path)

if __name__ == "__main__":
    main()
