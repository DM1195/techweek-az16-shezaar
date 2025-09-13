import csv
import json
import re
import os
# from urllib.parse import quote  # Commented out - only needed for Supabase
import sys
import time
from dataclasses import dataclass, asdict
from typing import List, Optional, Tuple
from dotenv import load_dotenv
import openai

import requests
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

# Load environment variables from .env file
load_dotenv()

# Initialize OpenAI client
openai.api_key = os.getenv("OPENAI_API_KEY")


CALENDAR_URL = "https://www.tech-week.com/calendar/sf"
# Tunables for scrolling/loading; can be overridden via CLI
SCROLL_MAX_CYCLES = 500  # Much more aggressive scrolling for infinite scroll
STABLE_ROUNDS_TARGET = 10  # More stable rounds to ensure all content loaded
SCROLL_DELAY = 0.5  # Slightly slower to allow content to load
LOAD_MORE_DELAY = 2.0  # Longer delay for load more
DWELL_EVERY = 5  # More frequent dwell periods
DWELL_SECONDS = 2.0  # Longer dwell to allow lazy loading
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
)


@dataclass
class Event:
    event_name: str
    event_date: str
    event_time: str
    event_location: str
    event_description: str  # Note: field name is truncated in DB
    hosted_by: str  # Will be converted to JSON
    price: str
    event_url: str
    event_tags: list  # Will be stored as JSON array
    usage_tags: list  # Will be stored as JSON array - tags for what the event can be used for
    industry_tags: list  # Will be stored as JSON array - industry-specific tags
    women_specific: bool  # Whether the event is specifically for women
    invite_only: bool


def _clean_text(text: Optional[str]) -> str:
    if not text:
        return ""
    # Collapse whitespace and strip
    return re.sub(r"\s+", " ", text).strip()


def format_date_to_mmm_dd_yyyy(date_str: str) -> str:
    """Convert date from 'Fri Oct 10' format to 'Oct-10-2025' format."""
    if not date_str or not date_str.strip():
        return ""
    
    # Month mapping
    month_map = {
        "Jan": "Jan", "Feb": "Feb", "Mar": "Mar", "Apr": "Apr",
        "May": "May", "Jun": "Jun", "Jul": "Jul", "Aug": "Aug",
        "Sep": "Sep", "Oct": "Oct", "Nov": "Nov", "Dec": "Dec"
    }
    
    # Parse the date string (e.g., "Fri Oct 10")
    parts = date_str.strip().split()
    if len(parts) >= 3:
        month = parts[1][:3]  # Get first 3 chars of month
        day = parts[2]
        
        if month in month_map and day.isdigit():
            # Add leading zero to day if needed
            day_formatted = f"{int(day):02d}"
            return f"{month_map[month]}-{day_formatted}-2025"
    
    return date_str  # Return original if parsing fails


def clean_price_format(price_str: str) -> str:
    """Clean price format: remove $, keep only numeric value, return '0' for null/empty."""
    if not price_str or not price_str.strip():
        return "0"
    
    price = price_str.strip()
    
    # Check if it's "Free"
    if price.lower() == "free":
        return "0"
    
    # Remove $ symbol and any other non-numeric characters except decimal point
    import re
    # Extract numeric value (including decimal)
    numeric_match = re.search(r'(\d+(?:\.\d{1,2})?)', price)
    if numeric_match:
        return numeric_match.group(1)
    
    # If no numeric value found, return 0
    return "0"


def clean_event_time(time_str: str, description: str = "") -> tuple[str, bool]:
    """Clean event time to timestamp only, return (cleaned_time, is_invite_only)."""
    if not time_str or not time_str.strip():
        # Check description for invite-only phrases if time is empty
        if description:
            invite_phrases = ["invite only", "invitation only", "by invitation", "private", "exclusive", "limited-availability"]
            for phrase in invite_phrases:
                if phrase.lower() in description.lower():
                    return "", True  # Empty time, but invite_only = True
        return "", False
    
    time = time_str.strip()
    
    # Check for "invite only" or similar phrases in time field
    invite_phrases = ["invite only", "invitation only", "by invitation", "private", "exclusive"]
    for phrase in invite_phrases:
        if phrase.lower() in time.lower():
            return "", True  # Empty time, but invite_only = True
    
    # Extract time pattern (e.g., "12:00 pm", "9:00 am", "6:00 pm")
    import re
    time_pattern = r'(\d{1,2}:\d{2}\s*(?:am|pm|AM|PM))'
    time_match = re.search(time_pattern, time)
    
    if time_match:
        return time_match.group(1), False  # Valid time, invite_only = False
    
    # If no valid time found, return empty
    return "", False


