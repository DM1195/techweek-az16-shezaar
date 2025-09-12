#!/usr/bin/env python3
"""
Script to find and remove duplicates from the SF Tech Week events CSV file.
Supports multiple duplicate detection strategies.
"""

import pandas as pd
import argparse
from typing import List, Tuple
import sys

def load_csv(file_path: str) -> pd.DataFrame:
    """Load the CSV file into a pandas DataFrame."""
    try:
        df = pd.read_csv(file_path)
        print(f"Loaded {len(df)} events from {file_path}")
        return df
    exceagspt Exception as e:
        print(f"Error loading CSV file: {e}")
        sys.exit(1)

def find_duplicates_by_name(df: pd.DataFrame) -> List[Tuple[int, int]]:
    """Find duplicates based on event name (case-insensitive)."""
    duplicates = []
    seen_names = {}
    
    for idx, row in df.iterrows():
        name = str(row['event_name']).strip().lower()
        if name in seen_names:
            duplicates.append((seen_names[name], idx))
        else:
            seen_names[name] = idx
    
    return duplicates

def find_duplicates_by_url(df: pd.DataFrame) -> List[Tuple[int, int]]:
    """Find duplicates based on event URL."""
    duplicates = []
    seen_urls = {}
    
    for idx, row in df.iterrows():
        url = str(row['event_url']).strip()
        if url and url != 'nan' and url in seen_urls:
            duplicates.append((seen_urls[url], idx))
        else:
            if url and url != 'nan':
                seen_urls[url] = idx
    
    return duplicates

def find_duplicates_by_name_and_date(df: pd.DataFrame) -> List[Tuple[int, int]]:
    """Find duplicates based on event name and date combination."""
    duplicates = []
    seen_combinations = {}
    
    for idx, row in df.iterrows():
        name = str(row['event_name']).strip().lower()
        date = str(row['event_date']).strip()
        key = f"{name}|{date}"
        
        if key in seen_combinations:
            duplicates.append((seen_combinations[key], idx))
        else:
            seen_combinations[key] = idx
    
    return duplicates

def find_duplicates_by_name_and_location(df: pd.DataFrame) -> List[Tuple[int, int]]:
    """Find duplicates based on event name and location combination."""
    duplicates = []
    seen_combinations = {}
    
    for idx, row in df.iterrows():
        name = str(row['event_name']).strip().lower()
        location = str(row['event_location']).strip().lower()
        key = f"{name}|{location}"
        
        if key in seen_combinations:
            duplicates.append((seen_combinations[key], idx))
        else:
            seen_combinations[key] = idx
    
    return duplicates

def find_duplicates_by_name_and_link(df: pd.DataFrame) -> List[Tuple[int, int]]:
    """Find duplicates based on event_name_and_link column."""
    duplicates = []
    seen_links = {}
    
    for idx, row in df.iterrows():
        name_and_link = str(row['event_name_and_link']).strip()
        if name_and_link and name_and_link != 'nan':
            if name_and_link in seen_links:
                duplicates.append((seen_links[name_and_link], idx))
            else:
                seen_links[name_and_link] = idx
    
    return duplicates

def remove_duplicates(df: pd.DataFrame, duplicate_indices: List[Tuple[int, int]], keep: str = 'first') -> pd.DataFrame:
    """Remove duplicates from the DataFrame."""
    if not duplicate_indices:
        print("No duplicates found.")
        return df
    
    # Get all duplicate indices to remove
    indices_to_remove = set()
    for original_idx, duplicate_idx in duplicate_indices:
        if keep == 'first':
            indices_to_remove.add(duplicate_idx)
        elif keep == 'last':
            indices_to_remove.add(original_idx)
        else:  # keep='first' by default
            indices_to_remove.add(duplicate_idx)
    
    print(f"Found {len(duplicate_indices)} duplicate pairs")
    print(f"Removing {len(indices_to_remove)} duplicate entries")
    
    # Remove duplicates
    df_cleaned = df.drop(index=list(indices_to_remove)).reset_index(drop=True)
    
    return df_cleaned

