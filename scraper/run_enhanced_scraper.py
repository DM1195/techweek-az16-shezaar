#!/usr/bin/env python3
"""
Enhanced scraper runner that includes usage tags generation.
This script runs the scraper and then adds usage tags to all events.
"""

import os
import sys
from dotenv import load_dotenv

# Add the current directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from scrape_tech_week_sf import scrape_events, write_csv, update_csv_with_keywords

def main():
    """Run the enhanced scraper with usage tags."""
    print("🚀 Starting enhanced SF Tech Week scraper with usage tags...")
    print("=" * 60)
    
    # Check for OpenAI API key
    if not os.getenv("OPENAI_API_KEY"):
        print("❌ OpenAI API key not found. Please set OPENAI_API_KEY in your .env file.")
        print("   Usage tags generation requires OpenAI API access.")
        return
    
    # Step 1: Scrape events
    print("\n📅 Step 1: Scraping events from SF Tech Week...")
    events = scrape_events(emit_json=False)
    
    if not events:
        print("❌ No events found. Exiting.")
        return
    
    print(f"✅ Scraped {len(events)} events")
    
    # Step 2: Write initial CSV
    csv_path = "data/sf_tech_week_events.csv"
    print(f"\n💾 Step 2: Writing initial CSV to {csv_path}...")
    write_csv(events, csv_path)
    print("✅ Initial CSV written")
    
    # Step 3: Add keywords and usage tags
    print(f"\n🏷️  Step 3: Adding keywords and usage tags to {len(events)} events...")
    print("   This may take a while as we're calling OpenAI for each event...")
    
    try:
        update_csv_with_keywords(csv_path)
        print("✅ Successfully added keywords and usage tags!")
    except Exception as e:
        print(f"❌ Error adding keywords and usage tags: {e}")
        print("   The CSV file still contains the basic event data.")
        return
    
    print("\n🎉 Enhanced scraper completed successfully!")
    print(f"📊 Final CSV with usage tags: {csv_path}")
    print("\n💡 Usage tags help the recommendation system find more relevant events")
    print("   by matching user goals (like 'find co-founders') to event purposes.")

if __name__ == "__main__":
    main()
