// Centralized Tag Configuration for SF Tech Week Event Recommendations
// This file contains all tag definitions, weights, and relationships in one place

// Usage Tags Configuration
const USAGE_TAGS = {
  // Primary Goals (High Priority) - 100 points each
  'find-cofounder': { 
    category: 'primary', 
    weight: 100, 
    description: 'Co-founder matching, partnerships, collaboration',
    keywords: ['co-founder', 'cofounder', 'co founder', 'founder', 'partnership', 'collaboration', 'matchmaking', 'matching']
  },
  'find-investors': { 
    category: 'primary', 
    weight: 100, 
    description: 'VC meetings, funding opportunities, pitch events',
    keywords: ['investor', 'vc', 'funding', 'capital', 'investment', 'venture', 'pitch', 'demo day']
  },
  'find-angels': { 
    category: 'primary', 
    weight: 100, 
    description: 'Angel investor networking, early-stage funding',
    keywords: ['angel', 'angel investor', 'early stage', 'seed', 'pre-seed']
  },
  'find-talent': { 
    category: 'primary', 
    weight: 100, 
    description: 'Hiring, recruitment, team building',
    keywords: ['hiring', 'talent', 'engineer', 'developer', 'recruit', 'job', 'career', 'team']
  },
  'find-customers': { 
    category: 'primary', 
    weight: 100, 
    description: 'Customer acquisition, sales, business development',
    keywords: ['customer', 'user', 'client', 'sales', 'business development', 'acquisition']
  },
  
  // Secondary Goals (Medium Priority) - 75 points each
  'find-advisors': { 
    category: 'secondary', 
    weight: 75, 
    description: 'Mentorship, advisory board, guidance',
    keywords: ['advisor', 'mentor', 'guidance', 'advisory', 'mentorship']
  },
  'find-partners': { 
    category: 'secondary', 
    weight: 75, 
    description: 'Business partnerships, strategic alliances',
    keywords: ['partner', 'partnership', 'alliance', 'strategic', 'business partner']
  },
  'get-feedback': { 
    category: 'secondary', 
    weight: 75, 
    description: 'Product validation, user research, testing',
    keywords: ['feedback', 'validation', 'test', 'user research', 'beta', 'prototype']
  },
  'learn-skills': { 
    category: 'secondary', 
    weight: 75, 
    description: 'Skill development, workshops, training',
    keywords: ['learn', 'learning', 'skill', 'workshop', 'training', 'education', 'bootcamp']
  },
  'industry-insights': { 
    category: 'secondary', 
    weight: 75, 
    description: 'Market trends, industry knowledge',
    keywords: ['insight', 'trend', 'industry', 'market', 'analysis', 'research']
  },
  'networking': { 
    category: 'secondary', 
    weight: 75, 
    description: 'Professional relationships, community building',
    keywords: ['networking', 'network', 'connect', 'meet', 'community', 'social']
  },
  
  // Specialized Goals (Context-Specific) - 80 points each
  'pitch-opportunities': { 
    category: 'specialized', 
    weight: 80, 
    description: 'Demo days, pitch nights, showcases',
    keywords: ['pitch', 'demo day', 'presentation', 'showcase', 'demo', 'pitching', 'present']
  },
  'fundraising': { 
    category: 'specialized', 
    weight: 80, 
    description: 'Fundraising events, investor relations',
    keywords: ['fundraising', 'fundraise', 'raise', 'investment round', 'series']
  },
  'product-launch': { 
    category: 'specialized', 
    weight: 80, 
    description: 'Product launches, announcements, PR',
    keywords: ['launch', 'announcement', 'release', 'unveil', 'introduce']
  },
  'women-specific': { 
    category: 'specialized', 
    weight: 80, 
    description: 'Women-focused events, diversity initiatives',
    keywords: ['women', 'female', 'ladies', 'diversity', 'inclusion', 'women in tech']
  }
};

