from playwright.sync_api import sync_playwright

URL = 'https://www.tech-week.com/calendar/sf'

def main():
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True)
        c = b.new_context()
        page = c.new_page()
        page.goto(URL, wait_until='networkidle')
        
        # Wait for initial load
        import time
        time.sleep(2)
        
        # Check initial count
        initial_count = page.evaluate('document.querySelectorAll(".calendar-events-item").length')
        print(f"Initial events: {initial_count}")
        
        # Scroll until we reach the footer
        for i in range(100):  # More scroll attempts
            try:
                # Check if footer is visible before scrolling
                footer_visible = page.evaluate("""
                    () => {
                        const footer = document.querySelector('footer') || 
                                     document.querySelector('[class*="footer"]') ||
                                     document.querySelector('[id*="footer"]');
                        if (!footer) return false;
                        const rect = footer.getBoundingClientRect();
                        return rect.top < window.innerHeight && rect.bottom > 0;
                    }
                """)
                
                if footer_visible:
                    print(f"Footer reached at scroll {i+1}")
                    break
                
                # Scroll down
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                time.sleep(1.5)  # Wait for content to load
                
                # Check new count
                new_count = page.evaluate('document.querySelectorAll(".calendar-events-item").length')
                print(f"After scroll {i+1}: {new_count} events")
                
                if new_count > initial_count:
                    initial_count = new_count
                elif new_count == initial_count and i > 10:  # Allow some scrolls to settle
                    print("No new events loaded for several scrolls")
                    # Don't break, keep scrolling to reach footer
                    
            except Exception as e:
                print(f"Error during scroll {i+1}: {e}")
                break
        
        # Final count
        final_count = page.evaluate('document.querySelectorAll(".calendar-events-item").length')
        print(f"Final events count: {final_count}")
        
        # Check for load more button state
        load_more = page.query_selector('[fs-list-load="more"]')
        if load_more:
            print(f"Load more button still present: {load_more.is_visible()}")
        else:
            print("Load more button not found")
        
        # Look for filters, date controls, and other mechanisms
        print("\nChecking for filters and other mechanisms:")
        other_selectors = [
            'select',
            'input[type="date"]',
            'input[type="text"]',
            '.filter',
            '.date-filter',
            '.category-filter',
            '.search',
            '[class*="filter"]',
            '[class*="search"]',
            '[class*="date"]',
            '[class*="category"]',
            '.dropdown',
            '.select',
            'button[class*="filter"]',
            'button[class*="search"]',
            'button[class*="date"]',
            'button[class*="category"]',
            '.pagination',
            '.pager',
            '.next',
            '.more',
            '[data-test*="load"]',
            '[data-test*="more"]',
            '[data-test*="filter"]',
            '[data-test*="search"]'
        ]
        
        for sel in other_selectors:
            try:
                elements = page.query_selector_all(sel)
                if elements:
                    print(f"{sel}: {len(elements)} elements found")
                    for el in elements[:3]:  # Show first 3
                        try:
                            text = el.inner_text().strip()
                            if text:
                                print(f"  - Text: '{text}'")
                        except:
                            pass
            except Exception as e:
                print(f"{sel}: Error - {e}")

        # Check for any API calls or network requests
        print("\nChecking for API calls or network requests...")
        try:
            # Get all network requests made by the page
            requests = page.context.request_log
            print(f"Total network requests: {len(requests)}")
            
            # Look for API calls that might contain event data
            api_calls = []
            for req in requests:
                if any(keyword in req.url.lower() for keyword in ['api', 'events', 'calendar', 'data', 'json']):
                    api_calls.append(req.url)
            
            if api_calls:
                print("Potential API calls found:")
                for call in api_calls[:5]:  # Show first 5
                    print(f"  - {call}")
            else:
                print("No obvious API calls found")
        except Exception as e:
            print(f"Error checking network requests: {e}")

        html = page.content()
        print(f'\nHTML size: {len(html)}')
        # Save for inspection
        with open('loaded_calendar_sf.html', 'w', encoding='utf-8') as f:
            f.write(html)
        b.close()

if __name__ == '__main__':
    main()