def generate_event_tags(description: str, event_name: str = "", hosted_by: str = "") -> list:
    """Generate relevant tags for an event using OpenAI based on description, name, and host."""
    if not description or len(description.strip()) < 10:
        return []
    
    try:
        prompt = f"""
        Analyze this tech event and generate relevant tags. Focus on:
        - Gender (women, men, all-gender, etc.)
        - Industry (AI, fintech, biotech, climate, etc.)
        - Purpose/Type (dinner, networking, panel, pitch, hackathon, etc.)
        - Target Audience (founders, investors, angels, VCs, engineers, etc.)
        - Other relevant categories
        
        Event Name: {event_name}
        Hosted By: {hosted_by}
        Description: {description[:500]}...
        
        Return only 3-8 comma-separated tags, no explanations. Use lowercase, hyphenated format.
        Examples: women-in-tech, ai, networking-dinner, founders, investors, fintech, climate-tech
        """
        
        response = openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are an expert at categorizing tech events. Generate relevant, concise tags."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=100,
            temperature=0.3
        )
        
        tags_text = response.choices[0].message.content.strip()
        # Clean up the response and convert to list
        tags_text = re.sub(r'[^\w\s,-]', '', tags_text)  # Remove special chars except commas and hyphens
        tags_text = re.sub(r'\s+', ' ', tags_text)  # Normalize whitespace
        
        # Split by comma and clean up each tag
        tags = [tag.strip().lower() for tag in tags_text.split(',') if tag.strip()]
        return tags
        
    except Exception as e:
        print(f"Error generating tags: {e}")
        return []


def generate_industry_tags(description: str, event_name: str = "", hosted_by: str = "") -> list:
    """Generate industry-specific tags for an event using OpenAI."""
    if not description or len(description.strip()) < 10:
        return []
    
    try:
        prompt = f"""
        Analyze this tech event and determine its primary industry focus. Focus on these specific industry categories:
        - ai: Artificial Intelligence, Machine Learning, ML, AI tools, AI infrastructure
        - fintech: Financial Technology, payments, banking, crypto, blockchain, DeFi
        - wellness: Health, fitness, mental health, wellness tech, health-tech
        - sustainability: Climate tech, green tech, environmental, clean energy, sustainability
        - blockchain: Crypto, Web3, blockchain, DeFi, NFT, cryptocurrency
        - cybersecurity: Security, privacy, infosec, cybersecurity, data protection
        - startup: Entrepreneurship, founders, venture capital, startup ecosystem
        - media: Content creation, media, marketing, advertising, social media
        - enterprise: B2B, enterprise software, SaaS, business tools
        - consumer: B2C, consumer products, consumer apps, consumer tech
        - gaming: Gaming, esports, game development, interactive entertainment
        - edtech: Education technology, learning, training, educational tools
        - biotech: Biotechnology, life sciences, medical devices, pharmaceuticals
        - mobility: Transportation, automotive, mobility, logistics, delivery
        - real-estate: PropTech, real estate, property technology, construction
        - legal: Legal tech, law, compliance, regulatory technology
        - hr: Human resources, talent, recruiting, people operations
        - sales: Sales tech, CRM, sales tools, revenue operations
        - marketing: Marketing tech, advertising, growth, customer acquisition
        
        Event Name: {event_name}
        Hosted By: {hosted_by}
        Description: {description[:500]}...
        
        Return only the most relevant industry tags from the list above, comma-separated.
        Focus on the PRIMARY industry focus of the event. Use the exact tag names provided above.
        
        Examples: ai, fintech, wellness, sustainability, blockchain
        """
        
        response = openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are an expert at categorizing tech events by industry. Generate relevant industry tags."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=100,
            temperature=0.2
        )
        
        tags_text = response.choices[0].message.content.strip()
        # Clean up the response and convert to list
        tags_text = re.sub(r'[^\w\s,-]', '', tags_text)  # Remove special chars except commas and hyphens
        tags_text = re.sub(r'\s+', ' ', tags_text)  # Normalize whitespace
        
        # Split by comma and clean up each tag
        tags = [tag.strip().lower() for tag in tags_text.split(',') if tag.strip()]
        
        # Validate tags against known industry categories
        valid_industry_tags = {
            'ai', 'fintech', 'wellness', 'sustainability', 'blockchain', 'cybersecurity',
            'startup', 'media', 'enterprise', 'consumer', 'gaming', 'edtech', 'biotech',
            'mobility', 'real-estate', 'legal', 'hr', 'sales', 'marketing'
        }
        
        # Filter to only include valid tags
        valid_tags = [tag for tag in tags if tag in valid_industry_tags]
        return valid_tags
        
    except Exception as e:
        print(f"Error generating industry tags: {e}")
        return []