def print_duplicate_details(df: pd.DataFrame, duplicate_indices: List[Tuple[int, int]]):
    """Print details about found duplicates."""
    if not duplicate_indices:
        print("No duplicates found.")
        return
    
    print(f"\nFound {len(duplicate_indices)} duplicate pairs:")
    print("=" * 80)
    
    for i, (original_idx, duplicate_idx) in enumerate(duplicate_indices, 1):
        print(f"\nDuplicate Pair {i}:")
        print(f"Original (Row {original_idx + 1}):")
        print(f"  Name: {df.iloc[original_idx]['event_name']}")
        print(f"  Date: {df.iloc[original_idx]['event_date']}")
        print(f"  Location: {df.iloc[original_idx]['event_location']}")
        print(f"  URL: {df.iloc[original_idx]['event_url']}")
        
        print(f"Duplicate (Row {duplicate_idx + 1}):")
        print(f"  Name: {df.iloc[duplicate_idx]['event_name']}")
        print(f"  Date: {df.iloc[duplicate_idx]['event_date']}")
        print(f"  Location: {df.iloc[duplicate_idx]['event_location']}")
        print(f"  URL: {df.iloc[duplicate_idx]['event_url']}")
        print("-" * 40)

def main():
    parser = argparse.ArgumentParser(description='Find and remove duplicates from SF Tech Week events CSV')
    parser.add_argument('--file', '-f', default='data/sf_tech_week_events.csv', 
                       help='Path to the CSV file')
    parser.add_argument('--method', '-m', 
                       choices=['name', 'url', 'name_date', 'name_location', 'name_and_link', 'all'],
                       default='name_and_link',
                       help='Duplicate detection method')
    parser.add_argument('--keep', '-k',
                       choices=['first', 'last'],
                       default='first',
                       help='Which duplicate to keep (first or last occurrence)')
    parser.add_argument('--dry-run', '-d', action='store_true',
                       help='Show duplicates without removing them')
    parser.add_argument('--output', '-o',
                       help='Output file path (default: overwrite input file)')
    
    args = parser.parse_args()
    
    # Load the CSV file
    df = load_csv(args.file)
    
    # Find duplicates based on selected method
    all_duplicates = []
    
    if args.method in ['name', 'all']:
        name_duplicates = find_duplicates_by_name(df)
        if name_duplicates:
            print(f"Found {len(name_duplicates)} duplicates by name")
            all_duplicates.extend(name_duplicates)
    
    if args.method in ['url', 'all']:
        url_duplicates = find_duplicates_by_url(df)
        if url_duplicates:
            print(f"Found {len(url_duplicates)} duplicates by URL")
            all_duplicates.extend(url_duplicates)
    
    if args.method in ['name_date', 'all']:
        name_date_duplicates = find_duplicates_by_name_and_date(df)
        if name_date_duplicates:
            print(f"Found {len(name_date_duplicates)} duplicates by name+date")
            all_duplicates.extend(name_date_duplicates)
    
    if args.method in ['name_location', 'all']:
        name_location_duplicates = find_duplicates_by_name_and_location(df)
        if name_location_duplicates:
            print(f"Found {len(name_location_duplicates)} duplicates by name+location")
            all_duplicates.extend(name_location_duplicates)
    
    if args.method in ['name_and_link', 'all']:
        name_and_link_duplicates = find_duplicates_by_name_and_link(df)
        if name_and_link_duplicates:
            print(f"Found {len(name_and_link_duplicates)} duplicates by name_and_link")
            all_duplicates.extend(name_and_link_duplicates)
    
    # Remove duplicate pairs (keep only unique pairs)
    unique_duplicates = list(set(all_duplicates))
    
    if not unique_duplicates:
        print("No duplicates found!")
        return
    
    # Print duplicate details
    print_duplicate_details(df, unique_duplicates)
    
    if args.dry_run:
        print(f"\nDry run complete. Found {len(unique_duplicates)} duplicate pairs.")
        print("Run without --dry-run to actually remove duplicates.")
        return
    
    # Remove duplicates
    df_cleaned = remove_duplicates(df, unique_duplicates, args.keep)
    
    # Save the cleaned data
    output_file = args.output if args.output else args.file
    df_cleaned.to_csv(output_file, index=False)
    
    print(f"\nCleaned data saved to {output_file}")
    print(f"Original: {len(df)} events")
    print(f"Cleaned: {len(df_cleaned)} events")
    print(f"Removed: {len(df) - len(df_cleaned)} duplicate events")

if __name__ == "__main__":
    main()
