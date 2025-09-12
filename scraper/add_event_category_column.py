#!/usr/bin/env python3
"""
Script to add event_category column to the existing Event List table in Supabase.
This script uses the service role key to bypass RLS and add the column.
"""

import os
import sys
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

def add_event_category_column(supabase: Client) -> bool:
    """Add event_category column to the Event List table."""
    try:
        print("🔧 Adding event_category column to Event List table...")
        
        # Use SQL to add the column
        sql_query = """
        ALTER TABLE "Event List" 
        ADD COLUMN IF NOT EXISTS event_category TEXT;
        """
        
        # Execute the SQL query
        response = supabase.rpc('exec_sql', {'sql': sql_query}).execute()
        
        print("✅ Successfully added event_category column")
        return True
        
    except Exception as e:
        print(f"❌ Error adding event_category column: {e}")
        
        # Try alternative approach using direct SQL execution
        try:
            print("🔄 Trying alternative approach...")
            
            # This might work if the RPC function doesn't exist
            response = supabase.postgrest.rpc('exec_sql', {'sql': sql_query}).execute()
            print("✅ Successfully added event_category column (alternative method)")
            return True
            
        except Exception as e2:
            print(f"❌ Alternative approach also failed: {e2}")
            return False

def verify_column_exists(supabase: Client) -> bool:
    """Verify that the event_category column exists."""
    try:
        print("🔍 Verifying event_category column exists...")
        
        # Try to select the column to see if it exists
        response = supabase.table('Event List').select('event_category').limit(1).execute()
        
        if response.data is not None:
            print("✅ event_category column exists and is accessible")
            return True
        else:
            print("❌ event_category column not found")
            return False
            
    except Exception as e:
        print(f"❌ Error verifying column: {e}")
        return False

def main():
    """Main function to add the event_category column."""
    print("🚀 Adding event_category column to Event List table...")
    print("=" * 60)
    
    # Check for required environment variables
    if not os.getenv("SUPABASE_URL") or (not os.getenv("SUPABASE_SERVICE_ROLE_KEY") and not os.getenv("SUPABASE_ANON_KEY")):
        print("❌ Missing Supabase credentials!")
        print("   Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) in your .env file")
        return
    
    try:
        # Initialize Supabase client
        print("🔧 Initializing Supabase client...")
        supabase = get_supabase_client()
        print("✅ Supabase client initialized")
        
        # Add the event_category column
        success = add_event_category_column(supabase)
        
        if success:
            # Verify the column was added
            verify_column_exists(supabase)
            print("\n🎉 Column addition complete!")
            print("   You can now run the load_to_supabase_service.py script to upload events with categories.")
        else:
            print("\n❌ Failed to add event_category column")
            print("   You may need to add this column manually in the Supabase dashboard:")
            print("   1. Go to your Supabase project dashboard")
            print("   2. Navigate to Table Editor")
            print("   3. Select the 'Event List' table")
            print("   4. Add a new column named 'event_category' of type 'text'")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