def is_women_specific_event(description: str, event_name: str = "", hosted_by: str = "") -> bool:
    """Check if an event is specifically targeted at women."""
    if not description and not event_name:
        return False
    
    # Combine all text for analysis
    full_text = f"{event_name} {description} {hosted_by}".lower()
    
    # Keywords that indicate women-specific events
    women_keywords = [
        'women', 'female', 'ladies', 'girls', 'she', 'her', 'women in tech',
        'women in ai', 'women founders', 'women entrepreneurs', 'women leaders',
        'female founders', 'female entrepreneurs', 'female leaders',
        'women-only', 'women only', 'ladies only', 'female only',
        'women\'s', 'womens', 'she-', 'her-', 'women-', 'female-',
        'diversity and inclusion', 'diversity & inclusion', 'inclusive',
        'women in', 'female in', 'ladies in'
    ]
    
    # Check for women-specific keywords
    for keyword in women_keywords:
        if keyword in full_text:
            return True
    
    return False


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
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are an expert at analyzing tech events for their potential uses. Generate relevant usage tags."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=150,
            temperature=0.2
        )
        
        tags_text = response.choices[0].message.content.strip()
        # Clean up the response and convert to list
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


def fetch_external_details(url: str, timeout: int = 20) -> Tuple[str, str, str]:
    """Fetch description, hosted_by, and price from an external event page.

    Best-effort heuristics across common platforms (Partiful, Eventbrite, Luma, etc.).
    """
    desc = hosted_by = price = ""

    try:
        headers = {"User-Agent": USER_AGENT, "Accept-Language": "en-US,en;q=0.9"}
        resp = requests.get(url, headers=headers, timeout=timeout, allow_redirects=True)
        resp.raise_for_status()
        html = resp.text
        soup = BeautifulSoup(html, "lxml")

        # Description preference: og:description -> meta description -> first long paragraph
        og_desc = soup.find("meta", attrs={"property": "og:description"})
        if og_desc and og_desc.get("content"):
            desc = og_desc["content"].strip()
        if not desc:
            meta_desc = soup.find("meta", attrs={"name": "description"})
            if meta_desc and meta_desc.get("content"):
                desc = meta_desc["content"].strip()
        if not desc:
            # Fallback: pick a reasonably long paragraph
            paragraphs = [
                _clean_text(p.get_text(" ")) for p in soup.find_all("p")
            ]
            paragraphs = [p for p in paragraphs if len(p) >= 60]
            if paragraphs:
                desc = paragraphs[0][:500]

        # Hosted by / Organizer heuristics
        body_text = soup.get_text("\n", strip=True)
        # Try explicit patterns first
        host_patterns = [
            r"Hosted by[:\s]+(.+)",
            r"Organizer[:\s]+(.+)",
            r"Organised by[:\s]+(.+)",
            r"Organized by[:\s]+(.+)",
            r"By[:\s]+(.+)",
        ]
        for pat in host_patterns:
            m = re.search(pat, body_text, flags=re.IGNORECASE)
            if m:
                hosted_by = _clean_text(m.group(1).split("\n")[0])
                break
        if not hosted_by:
            # Look for meta tags commonly used
            meta_author = soup.find("meta", attrs={"name": "author"})
            if meta_author and meta_author.get("content"):
                hosted_by = _clean_text(meta_author["content"])[:120]

        # If hosted_by contains no letters (e.g., purely emoji or symbols), discard
        if hosted_by and not re.search(r"[A-Za-z]", hosted_by):
            hosted_by = ""

        # Price heuristics
        # Prefer explicit keyword segments
        price = ""
        # Try to find typical price/fee areas
        price_candidates = []
        # Collect visible text chunks from likely nodes
        for sel in [
            "[class*=price]",
            "[class*=ticket]",
            "[class*=fee]",
            "[data-test*=price]",
            "[data-automation*=price]",
        ]:
            for n in soup.select(sel):
                t = _clean_text(n.get_text(" "))
                if t:
                    price_candidates.append(t)

        text_for_price = "\n".join(price_candidates) or body_text
        # Look for Free first
        m = re.search(r"\bfree\b", text_for_price, flags=re.IGNORECASE)
        if m:
            price = "Free"
        # Otherwise look for money patterns
        if not price:
            m = re.search(r"\$\s?\d{1,3}(?:[,\.]\d{3})*(?:\.\d{2})?", text_for_price)
            if m:
                price = m.group(0)
        # If still nothing, try ranges like $10-$20
        if not price:
            m = re.search(r"\$\s?\d+[\s\-–]+\$\s?\d+", text_for_price)
            if m:
                price = m.group(0)

        return _clean_text(desc), _clean_text(hosted_by), _clean_text(price)
    except requests.RequestException:
        return desc, hosted_by, price
    except Exception:
        return desc, hosted_by, price


