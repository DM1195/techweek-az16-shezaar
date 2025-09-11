from playwright.sync_api import sync_playwright

URL = 'https://www.tech-week.com/calendar/sf'

def main():
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True)
        c = b.new_context()
        page = c.new_page()
        page.goto(URL, wait_until='networkidle')
        sel_list = [
            '.calendar-events-item',
            '.calendar-events-list',
            '#events-list',
            '.w-dyn-items',
            '.calendar-events-list-wrapper',
            '[fs-list-element="list"]',
            '[fs-list-load="more"]',
            '[fs-list-element="load-more"]',
        ]
        for sel in sel_list:
            try:
                cnt = page.evaluate(f'document.querySelectorAll("{sel}").length')
                print(sel, cnt)
            except Exception as e:
                print(sel, 'ERR', e)

        html = page.content()
        print('HTML size:', len(html))
        # Save for inspection
        with open('loaded_calendar_sf.html', 'w', encoding='utf-8') as f:
            f.write(html)
        b.close()

if __name__ == '__main__':
    main()

