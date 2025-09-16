// Centralized Tag Configuration for SF Tech Week Event Recommendations
// This file contains all tag definitions, weights, and relationships in one place

// Usage Tags Configuration - Based on actual CSV data
const USAGE_TAGS = {
  // Primary Goals (High Priority) - 100 points each
  'meeting-founders': { 
    category: 'primary', 
    weight: 100, 
    description: 'Meeting founders and entrepreneurs',
    keywords: ['meeting founders', 'founders', 'entrepreneurs', 'co-founder', 'cofounder', 'startup founders']
  },
  'meeting-investors': { 
    category: 'primary', 
    weight: 100, 
    description: 'Meeting investors and VCs',
    keywords: ['meeting investors', 'investors', 'vc', 'venture capital', 'funding', 'angel investors']
  },
  'connecting-investors': { 
    category: 'primary', 
    weight: 100, 
    description: 'Connecting with investors',
    keywords: ['connecting investors', 'investor networking', 'vc networking', 'funding', 'investment']
  },
  
  // Secondary Goals (Medium Priority) - 75 points each
  'meeting-people': { 
    category: 'secondary', 
    weight: 75, 
    description: 'General networking and meeting people',
    keywords: ['meeting people', 'networking', 'connect', 'meet', 'social', 'community']
  },
  'networking': { 
    category: 'secondary', 
    weight: 75, 
    description: 'Professional relationships, community building',
    keywords: ['networking', 'network', 'connect', 'meet', 'community', 'social']
  },
  'networking-opportunities': { 
    category: 'secondary', 
    weight: 75, 
    description: 'Networking opportunities',
    keywords: ['networking opportunities', 'networking', 'connect', 'meet', 'social']
  },
  'business-collaboration': { 
    category: 'secondary', 
    weight: 75, 
    description: 'Business partnerships and collaboration',
    keywords: ['business collaboration', 'partnership', 'collaboration', 'business partner', 'alliance']
  },
  'collaboration': { 
    category: 'secondary', 
    weight: 75, 
    description: 'Collaboration and teamwork',
    keywords: ['collaboration', 'teamwork', 'partnership', 'working together']
  },
  'learning-industry-insights': { 
    category: 'secondary', 
    weight: 75, 
    description: 'Learning industry insights and trends',
    keywords: ['learning industry insights', 'insights', 'trends', 'industry knowledge', 'market trends']
  },
  'learning': { 
    category: 'secondary', 
    weight: 75, 
    description: 'Learning and education',
    keywords: ['learning', 'education', 'knowledge', 'skills', 'development']
  },
  'learning-skills': { 
    category: 'secondary', 
    weight: 75, 
    description: 'Learning new skills',
    keywords: ['learning skills', 'skills', 'development', 'training', 'education']
  },
  'professional-development': { 
    category: 'secondary', 
    weight: 75, 
    description: 'Professional development and growth',
    keywords: ['professional development', 'career growth', 'skills', 'learning', 'development']
  },
  'industry-engagement': { 
    category: 'secondary', 
    weight: 75, 
    description: 'Industry engagement and participation',
    keywords: ['industry engagement', 'industry participation', 'sector involvement', 'industry events']
  },
  'business-activities': { 
    category: 'secondary', 
    weight: 75, 
    description: 'Business activities and operations',
    keywords: ['business activities', 'business', 'operations', 'business development']
  },
  
  // Specialized Goals (Context-Specific) - 80 points each
  'business-pitching': { 
    category: 'specialized', 
    weight: 80, 
    description: 'Pitch opportunities and presentations',
    keywords: ['business pitching', 'pitch', 'presentation', 'demo', 'showcase', 'pitch night']
  },
  'product-demos': { 
    category: 'specialized', 
    weight: 80, 
    description: 'Product demonstrations and showcases',
    keywords: ['product demos', 'demo', 'showcase', 'product launch', 'presentation', 'demo day']
  },
  
  // Additional specialized tags
  'women-specific': { 
    category: 'specialized', 
    weight: 85, 
    description: 'Women-specific events and opportunities',
    keywords: ['women', 'female', 'diversity', 'women in tech', 'female founders', 'women entrepreneurs']
  }
};