def scrape_events(emit_json: bool = False) -> List[Event]:
    events: List[Event] = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(user_agent=USER_AGENT, locale="en-US")
        page = context.new_page()
        page.set_default_timeout(30000)

        page.goto(CALENDAR_URL, wait_until="networkidle")

        # Wait until at least one event item is present
        start = time.time()
        while True:
            try:
                count = page.evaluate('document.querySelectorAll(".calendar-events-item").length')
            except Exception:
                count = 0
            if count > 0:
                break
            if time.time() - start > 30:
                # Timeout waiting for events to render
                browser.close()
                return events
            time.sleep(0.5)

        # Load more items and/or infinite-scroll until count stabilizes
        stable_rounds = 0
        last_count = -1
        for i in range(SCROLL_MAX_CYCLES):  # cycles to attempt loading more
            # Click load-more button to load next page
            try:
                # Look for various load more button selectors
                load_more_selectors = [
                    'button:has-text("Load More")',
                    'button:has-text("Load more")', 
                    'button:has-text("Load")',
                    '[fs-list-load="more"]',
                    '[fs-list-element="load-more"]',
                    '[data-fs-list-element="load-more"]',
                    'button[class*="load"]',
                    'button[class*="more"]',
                    'a:has-text("Load More")',
                    'a:has-text("Load more")'
                ]
                
                load_more_clicked = False
                for selector in load_more_selectors:
                    try:
                        load_more = page.query_selector(selector)
                        if load_more and load_more.is_visible():
                            if not emit_json:
                                print(f"Clicking load more button: {selector}")
                            load_more.click()
                            time.sleep(LOAD_MORE_DELAY)
                            load_more_clicked = True
                            break
                    except Exception:
                        continue
                
                if not load_more_clicked and not emit_json:
                    print("No load more button found or visible")
                    
            except Exception as e:
                if not emit_json:
                    print(f"Error clicking load more: {e}")
                pass

            # Trigger lazy loading by scrolling - use multiple scroll techniques
            try:
                # Method 1: Scroll to bottom
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                time.sleep(0.2)
                
                # Method 2: Scroll by viewport height
                page.evaluate("window.scrollBy(0, window.innerHeight)")
                time.sleep(0.2)
                
                # Method 3: Scroll to a specific position based on current scroll
                current_scroll = page.evaluate("window.pageYOffset")
                page.evaluate(f"window.scrollTo(0, {current_scroll + 1000})")
                
            except Exception:
                pass
            time.sleep(SCROLL_DELAY)

            try:
                count = page.evaluate('document.querySelectorAll(".calendar-events-item").length')
            except Exception:
                count = last_count

            if count == last_count:
                stable_rounds += 1
            else:
                stable_rounds = 0
            last_count = count

            # Debug output every 10 cycles (only if not using --json)
            if i % 10 == 0 and not emit_json:
                print(f"Cycle {i}: Found {count} events, stable rounds: {stable_rounds}")

            # Check if we've reached the end of pagination
            try:
                # Look for pagination indicators or "no more" messages
                pagination_info = page.evaluate("""
                    () => {
                        // Look for pagination text like "1 / 57" or "Page X of Y"
                        const paginationText = document.body.innerText;
                        const pageMatch = paginationText.match(/(\\d+)\\s*\\/\\s*(\\d+)/);
                        if (pageMatch) {
                            return {
                                currentPage: parseInt(pageMatch[1]),
                                totalPages: parseInt(pageMatch[2]),
                                hasLoadMore: document.querySelector('button:has-text("Load More")') !== null
                            };
                        }
                        return null;
                    }
                """)
                
                if pagination_info:
                    if not emit_json and i % 10 == 0:
                        print(f"Pagination: Page {pagination_info['currentPage']} of {pagination_info['totalPages']}")
                    
                    # If we've reached the last page or no load more button, we're done
                    if pagination_info['currentPage'] >= pagination_info['totalPages'] or not pagination_info['hasLoadMore']:
                        if not emit_json:
                            print(f"Reached end of pagination: {count} events loaded")
                        break
            except Exception:
                pass

            # Consider loaded if stable for a few rounds (but be more lenient for pagination)
            # Only stop if we've been stable for a long time AND we have a reasonable number of events
            if stable_rounds >= STABLE_ROUNDS_TARGET and count > 500:
                if not emit_json:
                    print(f"Stopping: {count} events loaded, stable for {stable_rounds} rounds")
                break

            # Periodic dwell to allow lazy loaders to fetch more content
            if DWELL_EVERY and (i + 1) % DWELL_EVERY == 0:
                try:
                    time.sleep(DWELL_SECONDS)
                except Exception:
                    pass

        # Extract event cards
        card_handles = page.query_selector_all(".calendar-events-item")
        for card in card_handles:
            try:
                name = card.query_selector('h3[fs-list-field="name"], h3').inner_text().strip()
            except Exception:
                name = ""

            # Date/time are inside .date-wrapper; extract robustly
            date = time_str = ""
            try:
                # Extract time specifically from nowrap element when present
                t_els = card.query_selector_all('.date-wrapper .text-style-nowrap')
                for t_el in t_els:
                    txt = t_el.inner_text().strip()
                    if txt:
                        time_str = txt
                        break

                # Build date from day-of-week, month, and day-of-month tokens
                tokens = []
                for el in card.query_selector_all('.date-wrapper *'):
                    try:
                        txt = el.inner_text().strip()
                    except Exception:
                        txt = ""
                    if not txt or txt == '·':
                        continue
                    tokens.append(txt)

                dow = month = dom = ""
                for tok in tokens:
                    if not dow and re.match(r"^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$", tok):
                        dow = tok
                    elif not month and re.match(r"^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$", tok):
                        month = tok
                    elif not dom and re.match(r"^\d{1,2}$", tok):
                        dom = tok
                date = " ".join([x for x in [dow, month, dom] if x])
            except Exception:
                pass

            # Location (mobile class is fairly consistent across viewports)
            location = ""
            try:
                loc_el = card.query_selector('.calendar-info-wrapper .is-mobile')
                if loc_el:
                    location = loc_el.inner_text().strip()
            except Exception:
                pass

            # Event link
            url = ""
            try:
                a = card.query_selector('a.event-link')
                if a:
                    url = a.get_attribute('href') or ""
            except Exception:
                pass

            desc, host, price = ("", "", "")
            if url:
                desc, host, price = fetch_external_details(url)

            # Skip keyword generation in first phase - will be added later
            tags = []  # Empty tags for now
            
            # Clean event time and check for invite-only
            cleaned_time, is_invite_only = clean_event_time(_clean_text(time_str), _clean_text(desc))

            event = Event(
                event_name=_clean_text(name),
                event_date=format_date_to_mmm_dd_yyyy(_clean_text(date)),
                event_time=cleaned_time,
                event_location=_clean_text(location),
                event_description=_clean_text(desc),  # Using correct field name
                hosted_by=_clean_text(host),
                price=clean_price_format(_clean_text(price)),
                event_url=url,
                event_tags=tags,  # Empty tags for now
                usage_tags=[],  # Empty usage tags for now
                industry_tags=[],  # Empty industry tags for now
                women_specific=False,  # Will be determined later
                invite_only=is_invite_only,
            )
            
            events.append(event)

        browser.close()
    return events