// Industry Tags Configuration
const INDUSTRY_TAGS = {
  // Core Tech Industries - 25 points each
  'ai-ml': { 
    category: 'core-tech', 
    weight: 25, 
    description: 'Artificial Intelligence, Machine Learning, Deep Learning',
    keywords: ['ai', 'artificial intelligence', 'machine learning', 'ml', 'deep learning', 'neural network']
  },
  'fintech': { 
    category: 'core-tech', 
    weight: 25, 
    description: 'Financial Technology, payments, banking, crypto',
    keywords: ['fintech', 'financial technology', 'payments', 'banking', 'crypto', 'cryptocurrency']
  },
  'healthtech': { 
    category: 'core-tech', 
    weight: 25, 
    description: 'Health technology, medical devices, digital health',
    keywords: ['healthtech', 'health tech', 'medical', 'healthcare', 'digital health', 'medtech']
  },
  'edtech': { 
    category: 'core-tech', 
    weight: 25, 
    description: 'Education technology, learning platforms, training',
    keywords: ['edtech', 'education tech', 'learning', 'education', 'training', 'e-learning']
  },
  'cybersecurity': { 
    category: 'core-tech', 
    weight: 25, 
    description: 'Security, privacy, data protection, compliance',
    keywords: ['cybersecurity', 'security', 'privacy', 'data protection', 'compliance', 'infosec']
  },
  
  // Emerging Technologies - 30 points each
  'blockchain': { 
    category: 'emerging', 
    weight: 30, 
    description: 'Web3, crypto, DeFi, NFT, smart contracts',
    keywords: ['blockchain', 'web3', 'defi', 'nft', 'smart contract', 'cryptocurrency']
  },
  'sustainability': { 
    category: 'emerging', 
    weight: 30, 
    description: 'Climate tech, green tech, clean energy',
    keywords: ['sustainability', 'climate tech', 'green tech', 'clean energy', 'environmental']
  },
  'biotech': { 
    category: 'emerging', 
    weight: 30, 
    description: 'Biotechnology, life sciences, pharmaceuticals',
    keywords: ['biotech', 'biotechnology', 'life sciences', 'pharmaceutical', 'medical device']
  },
  'quantum': { 
    category: 'emerging', 
    weight: 30, 
    description: 'Quantum computing, quantum technologies',
    keywords: ['quantum', 'quantum computing', 'quantum tech', 'quantum technology']
  },
  
  // Business Sectors - 20 points each
  'enterprise': { 
    category: 'business', 
    weight: 20, 
    description: 'B2B software, enterprise solutions, SaaS',
    keywords: ['enterprise', 'b2b', 'saas', 'business software', 'corporate']
  },
  'consumer': { 
    category: 'business', 
    weight: 20, 
    description: 'B2C products, consumer apps, consumer tech',
    keywords: ['consumer', 'b2c', 'consumer tech', 'consumer app', 'consumer product']
  },
  'startup': { 
    category: 'business', 
    weight: 20, 
    description: 'Entrepreneurship, venture capital, startup ecosystem',
    keywords: ['startup', 'entrepreneurship', 'venture capital', 'founder', 'entrepreneur']
  },
  'media': { 
    category: 'business', 
    weight: 20, 
    description: 'Content creation, media, marketing, advertising',
    keywords: ['media', 'content', 'marketing', 'advertising', 'social media', 'content creation']
  },
  'gaming': { 
    category: 'business', 
    weight: 20, 
    description: 'Gaming, esports, interactive entertainment',
    keywords: ['gaming', 'esports', 'game', 'interactive entertainment', 'video game']
  },
  
  // Vertical Industries - 15 points each
  'mobility': { 
    category: 'vertical', 
    weight: 15, 
    description: 'Transportation, automotive, logistics, delivery',
    keywords: ['mobility', 'transportation', 'automotive', 'logistics', 'delivery', 'transport']
  },
  'real-estate': { 
    category: 'vertical', 
    weight: 15, 
    description: 'PropTech, real estate, construction tech',
    keywords: ['real estate', 'proptech', 'property', 'construction', 'real estate tech']
  },
  'legal': { 
    category: 'vertical', 
    weight: 15, 
    description: 'Legal tech, compliance, regulatory technology',
    keywords: ['legal', 'legal tech', 'law', 'compliance', 'regulatory', 'legal technology']
  },
  'hr': { 
    category: 'vertical', 
    weight: 15, 
    description: 'Human resources, talent management, people ops',
    keywords: ['hr', 'human resources', 'talent', 'recruiting', 'people ops', 'talent management']
  },
  'sales': { 
    category: 'vertical', 
    weight: 15, 
    description: 'Sales technology, CRM, revenue operations',
    keywords: ['sales', 'crm', 'revenue operations', 'sales tech', 'sales technology']
  },
  'marketing': { 
    category: 'vertical', 
    weight: 15, 
    description: 'Marketing tech, growth, customer acquisition',
    keywords: ['marketing', 'marketing tech', 'growth', 'customer acquisition', 'advertising']
  },
  
  // Specialized Sectors - 35 points each
  'fashion-tech': { 
    category: 'specialized', 
    weight: 35, 
    description: 'Fashion technology, retail tech, e-commerce',
    keywords: ['fashion', 'fashion tech', 'retail', 'e-commerce', 'style', 'apparel', 'clothing']
  },
  'food-tech': { 
    category: 'specialized', 
    weight: 35, 
    description: 'Food technology, agtech, food delivery',
    keywords: ['food tech', 'agtech', 'food delivery', 'agriculture', 'food technology']
  },
  'space': { 
    category: 'specialized', 
    weight: 35, 
    description: 'Space technology, aerospace, satellite tech',
    keywords: ['space', 'aerospace', 'satellite', 'space tech', 'space technology']
  },
  'robotics': { 
    category: 'specialized', 
    weight: 35, 
    description: 'Robotics, automation, industrial tech',
    keywords: ['robotics', 'automation', 'industrial tech', 'robot', 'automated']
  }
};

