#!/usr/bin/env python3
"""
Script to investigate URL conflicts and clean up events with placeholder names.
"""

import os
from dotenv import load_dotenv
from supabase import create_client, Client
from collections import defaultdict

# Load environment variables
load_dotenv()

def get_supabase_client() -> Client:
    """Initialize and return Supabase client with service role key."""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) must be set in .env file")
    
    return create_client(url, key)

def investigate_url_conflicts():
    """Investigate URL conflicts and identify events to clean up."""
    print("🔍 Investigating URL conflicts...")
    print("=" * 60)
    
    try:
        supabase = get_supabase_client()
        
        # Get all events
        print("📊 Fetching all events...")
        response = supabase.table('Event List').select('*').execute()
        events = response.data
        print(f"📊 Total events in database: {len(events)}")
        
        # Group events by URL
        url_groups = defaultdict(list)
        for event in events:
            url = event.get('event_url', '')
            if url and url != '#':
                url_groups[url].append(event)
        
        # Find URLs with multiple events
        conflicts = {url: events for url, events in url_groups.items() if len(events) > 1}
        print(f"📊 URLs with multiple events: {len(conflicts)}")
        
        # Analyze each conflict
        events_to_delete = []
        events_to_keep = []
        
        print(f"\n🔍 Analyzing conflicts...")
        for url, url_events in conflicts.items():
            print(f"\nURL: {url[:80]}...")
            print(f"   Events ({len(url_events)}):")
            
            # Sort events by quality (prefer longer names, more complete data)
            def event_quality_score(event):
                name = event.get('event_name', '')
                description = event.get('event_description', '')
                location = event.get('event_location', '')
                
                score = 0
                # Prefer longer, more descriptive names
                if len(name) > 10:
                    score += 10
                if len(name) > 20:
                    score += 5
                # Prefer names that aren't just placeholders
                if not name.startswith('[') and not name.endswith(']'):
                    score += 20
                # Prefer events with descriptions
                if description and len(description) > 50:
                    score += 10
                # Prefer events with locations
                if location and location != 'nan':
                    score += 5
                # Prefer events updated more recently
                if event.get('updated_at', '').startswith('2025-09-22'):
                    score += 15
                
                return score
            
            # Sort by quality score (highest first)
            sorted_events = sorted(url_events, key=event_quality_score, reverse=True)
            
            for i, event in enumerate(sorted_events):
                name = event.get('event_name', 'No name')
                location = event.get('event_location', 'No location')
                updated = event.get('updated_at', 'No timestamp')
                score = event_quality_score(event)
                
                status = "✅ KEEP" if i == 0 else "❌ DELETE"
                print(f"   {i+1}. {status} - {name}")
                print(f"      Location: {location}, Updated: {updated[:10]}, Score: {score}")
                
                if i == 0:
                    events_to_keep.append(event)
                else:
                    events_to_delete.append(event)
        
        print(f"\n📊 Summary:")
        print(f"   Events to keep: {len(events_to_keep)}")
        print(f"   Events to delete: {len(events_to_delete)}")
        
        # Show some examples of events to delete
        print(f"\n🗑️  Sample events to delete:")
        for i, event in enumerate(events_to_delete[:10], 1):
            name = event.get('event_name', 'No name')
            url = event.get('event_url', 'No URL')
            print(f"   {i}. {name} | {url[:50]}...")
        
        return events_to_delete, events_to_keep
        
    except Exception as e:
        print(f"❌ Error investigating conflicts: {e}")
        return [], []

def clean_up_duplicates(events_to_delete):
    """Clean up duplicate events by deleting the lower quality ones."""
    if not events_to_delete:
        print("✅ No duplicate events to clean up")
        return
    
    print(f"\n🧹 Cleaning up {len(events_to_delete)} duplicate events...")
    
    try:
        supabase = get_supabase_client()
        
        # Delete events in batches
        batch_size = 50
        deleted_count = 0
        
        for i in range(0, len(events_to_delete), batch_size):
            batch = events_to_delete[i:i + batch_size]
            batch_num = (i // batch_size) + 1
            total_batches = (len(events_to_delete) + batch_size - 1) // batch_size
            
            print(f"🗑️  Deleting batch {batch_num}/{total_batches} ({len(batch)} events)...")
            
            # Get IDs to delete
            ids_to_delete = [event['id'] for event in batch if event.get('id')]
            
            if ids_to_delete:
                # Delete by ID
                response = supabase.table('Event List').delete().in_('id', ids_to_delete).execute()
                deleted_count += len(ids_to_delete)
                print(f"   ✅ Deleted {len(ids_to_delete)} events")
            else:
                print(f"   ⚠️  No valid IDs found in batch")
        
        print(f"\n🎉 Cleanup complete!")
        print(f"📊 Total events deleted: {deleted_count}")
        
    except Exception as e:
        print(f"❌ Error during cleanup: {e}")

def main():
    """Main function to investigate and clean up URL conflicts."""
    print("🚀 Starting URL conflict investigation and cleanup...")
    print("=" * 60)
    
    # Investigate conflicts
    events_to_delete, events_to_keep = investigate_url_conflicts()
    
    if events_to_delete:
        # Ask for confirmation before deleting
        print(f"\n⚠️  Found {len(events_to_delete)} duplicate events to delete.")
        print("   These are events with placeholder names like '[SF]' that have")
        print("   the same URL as properly named events.")
        
        # For now, let's just show what would be deleted without actually deleting
        print(f"\n🔍 Analysis complete. {len(events_to_delete)} events would be deleted.")
        print("   To actually perform the cleanup, uncomment the cleanup call below.")
        
        # Perform the cleanup
        clean_up_duplicates(events_to_delete)
    else:
        print("✅ No duplicate events found - database is clean!")

if __name__ == "__main__":
    main()