// Industry Tags Configuration
const INDUSTRY_TAGS = {
  // General Tech Tags - 30 points each (apply to all industries)
  'ai': { 
    category: 'general-tech', 
    weight: 30, 
    description: 'Artificial Intelligence - applies to all industries',
    keywords: ['ai', 'artificial intelligence', 'machine learning', 'ml', 'deep learning', 'neural network']
  },
  'technology': { 
    category: 'general-tech', 
    weight: 30, 
    description: 'General technology - applies to all industries',
    keywords: ['technology', 'tech', 'software', 'digital', 'innovation']
  },
  'startup': { 
    category: 'general-tech', 
    weight: 30, 
    description: 'Startup ecosystem - applies to all industries',
    keywords: ['startup', 'startups', 'entrepreneurship', 'founder', 'entrepreneur']
  },
  'venture-capital': { 
    category: 'general-tech', 
    weight: 30, 
    description: 'Venture capital and funding - applies to all industries',
    keywords: ['venture capital', 'vc', 'funding', 'investment', 'capital']
  },
  'general-networking': { 
    category: 'general-tech', 
    weight: 30, 
    description: 'Networking and community - applies to all industries',
    keywords: ['networking', 'network', 'connect', 'meet', 'community']
  },
  'innovation': { 
    category: 'general-tech', 
    weight: 30, 
    description: 'Innovation and disruption - applies to all industries',
    keywords: ['innovation', 'innovative', 'disruptive', 'breakthrough']
  },
  'emerging-tech': { 
    category: 'general-tech', 
    weight: 30, 
    description: 'Emerging technologies - applies to all industries',
    keywords: ['emerging tech', 'emerging technology', 'cutting edge', 'frontier']
  },
  'b2b': { 
    category: 'general-tech', 
    weight: 30, 
    description: 'Business-to-business - applies to all industries',
    keywords: ['b2b', 'business to business', 'enterprise', 'corporate']
  },
  'b2c': { 
    category: 'general-tech', 
    weight: 30, 
    description: 'Business-to-consumer - applies to all industries',
    keywords: ['b2c', 'business to consumer', 'consumer', 'retail']
  },
  
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
  'meeting-founders': ['networking', 'business-pitching', 'business-collaboration'],
  'meeting-investors': ['business-pitching', 'networking', 'connecting-investors'],
  'connecting-investors': ['meeting-investors', 'business-pitching', 'networking'],
  'meeting-people': ['networking', 'networking-opportunities'],
  'networking': ['meeting-people', 'business-collaboration', 'meeting-founders'],
  'business-pitching': ['meeting-investors', 'product-demos', 'meeting-founders'],
  'product-demos': ['business-pitching', 'meeting-people'],
  
  // Industry tag relationships
  'ai-ml': ['fintech', 'healthtech', 'cybersecurity', 'robotics'],
  'blockchain': ['fintech', 'sustainability'],
  'healthtech': ['biotech', 'ai-ml'],
  'fashion-tech': ['consumer', 'media', 'marketing'],
  'fintech': ['ai-ml', 'blockchain'],
  'sustainability': ['blockchain', 'mobility', 'real-estate']
};

// Goal mapping for query analysis - maps user queries to actual CSV usage tags
const GOAL_MAPPING = {
  // Primary Goals - Meeting People
  'finding co-founder': 'meeting-founders',
  'finding cofounder': 'meeting-founders',
  'co-founder': 'meeting-founders',
  'cofounder': 'meeting-founders',
  'meeting founders': 'meeting-founders',
  'founders': 'meeting-founders',
  'startup founders': 'meeting-founders',
  'entrepreneurs': 'meeting-founders',
  
  'finding investors': 'meeting-investors',
  'investors': 'meeting-investors',
  'meeting investors': 'meeting-investors',
  'funding': 'meeting-investors',
  'connecting investors': 'connecting-investors',
  'connecting with investors': 'connecting-investors',
  'investor networking': 'connecting-investors',
  'vc networking': 'connecting-investors',
  'finding angels': 'meeting-investors',
  'angels': 'meeting-investors',
  'angel investors': 'meeting-investors',
  
  'finding talent': 'meeting-people',
  'talent': 'meeting-people',
  'hiring': 'meeting-people',
  'recruiting': 'meeting-people',
  'finding customers': 'meeting-people',
  'customers': 'meeting-people',
  'sales': 'meeting-people',
  'meeting people': 'meeting-people',
  'networking': 'networking',
  'networking opportunities': 'networking-opportunities',
  
  // Business Activities
  'business development': 'business-collaboration',
  'business collaboration': 'business-collaboration',
  'partnership': 'business-collaboration',
  'partnerships': 'business-collaboration',
  'collaboration': 'collaboration',
  'business activities': 'business-activities',
  
  // Learning and Development
  'learning': 'learning',
  'learning skills': 'learning-skills',
  'skills': 'learning-skills',
  'professional development': 'professional-development',
  'career development': 'professional-development',
  'industry insights': 'learning-industry-insights',
  'insights': 'learning-industry-insights',
  'trends': 'learning-industry-insights',
  'industry engagement': 'industry-engagement',
  
  // Pitching and Demos
  'pitch': 'business-pitching',
  'pitching': 'business-pitching',
  'presentation': 'business-pitching',
  'demo': 'product-demos',
  'demos': 'product-demos',
  'showcase': 'product-demos',
  'product launch': 'product-demos',
  
  // Additional mappings for common queries
  'workshops': 'learning-skills',
  'training': 'learning-skills',
  'education': 'learning',
  'women': 'women-specific',
  'female': 'women-specific',
  'diversity': 'women-specific'
};

// Industry mapping for query analysis
const INDUSTRY_MAPPING = {
  // General Tech Industries (apply to all)
  'ai': ['ai'],
  'artificial intelligence': ['ai'],
  'machine learning': ['ai'],
  'ml': ['ai'],
  'technology': ['technology'],
  'tech': ['technology'],
  'startup': ['startup'],
  'startups': ['startup'],
  'entrepreneurship': ['startup'],
  'venture capital': ['venture-capital'],
  'vc': ['venture-capital'],
  'funding': ['venture-capital'],
  'networking': ['general-networking'],
  'innovation': ['innovation'],
  'emerging tech': ['emerging-tech'],
  'emerging technology': ['emerging-tech'],
  'b2b': ['b2b'],
  'business to business': ['b2b'],
  'b2c': ['b2c'],
  'business to consumer': ['b2c'],
  
  // Core Tech Industries
  'ai-ml': ['ai-ml'],
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