// Tag Relationships and Complementary Tags
const TAG_RELATIONSHIPS = {
  // Usage tag relationships
  'find-cofounder': ['find-partners', 'networking', 'pitch-opportunities'],
  'find-investors': ['find-angels', 'fundraising', 'pitch-opportunities'],
  'find-talent': ['networking', 'find-advisors'],
  'find-customers': ['networking', 'get-feedback', 'product-launch'],
  'pitch-opportunities': ['find-investors', 'find-angels', 'fundraising'],
  'fundraising': ['find-investors', 'find-angels', 'pitch-opportunities'],
  'networking': ['find-cofounder', 'find-partners', 'find-advisors'],
  
  // Industry tag relationships
  'ai-ml': ['fintech', 'healthtech', 'cybersecurity', 'robotics'],
  'blockchain': ['fintech', 'sustainability'],
  'healthtech': ['biotech', 'ai-ml'],
  'fashion-tech': ['consumer', 'media', 'marketing'],
  'fintech': ['ai-ml', 'blockchain'],
  'sustainability': ['blockchain', 'mobility', 'real-estate']
};

// Goal mapping for query analysis
const GOAL_MAPPING = {
  // Primary Goals
  'finding co-founder': 'find-cofounder',
  'finding cofounder': 'find-cofounder',
  'co-founder': 'find-cofounder',
  'cofounder': 'find-cofounder',
  'finding investors': 'find-investors',
  'investors': 'find-investors',
  'funding': 'find-investors',
  'finding angels': 'find-angels',
  'angels': 'find-angels',
  'finding talent': 'find-talent',
  'talent': 'find-talent',
  'hiring': 'find-talent',
  'recruiting': 'find-talent',
  'finding customers': 'find-customers',
  'customers': 'find-customers',
  'sales': 'find-customers',
  'business development': 'find-customers',
  
  // Secondary Goals
  'finding advisors': 'find-advisors',
  'advisors': 'find-advisors',
  'mentors': 'find-advisors',
  'mentorship': 'find-advisors',
  'finding partners': 'find-partners',
  'partners': 'find-partners',
  'partnerships': 'find-partners',
  'finding users': 'find-users',
  'users': 'find-users',
  'feedback': 'get-feedback',
  'user feedback': 'get-feedback',
  'validation': 'get-feedback',
  'testing': 'get-feedback',
  'networking': 'networking',
  'learning': 'learn-skills',
  'skills': 'learn-skills',
  'workshops': 'learn-skills',
  'training': 'learn-skills',
  'insights': 'industry-insights',
  'industry insights': 'industry-insights',
  'trends': 'industry-insights',
  
  // Specialized Goals
  'pitch': 'pitch-opportunities',
  'pitching': 'pitch-opportunities',
  'demo day': 'pitch-opportunities',
  'showcase': 'pitch-opportunities',
  'presentation': 'pitch-opportunities',
  'fundraising': 'fundraising',
  'product launch': 'product-launch',
  'launch': 'product-launch',
  'women': 'women-specific',
  'female': 'women-specific',
  'diversity': 'women-specific'
};

