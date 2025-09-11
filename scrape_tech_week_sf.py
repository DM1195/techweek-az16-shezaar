import csv
import json
import re
import os
from urllib.parse import quote
import sys
import time
from dataclasses import dataclass, asdict
from typing import List, Optional, Tuple

import requests
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError


CALENDAR_URL = "https://www.tech-week.com/calendar/sf"
# Tunables for scrolling/loading; can be overridden via CLI
SCROLL_MAX_CYCLES = 120
STABLE_ROUNDS_TARGET = 3
SCROLL_DELAY = 0.5
LOAD_MORE_DELAY = 1.0
DWELL_EVERY = 0  # every N cycles, add an extra dwell; 0 disables
DWELL_SECONDS = 0.0
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
    event_description: str
    hosted_by: str
    price: str
    event_url: str


def _clean_text(text: Optional[str]) -> str:
    if not text:
        return ""
    # Collapse whitespace and strip
    return re.sub(r"\s+", " ", text).strip()


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


def scrape_events() -> List[Event]:
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
            # Click load-more if available
            try:
                load_more = page.query_selector('[fs-list-element="load-more" i], [data-fs-list-element="load-more" i]')
                if load_more and load_more.is_visible():
                    load_more.click()
                    time.sleep(LOAD_MORE_DELAY)
            except Exception:
                pass

            # Trigger lazy loading by scrolling
            try:
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
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

            # Consider loaded if stable for a few rounds
            if stable_rounds >= STABLE_ROUNDS_TARGET:
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

            events.append(
                Event(
                    event_name=_clean_text(name),
                    event_date=_clean_text(date),
                    event_time=_clean_text(time_str),
                    event_location=_clean_text(location),
                    event_description=_clean_text(desc),
                    hosted_by=_clean_text(host),
                    price=_clean_text(price),
                    event_url=url,
                )
            )

        browser.close()
    return events


def write_csv(events: List[Event], out_path: str) -> None:
    fieldnames = [
        "event_name",
        "event_date",
        "event_time",
        "event_location",
        "event_description",
        "hosted_by",
        "price",
        "event_url",
    ]
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for e in events:
            writer.writerow(asdict(e))

def to_json(events: List[Event]) -> str:
    return json.dumps([asdict(e) for e in events], ensure_ascii=False)


def upsert_supabase_events(
    events: List[Event],
    supabase_url: str,
    supabase_key: str,
    table: str = "events",
    on_conflict: Optional[str] = "event_url",
    batch_size: int = 200,
    date_year: Optional[int] = None,
    price_numeric: bool = False,
    coerce_time: bool = False,
    no_nulls: bool = False,
    composite_key_col: Optional[str] = None,
) -> int:
    """Upsert events into Supabase via PostgREST.

    Requires a unique constraint on `on_conflict` column. Uses service role key or anon key
    with appropriate insert/update policies. Returns number of upserted rows reported by Supabase.
    """
    if not events:
        return 0
    base = supabase_url.rstrip("/")
    # Encode table name for path segment (handles spaces/mixed case)
    table_path = quote(table, safe="")
    endpoint = f"{base}/rest/v1/{table_path}"
    if on_conflict:
        endpoint += f"?on_conflict={on_conflict}"
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
        # If on_conflict is set, enable upsert. Always request representation to count rows.
        "Prefer": ("resolution=merge-duplicates," if on_conflict else "") + "return=representation",
    }

    total = 0
    payloads = [asdict(e) for e in events]
    if date_year or price_numeric or coerce_time or no_nulls:
        mon_map = {"Jan":1,"Feb":2,"Mar":3,"Apr":4,"May":5,"Jun":6,
                   "Jul":7,"Aug":8,"Sep":9,"Oct":10,"Nov":11,"Dec":12}
        for p in payloads:
            if date_year:
                d = (p.get("event_date") or "").strip()
                parts = d.split()
                # Expected like: Fri Oct 10
                if len(parts) >= 3:
                    mon = mon_map.get(parts[1][:3])
                    try:
                        dom = int(parts[2])
                    except Exception:
                        dom = None
                    if mon and dom:
                        p["event_date"] = f"{date_year:04d}-{mon:02d}-{dom:02d}"
            if price_numeric:
                val = (p.get("price") or "").strip()
                low = None
                if not val:
                    low = None
                else:
                    s = val.lower()
                    if "free" in s:
                        low = 0
                    else:
                        import re as _re
                        m = _re.findall(r"\$\s?(\d+(?:\.\d{1,2})?)", val)
                        if m:
                            try:
                                low = float(m[0])
                            except Exception:
                                low = None
                p["price"] = low
            if coerce_time:
                t = (p.get("event_time") or "").strip()
                import re as _re
                m = _re.search(r"^(\d{1,2}):(\d{2})\s*(am|pm)$", t, flags=_re.IGNORECASE)
                if m:
                    hh = int(m.group(1)) % 12
                    if m.group(3).lower() == 'pm':
                        hh += 12
                    p["event_time"] = f"{hh:02d}:{m.group(2)}:00"
                else:
                    p["event_time"] = None
            if no_nulls:
                # Fill remaining null-ish values with safe defaults (works with typed columns when using --year/--coerce-time/--price-numeric)
                if not p.get("event_name"):
                    p["event_name"] = "Untitled Event"
                if p.get("event_date") in (None, "") and date_year:
                    # Fallback to Oct 01 of the given year if unknown
                    p["event_date"] = f"{date_year:04d}-10-01"
                if p.get("event_time") in (None, "") and coerce_time:
                    p["event_time"] = "00:00:00"
                if p.get("event_location") in (None, ""):
                    p["event_location"] = "TBA"
                if p.get("event_description") in (None, ""):
                    p["event_description"] = ""
                if p.get("hosted_by") in (None, ""):
                    p["hosted_by"] = "Unknown"
                if price_numeric and (p.get("price") in (None, "")):
                    p["price"] = 0
                if not p.get("event_url"):
                    p["event_url"] = ""
    # Add composite unique key column if requested
    if composite_key_col:
        for p in payloads:
            name = (p.get("event_name") or "").strip()
            url = (p.get("event_url") or "").strip()
            p[composite_key_col] = f"{name} | {url}" if url or name else None

    # De-duplicate payloads within this operation based on the conflict column
    conflict_key = composite_key_col or on_conflict or "event_url"
    if conflict_key:
        seen = set()
        deduped = []
        for p in payloads:
            k = p.get(conflict_key)
            if k is None:
                # keep rows without a key (they may be dropped by DB constraints)
                deduped.append(p)
                continue
            if k in seen:
                continue
            seen.add(k)
            deduped.append(p)
        payloads = deduped
    for i in range(0, len(payloads), batch_size):
        chunk = payloads[i : i + batch_size]
        resp = requests.post(endpoint, headers=headers, json=chunk, timeout=60)
        if resp.status_code >= 400:
            raise RuntimeError(f"Supabase upsert failed: {resp.status_code} {resp.text[:300]}")
        data = resp.json() if resp.content else []
        total += len(data) if isinstance(data, list) else 0
    return total