def write_csv(events: List[Event], out_path: str) -> None:
    fieldnames = [
        "event_name",
        "event_date",
        "event_time",
        "event_location",
        "event_description",  # Using correct field name
        "hosted_by",
        "price",
        "event_url",
        "event_tags",
        "usage_tags",
        "industry_tags",
        "women_specific",
        "invite_only",
        "event_name_and_link",  # Add composite key column
    ]
    
    # Ensure the data directory exists
    dirname = os.path.dirname(out_path)
    if dirname:
        os.makedirs(dirname, exist_ok=True)
    
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for e in events:
            event_dict = asdict(e)
            # Add the composite key
            event_dict["event_name_and_link"] = f"{event_dict['event_name']} | {event_dict['event_url']}"
            writer.writerow(event_dict)

def to_json(events: List[Event]) -> str:
    return json.dumps([asdict(e) for e in events], ensure_ascii=False)


def update_csv_with_keywords(csv_path: str) -> None:
    """Update the CSV file by adding keywords to each event using OpenAI."""
    print(f"Updating CSV with keywords: {csv_path}")
    
    # Read existing CSV
    events = []
    with open(csv_path, 'r', newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            events.append(row)
    
    print(f"Found {len(events)} events to update with keywords...")
    
    # Update each event with keywords and usage tags
    for i, event in enumerate(events):
        print(f"Processing event {i+1}/{len(events)}: {event['event_name'][:50]}...")
        
        # Generate keywords using OpenAI
        description = event.get('event_description', '')
        event_name = event.get('event_name', '')
        hosted_by = event.get('hosted_by', '')
        
        tags = generate_event_tags(description, event_name, hosted_by)
        event['event_tags'] = tags
        
        # Generate usage tags using OpenAI
        usage_tags = generate_usage_tags(description, event_name, hosted_by)
        event['usage_tags'] = usage_tags
        
        # Generate industry tags using OpenAI
        industry_tags = generate_industry_tags(description, event_name, hosted_by)
        event['industry_tags'] = industry_tags
        
        # Check if event is women-specific
        women_specific = is_women_specific_event(description, event_name, hosted_by)
        event['women_specific'] = women_specific
        
        # Update the composite key
        event['event_name_and_link'] = f"{event['event_name']} | {event['event_url']}"
    
    # Write updated CSV
    fieldnames = [
        "event_name",
        "event_date", 
        "event_time",
        "event_location",
        "event_description",
        "hosted_by",
        "price",
        "event_url",
        "event_tags",
        "usage_tags",
        "industry_tags",
        "women_specific",
        "invite_only",
        "event_name_and_link",
    ]
    
    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for event in events:
            writer.writerow(event)
    
    print(f"Successfully updated {len(events)} events with keywords!")


def update_csv_date_format(csv_path: str) -> None:
    """Update the CSV file to change date format to MMM-DD-YYYY."""
    print(f"Updating date format in CSV: {csv_path}")
    
    # Read existing CSV
    events = []
    with open(csv_path, 'r', newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            events.append(row)
    
    print(f"Found {len(events)} events to update date format...")
    
    # Update each event's date format
    for i, event in enumerate(events):
        if i % 100 == 0:  # Progress indicator every 100 events
            print(f"Processing event {i+1}/{len(events)}...")
        
        # Convert date format
        old_date = event.get('event_date', '')
        new_date = format_date_to_mmm_dd_yyyy(old_date)
        event['event_date'] = new_date
    
    # Write updated CSV
    fieldnames = [
        "event_name",
        "event_date", 
        "event_time",
        "event_location",
        "event_description",
        "hosted_by",
        "price",
        "event_url",
        "event_tags",
        "event_name_and_link",
    ]
    
    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for event in events:
            writer.writerow(event)
    
    print(f"Successfully updated date format for {len(events)} events!")


def update_csv_price_format(csv_path: str) -> None:
    """Update the CSV file to clean price format: remove $, set null to 0."""
    print(f"Updating price format in CSV: {csv_path}")
    
    # Read existing CSV
    events = []
    with open(csv_path, 'r', newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            events.append(row)
    
    print(f"Found {len(events)} events to update price format...")
    
    # Update each event's price format
    for i, event in enumerate(events):
        if i % 100 == 0:  # Progress indicator every 100 events
            print(f"Processing event {i+1}/{len(events)}...")
        
        # Clean price format
        old_price = event.get('price', '')
        new_price = clean_price_format(old_price)
        event['price'] = new_price
    
    # Write updated CSV
    fieldnames = [
        "event_name",
        "event_date", 
        "event_time",
        "event_location",
        "event_description",
        "hosted_by",
        "price",
        "event_url",
        "event_tags",
        "event_name_and_link",
    ]
    
    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for event in events:
            writer.writerow(event)
    
    print(f"Successfully updated price format for {len(events)} events!")


def update_csv_time_format(csv_path: str) -> None:
    """Update the CSV file to clean time format: timestamp only, add invite_only column."""
    print(f"Updating time format in CSV: {csv_path}")
    
    # Read existing CSV
    events = []
    with open(csv_path, 'r', newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            events.append(row)
    
    print(f"Found {len(events)} events to update time format...")
    
    # Update each event's time format
    for i, event in enumerate(events):
        if i % 100 == 0:  # Progress indicator every 100 events
            print(f"Processing event {i+1}/{len(events)}...")
        
        # Clean time format and check for invite-only
        old_time = event.get('event_time', '')
        description = event.get('event_description', '')
        cleaned_time, is_invite_only = clean_event_time(old_time, description)
        event['event_time'] = cleaned_time
        event['invite_only'] = is_invite_only
    
    # Write updated CSV
    fieldnames = [
        "event_name",
        "event_date", 
        "event_time",
        "event_location",
        "event_description",
        "hosted_by",
        "price",
        "event_url",
        "event_tags",
        "invite_only",
        "event_name_and_link",
    ]
    
    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for event in events:
            writer.writerow(event)
    
    print(f"Successfully updated time format for {len(events)} events!")


def remove_duplicate_events(csv_path: str) -> None:
    """Remove duplicate events based on event_name_and_link, keeping the first occurrence."""
    print(f"Removing duplicate events from CSV: {csv_path}")
    
    # Read existing CSV
    events = []
    with open(csv_path, 'r', newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            events.append(row)
    
    print(f"Found {len(events)} total events...")
    
    # Track seen event_name_and_link values
    seen = set()
    unique_events = []
    duplicates_removed = 0
    
    for event in events:
        event_key = event['event_name_and_link']
        if event_key not in seen:
            seen.add(event_key)
            unique_events.append(event)
        else:
            duplicates_removed += 1
            print(f"Removing duplicate: {event['event_name']}")
    
    print(f"Removed {duplicates_removed} duplicate events")
    print(f"Keeping {len(unique_events)} unique events")
    
    # Write updated CSV
    fieldnames = [
        "event_name",
        "event_date", 
        "event_time",
        "event_location",
        "event_description",
        "hosted_by",
        "price",
        "event_url",
        "event_tags",
        "usage_tags",
        "industry_tags",
        "women_specific",
        "invite_only",
        "event_name_and_link",
    ]
    
    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for event in unique_events:
            writer.writerow(event)
    
    print(f"Successfully removed duplicates! CSV now has {len(unique_events)} unique events.")


# def upsert_supabase_events(
#     events: List[Event],
#     supabase_url: str,
#     supabase_key: str,
#     table: str = "events",
#     on_conflict: Optional[str] = "event_url",
#     batch_size: int = 200,
#     date_year: Optional[int] = None,
#     price_numeric: bool = False,
#     coerce_time: bool = False,
#     no_nulls: bool = False,
#     composite_key_col: Optional[str] = None,
# ) -> int:
#     """Upsert events into Supabase via PostgREST.

#     Requires a unique constraint on `on_conflict` column. Uses service role key or anon key
#     with appropriate insert/update policies. Returns number of upserted rows reported by Supabase.
#     """
#     if not events:
#         return 0
#     base = supabase_url.rstrip("/")
#     # Encode table name for path segment (handles spaces/mixed case)
#     table_path = quote(table, safe="")
#     endpoint = f"{base}/rest/v1/{table_path}"
#     if on_conflict:
#         endpoint += f"?on_conflict={on_conflict}"
#     headers = {
#         "apikey": supabase_key,
#         "Authorization": f"Bearer {supabase_key}",
#         "Content-Type": "application/json",
#         # If on_conflict is set, enable upsert. Always request representation to count rows.
#         "Prefer": ("resolution=merge-duplicates," if on_conflict else "") + "return=representation",
#     }

#     total = 0
#     payloads = []
#     for e in events:
#         event_dict = asdict(e)
#         # Convert hosted_by to JSON if it's not empty
#         if event_dict.get("hosted_by"):
#             event_dict["hosted_by"] = {"name": event_dict["hosted_by"]}
#         else:
#             event_dict["hosted_by"] = None
        
#         # event_tags is already a list, which will be stored as JSON
#         if not event_dict.get("event_tags"):
#             event_dict["event_tags"] = []
        
#         payloads.append(event_dict)
#     if date_year or price_numeric or coerce_time or no_nulls:
#         mon_map = {"Jan":1,"Feb":2,"Mar":3,"Apr":4,"May":5,"Jun":6,
#                    "Jul":7,"Aug":8,"Sep":9,"Oct":10,"Nov":11,"Dec":12}
#         for p in payloads:
#             if date_year:
#                 d = (p.get("event_date") or "").strip()
#                 parts = d.split()
#                 # Expected like: Fri Oct 10
#                 if len(parts) >= 3:
#                     mon = mon_map.get(parts[1][:3])
#                     try:
#                         dom = int(parts[2])
#                     except Exception:
#                         dom = None
#                     if mon and dom:
#                         p["event_date"] = f"{date_year:04d}-{mon:02d}-{dom:02d}"
#             if price_numeric:
#                 val = (p.get("price") or "").strip()
#                 low = None
#                 if not val:
#                     low = None
#                 else:
#                     s = val.lower()
#                     if "free" in s:
#                         low = 0
#                     else:
#                         import re as _re
#                         m = _re.findall(r"\$\s?(\d+(?:\.\d{1,2})?)", val)
#                         if m:
#                             try:
#                                 low = float(m[0])
#                             except Exception:
#                                 low = None
#                 p["price"] = low
#             if coerce_time:
#                 t = (p.get("event_time") or "").strip()
#                 import re as _re
#                 m = _re.search(r"^(\d{1,2}):(\d{2})\s*(am|pm)$", t, flags=_re.IGNORECASE)
#                 if m:
#                     hh = int(m.group(1)) % 12
#                     if m.group(3).lower() == 'pm':
#                         hh += 12
#                     p["event_time"] = f"{hh:02d}:{m.group(2)}:00"
#                 else:
#                     p["event_time"] = None
#             if no_nulls:
#                 # Fill remaining null-ish values with safe defaults (works with typed columns when using --year/--coerce-time/--price-numeric)
#                 if not p.get("event_name"):
#                     p["event_name"] = "Untitled Event"
#                 if p.get("event_date") in (None, "") and date_year:
#                     # Fallback to Oct 01 of the given year if unknown
#                     p["event_date"] = f"{date_year:04d}-10-01"
#                 if p.get("event_time") in (None, "") and coerce_time:
#                     p["event_time"] = "00:00:00"
#                 if p.get("event_location") in (None, ""):
#                     p["event_location"] = "TBA"
#                 if p.get("event_description") in (None, ""):
#                     p["event_description"] = ""
#                 if p.get("hosted_by") in (None, ""):
#                     p["hosted_by"] = {"name": "Unknown"}
#                 if price_numeric and (p.get("price") in (None, "")):
#                     p["price"] = 0
#                 if not p.get("event_url"):
#                     p["event_url"] = ""
#                 if not p.get("event_tags"):
#                     p["event_tags"] = []
#     # Add composite unique key column if requested
#     if composite_key_col:
#         for p in payloads:
#             name = (p.get("event_name") or "").strip()
#             url = (p.get("event_url") or "").strip()
#             p[composite_key_col] = f"{name} | {url}" if url or name else None

#     # De-duplicate payloads within this operation based on the conflict column
#     conflict_key = composite_key_col or on_conflict or "event_url"
#     if conflict_key:
#         seen = set()
#         deduped = []
#         for p in payloads:
#             k = p.get(conflict_key)
#             if k is None:
#                 # keep rows without a key (they may be dropped by DB constraints)
#                 deduped.append(p)
#                 continue
#             if k in seen:
#                 continue
#             seen.add(k)
#             deduped.append(p)
#         payloads = deduped
#     for i in range(0, len(payloads), batch_size):
#         chunk = payloads[i : i + batch_size]
#         resp = requests.post(endpoint, headers=headers, json=chunk, timeout=60)
#         if resp.status_code >= 400:
#             raise RuntimeError(f"Supabase upsert failed: {resp.status_code} {resp.text[:300]}")
#         data = resp.json() if resp.content else []
#         total += len(data) if isinstance(data, list) else 0
#     return total


def main():
    out = "data/sf_tech_week_events.csv"
    emit_json = False
    # to_supabase = False  # Commented out - CSV only
    # table = "events"  # Commented out - Supabase related
    # on_conflict = "event_name_and_link"  # Commented out - Supabase related
    # date_year = None  # Commented out - Supabase related
    # price_numeric = False  # Commented out - Supabase related
    # coerce_time = False  # Commented out - Supabase related
    # no_nulls = False  # Commented out - Supabase related
    # composite_key_col = None  # Commented out - Supabase related
    global SCROLL_MAX_CYCLES, STABLE_ROUNDS_TARGET, SCROLL_DELAY, LOAD_MORE_DELAY, DWELL_EVERY, DWELL_SECONDS
    # Simple arg parsing: allow `--json`, `--supabase`, `--table <name>`, and optional output path
    args = [a for a in sys.argv[1:] if a]
    if "--json" in args:
        emit_json = True
        args.remove("--json")
    # if "--supabase" in args:  # Commented out - CSV only
    #     to_supabase = True
    #     args.remove("--supabase")
    # if "--table" in args:  # Commented out - Supabase related
    #     try:
    #         i = args.index("--table")
    #         table = args[i + 1]
    #         del args[i : i + 2]
    #     except Exception:
    #         pass
    # if "--no-on-conflict" in args:  # Commented out - Supabase related
    #     on_conflict = None
    #     args.remove("--no-on-conflict")
    # if "--on-conflict" in args:  # Commented out - Supabase related
    #     try:
    #         i = args.index("--on-conflict")
    #         on_conflict = args[i + 1]
    #         del args[i : i + 2]
    #     except Exception:
    #         pass
    # if "--year" in args:  # Commented out - Supabase related
    #     try:
    #         i = args.index("--year")
    #         date_year = int(args[i + 1])
    #         del args[i : i + 2]
    #     except Exception:
    #         pass
    # if "--price-numeric" in args:  # Commented out - Supabase related
    #     price_numeric = True
    #     args.remove("--price-numeric")
    # if "--coerce-time" in args:  # Commented out - Supabase related
    #     coerce_time = True
    #     args.remove("--coerce-time")
    # if "--no-null" in args or "--no-nulls" in args:  # Commented out - Supabase related
    #     no_nulls = True
    #     if "--no-null" in args:
    #         args.remove("--no-null")
    #     if "--no-nulls" in args:
    #         args.remove("--no-nulls")
    # if "--composite-key-col" in args:  # Commented out - Supabase related
    #     try:
    #         i = args.index("--composite-key-col")
    #         composite_key_col = args[i + 1]
    #         del args[i : i + 2]
    #     except Exception:
    #         pass
    # Optional tuning flags for loading
    if "--max-cycles" in args:
        try:
            i = args.index("--max-cycles")
            SCROLL_MAX_CYCLES = int(args[i + 1])
            del args[i : i + 2]
        except Exception:
            pass
    if "--stable-rounds" in args:
        try:
            i = args.index("--stable-rounds")
            STABLE_ROUNDS_TARGET = int(args[i + 1])
            del args[i : i + 2]
        except Exception:
            pass
    if "--scroll-delay" in args:
        try:
            i = args.index("--scroll-delay")
            SCROLL_DELAY = float(args[i + 1])
            del args[i : i + 2]
        except Exception:
            pass
    if "--load-more-delay" in args:
        try:
            i = args.index("--load-more-delay")
            LOAD_MORE_DELAY = float(args[i + 1])
            del args[i : i + 2]
        except Exception:
            pass
    if "--dwell-every" in args:
        try:
            i = args.index("--dwell-every")
            DWELL_EVERY = int(args[i + 1])
            del args[i : i + 2]
        except Exception:
            pass
    if "--dwell-seconds" in args:
        try:
            i = args.index("--dwell-seconds")
            DWELL_SECONDS = float(args[i + 1])
            del args[i : i + 2]
        except Exception:
            pass
    
    # Set output filename from remaining arguments (after all other args are processed)
    if args:
        out = args[0]
    
    if not emit_json:
        print(f"Scraping calendar: {CALENDAR_URL}")
    
    # Phase 1: Scrape events without keywords
    print("Phase 1: Scraping events (without keywords)...")
    events = scrape_events(emit_json)
    
    if emit_json:
        # Print JSON to stdout (serverless-friendly)
        payload = to_json(events)
        print(payload)
    else:
        # Phase 1: Write events to CSV without keywords
        print(f"Phase 1 Complete: Fetched {len(events)} events. Writing to {out}...")
        write_csv(events, out)
        print(f"Phase 1 Done: {len(events)} events written to CSV")
        
        # Phase 2: Add keywords using OpenAI
        print("\nPhase 2: Adding keywords using OpenAI...")
        update_csv_with_keywords(out)
        print("Phase 2 Complete: All events updated with keywords!")
        print("Done.")


if __name__ == "__main__":
    main()
