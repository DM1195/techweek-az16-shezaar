# Centralized Tag Configuration System

## Overview

We have successfully centralized all tag definitions, weights, and mappings into a single configuration file (`api/tag-config.js`) to eliminate hardcoding and improve maintainability across the entire SF Tech Week event recommendation system.

## Benefits of Centralization

### 1. **Single Source of Truth**
- All tag definitions, weights, and relationships in one place
- No more duplicate or inconsistent tag definitions across files
- Easy to update tags system-wide with a single change

### 2. **Better Maintainability**
- Add new tags by updating only one file
- Modify tag weights or descriptions in one location
- Consistent tag validation across all components

### 3. **Reduced Code Duplication**
- Eliminated hardcoded tag lists in multiple files
- Shared mapping functions and helper utilities
- Consistent tag handling across APIs and scrapers

### 4. **Improved Scalability**
- Easy to add new tag categories or relationships
- Centralized validation and scoring logic
- Better testing and debugging capabilities

## File Structure

### Core Configuration File
- **`api/tag-config.js`** - Central configuration with all tag definitions, weights, mappings, and helper functions

### Updated Files Using Centralized Config
- **`api/recommend-events.js`** - Main recommendation API
- **`api/tag-validation.js`** - Tag validation system
- **`scraper/scrape_tech_week_sf.py`** - Event scraper (Python)

## Configuration Contents

### 1. Tag Definitions
```javascript
// Usage Tags (15 categories)
const USAGE_TAGS = {
  'find-cofounder': { 
    category: 'primary', 
    weight: 100, 
    description: 'Co-founder matching, partnerships, collaboration',
    keywords: ['co-founder', 'cofounder', 'partnership', 'collaboration']
  },
  // ... more tags
};

// Industry Tags (24 categories)
const INDUSTRY_TAGS = {
  'ai-ml': { 
    category: 'core-tech', 
    weight: 25, 
    description: 'Artificial Intelligence, Machine Learning, Deep Learning',
    keywords: ['ai', 'artificial intelligence', 'machine learning', 'ml']
  },
  // ... more tags
};
```

### 2. Mapping Systems
```javascript
// Goal mapping for query analysis
const GOAL_MAPPING = {
  'hiring': 'find-talent',
  'recruiting': 'find-talent',
  'co-founder': 'find-cofounder',
  // ... 49 total mappings
};

// Industry mapping for query analysis
const INDUSTRY_MAPPING = {
  'ai': ['ai-ml'],
  'artificial intelligence': ['ai-ml'],
  'fashion': ['fashion-tech'],
  // ... 69 total mappings
};
```

### 3. Helper Functions
```javascript
// Weight functions
getUsageTagWeight(tag)     // Returns weight for usage tag
getIndustryTagWeight(tag)  // Returns weight for industry tag

// Category functions
getUsageTagCategory(tag)     // Returns category for usage tag
getIndustryTagCategory(tag)  // Returns category for industry tag

// Utility functions
getAllUsageTags()           // Returns all usage tag names
getAllIndustryTags()        // Returns all industry tag names
getRelatedTags(tag, type)   // Returns related tags
```

## Usage Examples

### In Recommendation API
```javascript
const { USAGE_TAGS, INDUSTRY_TAGS, GOAL_MAPPING, getUsageTagWeight } = require('./tag-config');

// Use centralized mappings
const goalMapping = GOAL_MAPPING;

// Use centralized weights
const weight = getUsageTagWeight('find-cofounder'); // Returns 100
```

### In Tag Validation
```javascript
const { USAGE_TAGS, INDUSTRY_TAGS, TAG_RELATIONSHIPS } = require('./tag-config');

// Use centralized tag definitions
const validUsageTags = USAGE_TAGS;
const validIndustryTags = INDUSTRY_TAGS;
```

### In Python Scraper
```python
# Import centralized configuration
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'api'))
from tag_config import USAGE_TAGS, INDUSTRY_TAGS

# Use centralized tag validation
valid_usage_tags = set(USAGE_TAGS.keys())
valid_industry_tags = set(INDUSTRY_TAGS.keys())
```

## Tag Categories

### Usage Tags (15 total)
- **Primary Goals (5)**: find-cofounder, find-investors, find-angels, find-talent, find-customers
- **Secondary Goals (6)**: find-advisors, find-partners, get-feedback, learn-skills, industry-insights, networking
- **Specialized Goals (4)**: pitch-opportunities, fundraising, product-launch, women-specific

### Industry Tags (24 total)
- **Core Tech (5)**: ai-ml, fintech, healthtech, edtech, cybersecurity
- **Emerging (4)**: blockchain, sustainability, biotech, quantum
- **Business (5)**: enterprise, consumer, startup, media, gaming
- **Vertical (6)**: mobility, real-estate, legal, hr, sales, marketing
- **Specialized (4)**: fashion-tech, food-tech, space, robotics

## Migration Benefits

### Before Centralization
- Tag definitions scattered across multiple files
- Hardcoded weights and mappings in each component
- Risk of inconsistencies and duplicate maintenance
- Difficult to add new tags or modify existing ones

### After Centralization
- Single source of truth for all tag-related data
- Consistent behavior across all components
- Easy to maintain and extend
- Better testing and validation capabilities

## Future Enhancements

### Easy to Add
- New tag categories or subcategories
- Additional mapping rules or synonyms
- New validation rules or constraints
- Tag analytics and usage tracking

### Easy to Modify
- Tag weights based on performance data
- Description updates for better AI understanding
- Relationship mappings for better suggestions
- Validation rules for data quality

## Testing

The centralized configuration has been thoroughly tested:
- ✅ All tag configurations load correctly
- ✅ Weight functions return expected values
- ✅ Goal and industry mappings work properly
- ✅ Tag categories are properly organized
- ✅ No linting errors in any files

## Conclusion

The centralized tag configuration system provides a robust, maintainable foundation for the SF Tech Week event recommendation system. All components now use the same tag definitions, ensuring consistency and making future updates much easier to implement.

The system is production-ready and can be easily extended as new requirements emerge.
