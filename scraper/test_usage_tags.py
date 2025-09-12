#!/usr/bin/env python3
"""
Test script to verify usage tags generation for a few sample events.
This script tests the generate_usage_tags function without running the full scraper.
"""

import os
import sys
from dotenv import load_dotenv
import openai

# Load environment variables
load_dotenv()

# Initialize OpenAI client
openai.api_key = os.getenv("OPENAI_API_KEY")

def generate_usage_tags(description: str, event_name: str = "", hosted_by: str = "") -> list:
    """Generate usage tags for an event using OpenAI to categorize what the event can be used for."""
    if not description or len(description.strip()) < 10:
        return []
    
    try:
        prompt = f"""
        Analyze this tech event and determine what it can be used for. Focus on these specific usage categories:
        - find-cofounder: Events where you can meet potential co-founders, partners, or collaborators
        - find-angels: Events where you can meet angel investors or early-stage investors
        - find-advisors: Events where you can meet advisors, mentors, or industry experts
        - find-users: Events where you can meet potential users, customers, or beta testers
        - get-user-feedback: Events where you can get feedback on your product or idea
        - find-investors: Events where you can meet VCs, institutional investors, or funding sources
        - find-talent: Events where you can meet potential employees, contractors, or team members
        - learn-skills: Events focused on learning, workshops, or skill development
        - industry-insights: Events for staying updated on industry trends and insights
        - networking: General networking events for building professional relationships
        
        Event Name: {event_name}
        Hosted By: {hosted_by}
        Description: {description[:500]}...
        
        Return only the relevant usage tags from the list above, comma-separated. 
        Be generous - if an event could potentially be used for multiple purposes, include all relevant ones.
        Use the exact tag names provided above.
        
        Examples: find-cofounder, find-angels, networking, learn-skills
        """
        
        response = openai.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are an expert at analyzing tech events for their potential uses. Generate relevant usage tags."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=150,
            temperature=0.2
        )
        
        tags_text = response.choices[0].message.content.strip()
        # Clean up the response and convert to list
        import re
        tags_text = re.sub(r'[^\w\s,-]', '', tags_text)  # Remove special chars except commas and hyphens
        tags_text = re.sub(r'\s+', ' ', tags_text)  # Normalize whitespace
        
        # Split by comma and clean up each tag
        tags = [tag.strip().lower() for tag in tags_text.split(',') if tag.strip()]
        
        # Validate tags against known usage categories
        valid_usage_tags = {
            'find-cofounder', 'find-angels', 'find-advisors', 'find-users', 
            'get-user-feedback', 'find-investors', 'find-talent', 'learn-skills',
            'industry-insights', 'networking'
        }
        
        # Filter to only include valid tags
        valid_tags = [tag for tag in tags if tag in valid_usage_tags]
        return valid_tags
        
    except Exception as e:
        print(f"Error generating usage tags: {e}")
        return []

def test_usage_tags():
    """Test usage tags generation with sample events."""
    
    if not openai.api_key:
        print("❌ OpenAI API key not found. Please set OPENAI_API_KEY in your .env file.")
        return
    
    print("🧪 Testing usage tags generation...")
    print("=" * 50)
    
    # Sample events for testing
    test_events = [
        {
            "name": "Startup Pitch Night",
            "hosted_by": "TechCrunch",
            "description": "Join us for an evening of startup pitches where founders present their ideas to a panel of investors and VCs. Perfect for entrepreneurs looking to raise funding and connect with potential investors."
        },
        {
            "name": "Women in Tech Networking Dinner",
            "hosted_by": "Women Who Code",
            "description": "An exclusive networking dinner for women in technology. Connect with fellow female founders, engineers, and industry leaders. Great opportunity to find mentors and collaborators."
        },
        {
            "name": "AI Workshop: Building with GPT",
            "hosted_by": "OpenAI",
            "description": "Hands-on workshop on building applications with GPT. Learn the latest techniques and best practices. Perfect for developers looking to upskill in AI development."
        },
        {
            "name": "Product Feedback Session",
            "hosted_by": "Product Hunt",
            "description": "Bring your product or idea and get feedback from potential users and industry experts. Great for early-stage startups looking to validate their ideas and improve their products."
        },
        {
            "name": "Fintech Industry Trends Panel",
            "hosted_by": "Fintech Association",
            "description": "Panel discussion on the latest trends in fintech, featuring industry leaders and experts. Learn about regulatory changes, new technologies, and market opportunities."
        }
    ]
    
    for i, event in enumerate(test_events, 1):
        print(f"\n📅 Event {i}: {event['name']}")
        print(f"🏢 Hosted by: {event['hosted_by']}")
        print(f"📝 Description: {event['description'][:100]}...")
        
        usage_tags = generate_usage_tags(
            event['description'], 
            event['name'], 
            event['hosted_by']
        )
        
        print(f"🏷️  Usage Tags: {', '.join(usage_tags) if usage_tags else 'None'}")
        print("-" * 50)

if __name__ == "__main__":
    test_usage_tags()