def main():
    out = "tech_week_sf_events.csv"
    emit_json = False
    to_supabase = False
    table = "events"
    on_conflict = "event_url"
    date_year = None
    price_numeric = False
    coerce_time = False
    no_nulls = False
    composite_key_col = None
    global SCROLL_MAX_CYCLES, STABLE_ROUNDS_TARGET, SCROLL_DELAY, LOAD_MORE_DELAY, DWELL_EVERY, DWELL_SECONDS
    # Simple arg parsing: allow `--json`, `--supabase`, `--table <name>`, and optional output path
    args = [a for a in sys.argv[1:] if a]
    if "--json" in args:
        emit_json = True
        args.remove("--json")
    if "--supabase" in args:
        to_supabase = True
        args.remove("--supabase")
    if "--table" in args:
        try:
            i = args.index("--table")
            table = args[i + 1]
            del args[i : i + 2]
        except Exception:
            pass
    if "--no-on-conflict" in args:
        on_conflict = None
        args.remove("--no-on-conflict")
    if "--on-conflict" in args:
        try:
            i = args.index("--on-conflict")
            on_conflict = args[i + 1]
            del args[i : i + 2]
        except Exception:
            pass
    if "--year" in args:
        try:
            i = args.index("--year")
            date_year = int(args[i + 1])
            del args[i : i + 2]
        except Exception:
            pass
    if "--price-numeric" in args:
        price_numeric = True
        args.remove("--price-numeric")
    if "--coerce-time" in args:
        coerce_time = True
        args.remove("--coerce-time")
    if "--no-null" in args or "--no-nulls" in args:
        no_nulls = True
        if "--no-null" in args:
            args.remove("--no-null")
        if "--no-nulls" in args:
            args.remove("--no-nulls")
    if "--composite-key-col" in args:
        try:
            i = args.index("--composite-key-col")
            composite_key_col = args[i + 1]
            del args[i : i + 2]
        except Exception:
            pass
    if args:
        out = args[0]
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
    if not emit_json:
        print(f"Scraping calendar: {CALENDAR_URL}")
    events = scrape_events()
    if emit_json or (out and out.lower().endswith(".json")):
        # Print JSON to stdout (serverless-friendly)
        payload = to_json(events)
        # When out endswith .json AND not emit_json, also write to file
        if out and out.lower().endswith(".json") and not emit_json:
            with open(out, "w", encoding="utf-8") as f:
                f.write(payload)
        # Emit only the JSON when --json is used
        if emit_json:
            print(payload)
        else:
            # If output file ends with .json but no --json, we already wrote file above
            # Print a short message for CLI usage
            print(f"Fetched {len(events)} events. Wrote {out}.")
    elif to_supabase:
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
        if not supabase_url or not supabase_key:
            print("Missing SUPABASE_URL or SUPABASE_*_KEY in environment.", file=sys.stderr)
            sys.exit(2)
        count = upsert_supabase_events(
            events,
            supabase_url,
            supabase_key,
            table=table,
            on_conflict=on_conflict,
            date_year=date_year,
            price_numeric=price_numeric,
            coerce_time=coerce_time,
            no_nulls=no_nulls,
            composite_key_col=composite_key_col,
        )
        print(f"Upserted {count} events to Supabase table '{table}'.")
    else:
        print(f"Fetched {len(events)} events. Writing {out} ...")
        write_csv(events, out)
        print("Done.")


if __name__ == "__main__":
    main()
