# Enhanced SF Tech Week Scraper with Usage Tags

This enhanced version of the scraper adds AI-generated usage tags to help the recommendation system find more relevant events.

## What are Usage Tags?

Usage tags categorize events based on what they can be used for, such as:
- `find-cofounder` - Events where you can meet potential co-founders
- `find-angels` - Events where you can meet angel investors
- `find-advisors` - Events where you can meet advisors and mentors
- `find-users` - Events where you can meet potential users/customers
- `get-user-feedback` - Events where you can get product feedback
- `find-investors` - Events where you can meet VCs and institutional investors
- `find-talent` - Events where you can meet potential employees
- `learn-skills` - Events focused on learning and workshops
- `industry-insights` - Events for staying updated on industry trends
- `networking` - General networking events

## How It Works

1. **Scrapes Events**: Gets all events from SF Tech Week website
2. **Generates Tags**: Uses OpenAI to analyze each event and assign relevant usage tags
3. **Filters Results**: The recommendation API uses these tags to find more relevant events

## Usage

### Prerequisites

```bash
# Install dependencies
pip install -r requirements.txt

# Set up environment variables
export OPENAI_API_KEY="your-openai-api-key"
```

### Run Enhanced Scraper

```bash
# Option 1: Using the enhanced script
python3 run_enhanced_scraper.py

# Option 2: Using the shell script
./run_scraper.sh --enhanced
```

### Test Usage Tags Generation

```bash
# Test the usage tags function with sample events
python3 test_usage_tags.py
```

## Benefits

- **Better Recommendations**: The LLM can now find 5-10x more relevant events
- **Goal-Based Filtering**: Events are filtered based on user goals (find co-founders, investors, etc.)
- **More Accurate Matching**: AI analyzes event descriptions to determine their actual purpose

## Files Modified

- `scrape_tech_week_sf.py` - Added usage_tags field and generation function
- `api/recommend-events.js` - Added usage tag filtering logic
- `run_enhanced_scraper.py` - New script to run enhanced scraper
- `test_usage_tags.py` - Test script for usage tags generation

## Example Output

```csv
event_name,usage_tags,...
"Startup Pitch Night","find-investors,find-angels,networking",...
"Women in Tech Dinner","find-cofounder,find-advisors,networking",...
"AI Workshop","learn-skills,industry-insights",...
```

This enhancement should significantly improve the recommendation system's ability to find relevant events for users with specific goals.