// Industry mapping for query analysis
const INDUSTRY_MAPPING = {
  // Core Tech Industries
  'ai': ['ai-ml'],
  'artificial intelligence': ['ai-ml'],
  'machine learning': ['ai-ml'],
  'ml': ['ai-ml'],
  'fintech': ['fintech'],
  'financial technology': ['fintech'],
  'payments': ['fintech'],
  'banking': ['fintech'],
  'crypto': ['fintech', 'blockchain'],
  'healthtech': ['healthtech'],
  'health tech': ['healthtech'],
  'medical': ['healthtech'],
  'healthcare': ['healthtech'],
  'edtech': ['edtech'],
  'education tech': ['edtech'],
  'learning': ['edtech'],
  'cybersecurity': ['cybersecurity'],
  'security': ['cybersecurity'],
  'privacy': ['cybersecurity'],
  
  // Emerging Technologies
  'blockchain': ['blockchain'],
  'web3': ['blockchain'],
  'defi': ['blockchain'],
  'nft': ['blockchain'],
  'sustainability': ['sustainability'],
  'climate tech': ['sustainability'],
  'green tech': ['sustainability'],
  'clean energy': ['sustainability'],
  'biotech': ['biotech'],
  'biotechnology': ['biotech'],
  'life sciences': ['biotech'],
  'quantum': ['quantum'],
  'quantum computing': ['quantum'],
  
  // Business Sectors
  'enterprise': ['enterprise'],
  'b2b': ['enterprise'],
  'saas': ['enterprise'],
  'consumer': ['consumer'],
  'b2c': ['consumer'],
  'startup': ['startup'],
  'entrepreneurship': ['startup'],
  'media': ['media'],
  'content': ['media'],
  'marketing': ['marketing'],
  'advertising': ['marketing'],
  'gaming': ['gaming'],
  'esports': ['gaming'],
  
  // Vertical Industries
  'mobility': ['mobility'],
  'transportation': ['mobility'],
  'automotive': ['mobility'],
  'logistics': ['mobility'],
  'real estate': ['real-estate'],
  'proptech': ['real-estate'],
  'legal': ['legal'],
  'legal tech': ['legal'],
  'hr': ['hr'],
  'human resources': ['hr'],
  'talent': ['hr'],
  'recruiting': ['hr'],
  'sales': ['sales'],
  'crm': ['sales'],
  
  // Specialized Sectors
  'fashion': ['fashion-tech'],
  'fashion tech': ['fashion-tech'],
  'retail': ['fashion-tech'],
  'e-commerce': ['fashion-tech'],
  'food tech': ['food-tech'],
  'agtech': ['food-tech'],
  'space': ['space'],
  'aerospace': ['space'],
  'robotics': ['robotics'],
  'automation': ['robotics']
};

// Helper functions
function getUsageTagWeight(tag) {
  return USAGE_TAGS[tag]?.weight || 50;
}

function getIndustryTagWeight(tag) {
  return INDUSTRY_TAGS[tag]?.weight || 10;
}

function getUsageTagCategory(tag) {
  return USAGE_TAGS[tag]?.category || 'unknown';
}

function getIndustryTagCategory(tag) {
  return INDUSTRY_TAGS[tag]?.category || 'unknown';
}

function getRelatedTags(tag, tagType = 'usage') {
  const relationships = TAG_RELATIONSHIPS[tag] || [];
  const validTags = tagType === 'usage' ? USAGE_TAGS : INDUSTRY_TAGS;
  return relationships.filter(relatedTag => validTags[relatedTag]);
}

function getAllUsageTags() {
  return Object.keys(USAGE_TAGS);
}

function getAllIndustryTags() {
  return Object.keys(INDUSTRY_TAGS);
}

function getUsageTagsByCategory(category) {
  return Object.keys(USAGE_TAGS).filter(tag => USAGE_TAGS[tag].category === category);
}

function getIndustryTagsByCategory(category) {
  return Object.keys(INDUSTRY_TAGS).filter(tag => INDUSTRY_TAGS[tag].category === category);
}

// Export everything
module.exports = {
  // Tag configurations
  USAGE_TAGS,
  INDUSTRY_TAGS,
  
  // Relationships and mappings
  TAG_RELATIONSHIPS,
  GOAL_MAPPING,
  INDUSTRY_MAPPING,
  
  // Helper functions
  getUsageTagWeight,
  getIndustryTagWeight,
  getUsageTagCategory,
  getIndustryTagCategory,
  getRelatedTags,
  getAllUsageTags,
  getAllIndustryTags,
  getUsageTagsByCategory,
  getIndustryTagsByCategory
};
