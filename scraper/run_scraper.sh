#!/bin/bash

# Tech Week SF Events Scraper
# This script runs the scraper and uploads events directly to Supabase

echo "Tech Week SF Events Scraper"
echo "=========================="

# Check for enhanced mode
if [ "$1" = "--enhanced" ] || [ "$1" = "-e" ]; then
    echo "Running in ENHANCED mode with usage tags..."
    echo "This will add AI-generated usage tags to help with recommendations."
    echo ""
    
    # Check for OpenAI API key
    if [ -z "$OPENAI_API_KEY" ]; then
        echo "Error: Enhanced mode requires OpenAI API key"
        echo "Please set: export OPENAI_API_KEY='your-openai-api-key'"
        exit 1
    fi
    
    echo "Running enhanced scraper with usage tags..."
    python3 run_enhanced_scraper.py
    exit 0
fi

# Check if environment variables are set
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "Error: Missing required environment variables"
    echo ""
    echo "Please set the following environment variables:"
    echo "  export SUPABASE_URL='your-supabase-url'"
    echo "  export SUPABASE_SERVICE_ROLE_KEY='your-service-role-key'"
    echo ""
    echo "You can find these in your Supabase project settings:"
    echo "  - URL: Settings > API > Project URL"
    echo "  - Service Role Key: Settings > API > service_role key"
    echo ""
    exit 1
fi

echo "Environment variables found ✓"
echo "Supabase URL: ${SUPABASE_URL:0:20}..."
echo ""

# Run the scraper with Supabase upload
echo "Starting scraper..."
python3 scrape_tech_week_sf.py \
    --supabase \
    --table "Event List" \
    --composite-key-col "event_name_and_link" \
    --year 2024 \
    --coerce-time \
    --no-nulls \
    --max-cycles 1000 \
    --stable-rounds 15

echo ""
echo "Scraping completed!"
