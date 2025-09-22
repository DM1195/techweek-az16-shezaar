const { getSupabaseClient } = require('./_supabase');
const { getOpenAI } = require('./_openai');
const { USAGE_TAGS, INDUSTRY_TAGS, GOAL_MAPPING, INDUSTRY_MAPPING, getUsageTagWeight, getIndustryTagWeight } = require('./tag-config');

const TABLE = process.env.EVENTS_TABLE || 'Event List';
const QUERIES_TABLE = process.env.QUERIES_TABLE || 'Query';

function sanitizeLikeValue(s) {
  if (!s || typeof s !== 'string') return '';
  return s.replace(/[(),]/g, ' ').replace(/\s+/g, ' ').trim();
}

function generateEventCategory(eventName, eventDescription, eventTags = []) {
  // Convert all text to lowercase for case-insensitive matching
  const name = (eventName || '').toLowerCase();
  const description = (eventDescription || '').toLowerCase();
  const tags = eventTags.map(tag => tag.toLowerCase());
  const allText = `${name} ${description} ${tags.join(' ')}`;
  
  // Business Casual - Networking Mixers, Happy Hours, Co-founder Matchups, Pitch Nights, Demo Days, Investor Panels, Startup Showcases
  const businessCasualKeywords = [
    'networking', 'mixer', 'happy hour', 'co-founder', 'cofounder', 'co founder',
    'founder', 'entrepreneur', 'startup', 'business', 'professional', 'meetup',
    'connect', 'collaboration', 'partnership', 'matchup', 'venture', 'funding',
    'angel', 'vc', 'investment', 'capital', 'investor', 'tech', 'ai', 'fintech',
    'wellness', 'health', 'sustainability', 'blockchain', 'web3', 'crypto',
    'pitch night', 'demo day', 'investor panel', 'startup showcase', 'presentation',
    'pitch', 'showcase', 'demo', 'equity round', 'series round', 'seed round'
  ];
  
  // Casual Creative - Community Events, Creative Collabs, Founder Therapy, Coffee Walks, AI Bootcamps, Coding Nights, Founder Work Sessions
  const casualCreativeKeywords = [
    'community', 'creative', 'collab', 'therapy', 'coffee walk', 'ai bootcamp',
    'coding night', 'work session', 'workshop', 'learning', 'education', 'skill',
    'development', 'creative', 'art', 'design', 'innovation', 'brainstorm',
    'ideation', 'hackathon', 'build', 'create', 'collaborative'
  ];
  
  // Activity - Pickleball, Hiking, Morning Yoga, Run Clubs
  const activityKeywords = [
    'pickleball', 'hiking', 'yoga', 'run club', 'running', 'fitness', 'exercise',
    'sport', 'physical', 'outdoor', 'walk', 'jog', 'workout', 'gym', 'tennis',
    'basketball', 'soccer', 'volleyball', 'cycling', 'bike', 'swimming'
  ];
  
  // Daytime Social - Brunches, Founder Lunches, Garden Parties
  const daytimeSocialKeywords = [
    'brunch', 'lunch', 'garden party', 'daytime', 'morning', 'afternoon',
    'breakfast', 'dining', 'food', 'meal', 'social', 'gathering', 'party',
    'celebration', 'festival', 'fair', 'market', 'outdoor dining'
  ];
  
  // Evening Social - Dinners, House Parties, Rooftop Hangouts, After Parties
  const eveningSocialKeywords = [
    'dinner', 'house party', 'rooftop', 'after party', 'evening', 'night',
    'party', 'social', 'hangout', 'get together', 'celebration', 'drinks',
    'cocktail', 'wine', 'beer', 'socializing', 'nightlife', 'club', 'bar'
  ];
  
  // Check for matches in order of specificity
  const checkKeywords = (keywords) => {
    return keywords.some(keyword => 
      allText.includes(keyword) || 
      name.includes(keyword) || 
      description.includes(keyword) ||
      tags.some(tag => tag.includes(keyword))
    );
  };
  
  // Return category based on keyword matches
  if (checkKeywords(businessCasualKeywords)) {
    return 'Business Casual';
  } else if (checkKeywords(casualCreativeKeywords)) {
    return 'Casual Creative';
  } else if (checkKeywords(activityKeywords)) {
    return 'Activity';
  } else if (checkKeywords(daytimeSocialKeywords)) {
    return 'Daytime Social';
  } else if (checkKeywords(eveningSocialKeywords)) {
    return 'Evening Social';
  } else {
    // Default fallback based on common patterns
    if (allText.includes('networking') || allText.includes('meet') || allText.includes('connect')) {
      return 'Business Casual';
    } else if (allText.includes('party') || allText.includes('social') || allText.includes('hangout')) {
      return 'Evening Social';
    } else if (allText.includes('workshop') || allText.includes('learn') || allText.includes('education')) {
      return 'Casual Creative';
    } else {
      return 'Business Casual'; // Default fallback
    }
  }
}

async function extractUserContext(message, openai) {
  if (!openai) {
    // Simple fallback extraction
    const keywords = message?.toLowerCase() || '';
    const context = {
      is_women_specific: keywords.includes('female') || keywords.includes('woman') || keywords.includes('women'),
      goals: [],
      industries: [],
      location: null,
      time_preferences: null,
      budget: null,
      relevance_suggestions: {
        primary_criteria: [],
        secondary_criteria: [],
        ranking_rationale: ''
      }
    };
    
    // Extract goals using actual CSV usage tags
    if (keywords.includes('hire') || keywords.includes('hiring') || keywords.includes('engineers') || keywords.includes('talent') || keywords.includes('recruit')) {
      context.goals.push('meeting-people');
      context.relevance_suggestions.primary_criteria.push('Events with talent recruitment focus');
      context.relevance_suggestions.ranking_rationale = 'Prioritize events focused on hiring, talent acquisition, and recruitment';
    }
    if (keywords.includes('investor') || keywords.includes('funding') || keywords.includes('angel') || keywords.includes('vc') || keywords.includes('venture')) {
      context.goals.push('meeting-investors', 'connecting-investors');
      context.relevance_suggestions.primary_criteria.push('Events with investor networking and funding focus');
      context.relevance_suggestions.ranking_rationale = 'Prioritize events with investor panels, pitch nights, and funding opportunities';
    }
    if (keywords.includes('co-founder') || keywords.includes('cofounder') || keywords.includes('co founder') || keywords.includes('partner') || keywords.includes('cofounder')) {
      context.goals.push('meeting-founders');
      context.relevance_suggestions.primary_criteria.push('Events with co-founder matching and startup partnerships');
      context.relevance_suggestions.ranking_rationale = 'Prioritize events specifically designed for co-founder matching and startup partnerships';
    }
    if (keywords.includes('customer') || keywords.includes('user') || keywords.includes('client') || keywords.includes('users')) {
      context.goals.push('meeting-people');
      context.relevance_suggestions.primary_criteria.push('Events with customer discovery and user research focus');
    }
    if (keywords.includes('advisor') || keywords.includes('mentor') || keywords.includes('guidance')) {
      context.goals.push('meeting-people');
      context.relevance_suggestions.primary_criteria.push('Events with mentorship and advisory opportunities');
    }
    if (keywords.includes('network') || keywords.includes('networking') || keywords.includes('connect') || keywords.includes('meet')) {
      context.goals.push('networking', 'networking-opportunities');
      context.relevance_suggestions.primary_criteria.push('Events with strong networking opportunities');
    }
    if (keywords.includes('learn') || keywords.includes('learning') || keywords.includes('skill') || keywords.includes('education')) {
      context.goals.push('learning', 'learning-skills');
      context.relevance_suggestions.primary_criteria.push('Events with educational and skill-building focus');
    }
    if (keywords.includes('feedback') || keywords.includes('validate') || keywords.includes('test')) {
      context.goals.push('meeting-people');
      context.relevance_suggestions.primary_criteria.push('Events with user feedback and validation opportunities');
    }
    if (keywords.includes('insight') || keywords.includes('industry') || keywords.includes('trend')) {
      context.goals.push('learning-industry-insights');
      context.relevance_suggestions.primary_criteria.push('Events with industry insights and trend analysis');
    }
    
    // Extract time preferences
    if (keywords.includes('evening') || keywords.includes('night') || keywords.includes('after 6') || keywords.includes('after 7') || keywords.includes('after 8')) {
      context.time_preferences = 'evening';
      context.relevance_suggestions.primary_criteria.push('Evening events');
    }
    if (keywords.includes('morning') || keywords.includes('early') || keywords.includes('breakfast') || keywords.includes('brunch')) {
      context.time_preferences = 'morning';
      context.relevance_suggestions.primary_criteria.push('Morning events');
    }
    
    // Use centralized industry mapping
    const industryMapping = INDUSTRY_MAPPING;
    
    // Apply industry mapping
    Object.keys(industryMapping).forEach(keyword => {
      if (keywords.includes(keyword)) {
        const industries = industryMapping[keyword];
        context.industries.push(...industries);
        context.relevance_suggestions.secondary_criteria.push(`${industries.join(', ')} industry events`);
      }
    });
    
    return context;
  }

  // Generate dynamic tag list from centralized config
  const usageTagList = Object.entries(USAGE_TAGS)
    .map(([tag, config]) => `- ${tag}: ${config.description}`)
    .join('\n');
  
  const industryTagList = Object.entries(INDUSTRY_TAGS)
    .map(([tag, config]) => `- ${tag}: ${config.description}`)
    .join('\n');

  const system = `You are an expert at understanding user context for SF Tech Week event recommendations. Extract key information from user messages to help find the most relevant events.

## AVAILABLE USAGE TAGS (Goals):
${usageTagList}

## AVAILABLE INDUSTRY TAGS:
${industryTagList}

## EXTRACTION FOCUS:
1. Demographics: Is this person looking for women-specific events?
2. Goals: What are they trying to achieve? Map to usage tags above
3. Industries: What industries are they interested in? Map to industry tags above
4. Location: Any specific area preferences?
5. Time: Any time preferences (morning, evening, specific times)?
6. Budget: Free vs paid events?
7. Relevance Suggestions: What should be prioritized in event ranking?

## MAPPING STRATEGY:
- Direct mentions: "hiring engineers" → find-talent
- Context clues: "looking for a co-founder" → find-cofounder
- Industry hints: "fashion tech startup" → fashion-tech industry
- Intent inference: "need funding" → find-investors, find-angels
- Synonym handling: "recruiting" = "hiring" = find-talent

For relevance suggestions, provide:
- Primary criteria: The most important factors for ranking events
- Secondary criteria: Additional factors that should influence ranking  
- Ranking rationale: A brief explanation of how events should be prioritized

IMPORTANT: Be broad and inclusive in your extraction. If someone mentions "female founder" they likely want women-specific events. If they mention "hiring engineers" they want talent/recruitment events.

Return JSON with keys: is_women_specific (boolean), goals (string[]), industries (string[]), location (string|null), time_preferences (string|null), budget (string|null), relevance_suggestions (object with primary_criteria, secondary_criteria, ranking_rationale).`;

  const user = `User message: ${message}`;

  const resp = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    temperature: 0.1,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ]
  });

  try {
    const text = resp.choices?.[0]?.message?.content || '{}';
    const data = JSON.parse(text);
    
    // Use centralized goal mapping
    const goalMapping = GOAL_MAPPING;
    
    const mappedGoals = (Array.isArray(data.goals) ? data.goals : [])
      .map(goal => goalMapping[goal.toLowerCase()] || goal)
      .filter(goal => goal); // Remove undefined values
    
    return {
      is_women_specific: Boolean(data.is_women_specific),
      goals: mappedGoals,
      industries: Array.isArray(data.industries) ? data.industries : [],
      location: data.location || null,
      time_preferences: data.time_preferences || null,
      budget: data.budget || null,
      relevance_suggestions: data.relevance_suggestions || {
        primary_criteria: [],
        secondary_criteria: [],
        ranking_rationale: 'Events selected based on general relevance to your query'
      }
    };
  } catch {
    return { 
      is_women_specific: false, 
      goals: [], 
      industries: [], 
      location: null, 
      time_preferences: null, 
      budget: null,
      relevance_suggestions: {
        primary_criteria: [],
        secondary_criteria: [],
        ranking_rationale: 'Events selected based on general relevance to your query'
      }
    };
  }
}

function rankEventsByRelevance(events, context) {
  console.log('🔧 Ranking events by relevance...');
  
  const scoredEvents = events.map(event => {
    const score = calculateRelevanceScore(event, context);
    return { ...event, relevanceScore: score };
  });
  
  // Sort by score (highest first)
  scoredEvents.sort((a, b) => b.relevanceScore - a.relevanceScore);
  
  // Log top 5 events with their scores for debugging
  console.log('🎯 Top 5 events by relevance score:');
  scoredEvents.slice(0, 5).forEach((event, index) => {
    console.log(`${index + 1}. ${event.event_name} - Score: ${event.relevanceScore}`);
  });
  
  return scoredEvents;
}

function calculateRelevanceScore(event, context) {
  let score = 0;
  const eventUsageTags = event.usage_tags || [];
  const eventIndustryTags = event.industry_tags || [];
  const eventTags = event.event_tags || [];
  const allIndustryTags = [...eventIndustryTags, ...eventTags];
  
  // Primary scoring: Usage tags (goals) - MOST IMPORTANT
  if (context.goals && context.goals.length > 0) {
    const matchingUsageTags = context.goals.filter(goal => 
      eventUsageTags.includes(goal)
    );
    
    matchingUsageTags.forEach(tag => {
      score += getUsageTagWeight(tag);
    });
  }
  
  // Secondary scoring: Industry tags
  if (context.industries && context.industries.length > 0) {
    const matchingIndustryTags = context.industries.filter(industry => 
      allIndustryTags.some(tag => 
        tag.toLowerCase().includes(industry.toLowerCase()) || 
        industry.toLowerCase().includes(tag.toLowerCase())
      )
    );
    
    matchingIndustryTags.forEach(industry => {
      score += getIndustryTagWeight(industry);
    });
  }
  
  // General tech tags bonus (applies to all industries)
  const generalTechTags = ['ai', 'technology', 'startup', 'venture-capital', 'networking', 'innovation', 'emerging-tech', 'b2b', 'b2c'];
  const hasGeneralTechTags = allIndustryTags.some(tag => generalTechTags.includes(tag));
  if (hasGeneralTechTags) {
    score += 20;
  }
  
  // Women-specific bonus
  if (context.is_women_specific && event.women_specific) {
    score += 30;
  }
  
  return score;
}

async function filterEvents(supabase, context, limit = 1000, maxLimit = 5000) {
  try {
    console.log('🔧 Building database query with context:', context);
    
    // Cap the limit at maxLimit to prevent excessive queries
    const actualLimit = Math.min(Number(limit) || 1000, maxLimit);
    console.log(`🔧 Using limit: ${actualLimit} (requested: ${limit}, max: ${maxLimit})`);
    
    let query = supabase
      .from(TABLE)
      .select('event_name,event_date,event_time,event_location,event_description,hosted_by,price,event_url,event_tags,usage_tags,industry_tags,women_specific,invite_only,event_name_and_link,outfit_category,updated_at')
      .order('updated_at', { ascending: false })
      .limit(actualLimit);

    // Apply women-specific filter if needed
    if (context.is_women_specific) {
      query = query.eq('women_specific', true);
      console.log('✅ Applied women-specific filter');
    }

    const { data, error } = await query;
    
    if (error) {
      console.error('❌ Database query error:', error);
      throw error;
    }
    
    console.log(`✅ Found ${data?.length || 0} events from database`);
    
    // Debug: Show some sample events with their usage tags
    if (data && data.length > 0) {
      console.log('📋 Sample events with usage tags:');
      data.slice(0, 5).forEach((event, index) => {
        console.log(`${index + 1}. ${event.event_name} - Usage tags: ${event.usage_tags ? event.usage_tags.join(', ') : 'None'}`);
      });
    }
    
    if (!data || data.length === 0) {
      return [];
    }

    // Apply broad filtering based on context
    let filteredEvents = data;

    // Filter by usage tags (goals) - be more lenient, only filter if we have many results
    if (context.goals && context.goals.length > 0) {
      const beforeFilter = filteredEvents.length;
      
      // First try strict filtering
      const strictFiltered = filteredEvents.filter(event => {
        const eventUsageTags = event.usage_tags || [];
        return context.goals.some(goal => eventUsageTags.includes(goal));
      });
      
      // If strict filtering gives us results, use it
      if (strictFiltered.length > 0) {
        filteredEvents = strictFiltered;
        console.log(`✅ Filtered from ${beforeFilter} to ${filteredEvents.length} events based on goals (strict filtering)`);
      } else {
        // If no results, try more lenient filtering based on event content
        const lenientFiltered = filteredEvents.filter(event => {
          const eventDescription = (event.event_description || '').toLowerCase();
          const eventName = (event.event_name || '').toLowerCase();
          const allText = `${eventName} ${eventDescription}`;
          
          // Look for cofounder-related keywords in the content
          if (context.goals.includes('meeting-founders')) {
            const cofounderKeywords = ['co-founder', 'cofounder', 'co founder', 'founder', 'startup', 'entrepreneur', 'partnership', 'collaboration'];
            return cofounderKeywords.some(keyword => allText.includes(keyword));
          }
          
          // Look for investor-related keywords
          if (context.goals.includes('meeting-investors') || context.goals.includes('connecting-investors')) {
            const investorKeywords = ['investor', 'angel', 'vc', 'funding', 'capital', 'investment', 'pitch', 'demo day'];
            return investorKeywords.some(keyword => allText.includes(keyword));
          }
          
          // Look for talent-related keywords
          if (context.goals.includes('meeting-people')) {
            const talentKeywords = ['hiring', 'talent', 'engineer', 'developer', 'recruit', 'job', 'career', 'networking', 'meet', 'connect'];
            return talentKeywords.some(keyword => allText.includes(keyword));
          }
          
          return false;
        });
        
        if (lenientFiltered.length > 0) {
          filteredEvents = lenientFiltered;
          console.log(`✅ Filtered from ${beforeFilter} to ${filteredEvents.length} events based on goals (lenient filtering)`);
        } else {
          console.log(`⚠️ No events found matching goals, keeping all ${beforeFilter} events for ranking`);
        }
      }
    }

    // Industry filtering - filter events based on industry preferences
    if (context.industries && context.industries.length > 0) {
      const beforeFilter = filteredEvents.length;
      console.log(`🔧 Industry filtering: User industries: ${context.industries.join(', ')}`);
      console.log(`🔧 Industry filtering: Starting with ${beforeFilter} events`);
      
      // Special case: If user has general tech interests (ai, startup, technology, etc.),
      // include events with general tech tags even if they don't have specific industry matches
      const generalTechKeywords = ['ai', 'technology', 'startup', 'venture-capital', 'networking', 'innovation', 'emerging-tech', 'b2b', 'b2c'];
      const hasGeneralTechInterest = context.industries.some(industry => 
        generalTechKeywords.some(keyword => 
          industry.toLowerCase().includes(keyword) || keyword.includes(industry.toLowerCase())
        )
      );
      
      console.log(`🔧 Industry filtering: Has general tech interest: ${hasGeneralTechInterest}`);
      
      if (hasGeneralTechInterest) {
        console.log(`✅ User has general tech interests - including events with general tech tags`);
        // For general tech interests, we'll be more lenient and include events with general tech tags
        // but still filter for specific industry matches if they exist
        const specificIndustryFiltered = filteredEvents.filter(event => {
          const eventIndustryTags = event.industry_tags || [];
          const eventTags = event.event_tags || [];
          const allIndustryTags = [...eventIndustryTags, ...eventTags];
          
          // Check if event matches any of the user's industry interests
          return context.industries.some(industry => 
            allIndustryTags.some(tag => 
              tag.toLowerCase().includes(industry.toLowerCase()) || 
              industry.toLowerCase().includes(tag.toLowerCase())
            )
          );
        });
        
        // If we found specific matches, use them; otherwise keep all events for general tech ranking
        if (specificIndustryFiltered.length > 0) {
          filteredEvents = specificIndustryFiltered;
          console.log(`✅ Filtered from ${beforeFilter} to ${filteredEvents.length} events based on specific industry matches`);
        } else {
          console.log(`✅ No specific industry matches found, keeping all ${beforeFilter} events for general tech ranking`);
        }
      } else {
        console.log(`✅ User has specific industry interests (not general tech) - applying strict filtering`);
        // For specific industry interests (like fashion-tech), filter strictly
        const beforeStrictFilter = filteredEvents.length;
        filteredEvents = filteredEvents.filter(event => {
          const eventIndustryTags = event.industry_tags || [];
          const eventTags = event.event_tags || [];
          const allIndustryTags = [...eventIndustryTags, ...eventTags];
          
          // Check if event matches any of the user's industry interests
          const matches = context.industries.some(industry => 
            allIndustryTags.some(tag => 
              tag.toLowerCase().includes(industry.toLowerCase()) || 
              industry.toLowerCase().includes(tag.toLowerCase())
            )
          );
          
          if (matches) {
            console.log(`  ✅ Event "${event.event_name}" matches industry filter`);
          }
          
          return matches;
        });
        console.log(`✅ Strict filtering: ${beforeStrictFilter} -> ${filteredEvents.length} events based on industry preferences`);
      }
    } else {
      console.log(`⚠️ No industry preferences found in context`);
    }

    // Filter by location if specified
    if (context.location) {
      const beforeFilter = filteredEvents.length;
      const locationKeywords = context.location.toLowerCase().split(/[,\s]+/).filter(w => w.length > 2);
      filteredEvents = filteredEvents.filter(event => {
        if (!event.event_location) return true;
        const eventLocation = event.event_location.toLowerCase();
        return locationKeywords.some(keyword => eventLocation.includes(keyword));
      });
      console.log(`✅ Filtered from ${beforeFilter} to ${filteredEvents.length} events based on location`);
    }

    // Filter by budget if specified
    if (context.budget) {
      const beforeFilter = filteredEvents.length;
      filteredEvents = filteredEvents.filter(event => {
        if (context.budget === 'free') {
          return event.price === '0' || event.price === 0 || !event.price || event.price.toLowerCase().includes('free');
        } else if (context.budget === 'paid') {
          return event.price && event.price !== '0' && event.price !== 0 && !event.price.toLowerCase().includes('free');
        }
        return true;
      });
      console.log(`✅ Filtered from ${beforeFilter} to ${filteredEvents.length} events based on budget`);
    }

    // Filter by time preferences if specified
    if (context.time_preferences) {
      const beforeFilter = filteredEvents.length;
      const timePref = context.time_preferences.toLowerCase();
      
      filteredEvents = filteredEvents.filter(event => {
        if (!event.event_time) return true; // Include events without time info
        
        const eventTime = event.event_time.toLowerCase();
        const eventDescription = (event.event_description || '').toLowerCase();
        const eventName = (event.event_name || '').toLowerCase();
        const allText = `${eventTime} ${eventDescription} ${eventName}`;
        
        // Check for evening preferences
        if (timePref.includes('evening') || timePref.includes('night')) {
          // Look for evening time indicators
          const eveningIndicators = [
            'pm', 'evening', 'night', 'dinner', 'cocktail', 'sunset', 'after 6', 'after 7', 'after 8',
            '6pm', '7pm', '8pm', '9pm', '10pm', '11pm', '12am', '1am', '2am'
          ];
          
          // Check if time contains PM or evening keywords
          const hasEveningTime = eveningIndicators.some(indicator => 
            eventTime.includes(indicator) || allText.includes(indicator)
          );
          
          // Also check for morning indicators to exclude them
          const morningIndicators = [
            'am', 'morning', 'breakfast', 'brunch', 'early', 'before 12', 'before 1',
            '6am', '7am', '8am', '9am', '10am', '11am', '12pm'
          ];
          
          const hasMorningTime = morningIndicators.some(indicator => 
            eventTime.includes(indicator) || allText.includes(indicator)
          );
          
          return hasEveningTime && !hasMorningTime;
        }
        
        // Check for morning preferences
        if (timePref.includes('morning') || timePref.includes('early')) {
          const morningIndicators = [
            'am', 'morning', 'breakfast', 'brunch', 'early', 'before 12', 'before 1',
            '6am', '7am', '8am', '9am', '10am', '11am', '12pm'
          ];
          
          const hasMorningTime = morningIndicators.some(indicator => 
            eventTime.includes(indicator) || allText.includes(indicator)
          );
          
          return hasMorningTime;
        }
        
        return true;
      });
      console.log(`✅ Filtered from ${beforeFilter} to ${filteredEvents.length} events based on time preferences: ${context.time_preferences}`);
    }

    // Apply intelligent ranking based on relevance
    if (filteredEvents.length > 0) {
      filteredEvents = rankEventsByRelevance(filteredEvents, context);
    }

    console.log(`🎯 Final filtered events: ${filteredEvents.length}`);
    return filteredEvents;

  } catch (err) {
    console.error('❌ Error in filterEvents:', err);
    throw err;
  }
}

async function refineEventsWithAI(openai, userMessage, context, events, limit = 50) {
  if (!openai || !events || events.length === 0) {
    console.log('⚠️ No OpenAI or events, returning first few events');
    return {
      events: events.slice(0, limit),
      explanations: []
    };
  }

  try {
    console.log('🔧 Refining events with AI...');
    
    // Prepare event summaries for AI analysis
    const eventSummaries = events.slice(0, Math.min(100, events.length)).map((event, index) => {
      return `${index + 1}. ${event.event_name}
   Date: ${event.event_date || 'TBA'}
   Time: ${event.event_time || 'TBA'}
   Location: ${event.event_location || 'TBA'}
   Host: ${event.hosted_by || 'TBA'}
   Price: ${event.price || 'TBA'}
   Description: ${event.event_description ? event.event_description.substring(0, 300) + '...' : 'No description'}
   Tags: ${event.event_tags ? event.event_tags.join(', ') : 'None'}
   Usage Tags: ${event.usage_tags ? event.usage_tags.join(', ') : 'None'}
   Industry Tags: ${event.industry_tags ? event.industry_tags.join(', ') : 'None'}
   Women Specific: ${event.women_specific ? 'Yes' : 'No'}`;
    }).join('\n\n');

    const systemPrompt = `You are an expert event recommendation assistant for SF Tech Week. Your job is to select the BEST events for the user and explain why each event is a good match.

User Query: "${userMessage}"
User Context: ${JSON.stringify(context, null, 2)}

Available Events:
${eventSummaries}

IMPORTANT RANKING PRIORITIES (in order):
1. PRIMARY USAGE TAGS (100 points each) - HIGHEST PRIORITY: meeting-founders, meeting-investors, connecting-investors
2. SPECIALIZED USAGE TAGS (80 points each) - HIGH PRIORITY: business-pitching, product-demos
3. SECONDARY USAGE TAGS (75 points each) - MEDIUM PRIORITY: meeting-people, networking, networking-opportunities, business-collaboration, collaboration, learning-industry-insights, learning, learning-skills, professional-development, industry-engagement, business-activities
4. INDUSTRY TAGS - MEDIUM PRIORITY: Events matching user's industry interests (ai, technology, startup, fintech, healthtech, etc.)
5. GENERAL TECH TAGS (20 points) - Events with general tech tags (ai, technology, startup, venture-capital, networking, innovation, emerging-tech, b2b, b2c) apply to all industries
6. WOMEN-SPECIFIC (30 points) - MEDIUM PRIORITY: Women-focused events when requested

Instructions:
1. Select the top ${limit} most relevant events for this user
2. For each selected event, provide a clear, detailed explanation of why it's a good match
3. Use the relevance suggestions to guide your ranking:
   - Primary criteria: ${Array.isArray(context.relevance_suggestions?.primary_criteria) ? context.relevance_suggestions.primary_criteria.join(', ') : 'General relevance'}
   - Secondary criteria: ${Array.isArray(context.relevance_suggestions?.secondary_criteria) ? context.relevance_suggestions.secondary_criteria.join(', ') : 'Industry alignment'}
   - Ranking rationale: ${context.relevance_suggestions?.ranking_rationale || 'Events selected based on general relevance'}
4. ALWAYS prioritize events with matching usage tags over industry-only matches
5. If user prefers evening events, prioritize evening events over morning events
6. If user prefers morning events, prioritize morning events over evening events
7. Events with BOTH usage tags AND industry matches should rank highest
8. If the user is looking for women-specific events, prioritize those
9. Consider event quality, networking potential, and relevance

For each event explanation, include:
- Why it matches the user's primary goals (usage tags)
- How it aligns with their industry interests (if applicable)
- Time preference alignment (if specified)
- What specific value it provides (networking, learning, funding opportunities, etc.)
- Any special features that make it particularly relevant

Return JSON in this format:
{
  "selected_events": [
    {
      "index": 1,
      "explanation": "Detailed explanation of why this event is perfect for the user, including specific reasons based on their goals, industry, and time preferences"
    }
  ],
  "overall_reasoning": "Comprehensive summary of your selection strategy, including how you prioritized usage tags over industry tags and considered time preferences"
}`;

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Please select the best events for: "${userMessage}"` }
      ],
      temperature: 0.1,
      max_tokens: 500
    });

    const responseText = response.choices?.[0]?.message?.content || '';
    console.log('🔧 AI Response:', responseText);

    // Parse AI response
    let selectedEvents = [];
    let overallReasoning = '';
    
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        selectedEvents = parsed.selected_events || [];
        overallReasoning = parsed.overall_reasoning || '';
        
        console.log('🧠 AI Overall Reasoning:', overallReasoning);
        console.log('🎯 Selected Events with Explanations:');
        selectedEvents.forEach((selection, idx) => {
          console.log(`  ${idx + 1}. Event ${selection.index}: ${selection.explanation}`);
        });
      } else {
        // Fallback: return first few events with generic explanations
        selectedEvents = events.slice(0, limit).map((_, idx) => ({ 
          index: idx + 1, 
          explanation: 'Selected based on relevance to your query' 
        }));
      }
    } catch (parseError) {
      console.error('❌ Error parsing AI response:', parseError);
      selectedEvents = events.slice(0, limit).map((_, idx) => ({ 
        index: idx + 1, 
        explanation: 'Selected based on relevance to your query' 
      }));
    }

    // Map to actual events with explanations
    const refinedEvents = selectedEvents
      .map(selection => {
        const idx = selection.index - 1;
        if (idx >= 0 && idx < events.length) {
          return {
            ...events[idx],
            aiExplanation: selection.explanation || 'No explanation provided'
          };
        }
        return null;
      })
      .filter(Boolean);

    console.log(`✅ AI refinement complete, returning ${refinedEvents.length} results`);
    return {
      events: refinedEvents,
      explanations: selectedEvents.map(s => s.explanation),
      overallReasoning
    };

  } catch (error) {
    console.error('❌ Error in AI refinement:', error);
    console.log('⚠️ Returning first few events without AI refinement');
    return {
      events: events.slice(0, limit),
      explanations: events.slice(0, limit).map(() => 'Selected based on relevance to your query')
    };
  }
}

async function saveQuery(supabase, message, context, results) {
  try {
    console.log('🔧 Preparing query data for saving...');
    const queryData = {
      user_message: message,
      extracted_context: context,
      results_count: results.length,
      created_at: new Date().toISOString()
    };
    
    console.log('🔧 Query data:', JSON.stringify(queryData, null, 2));
    console.log('🔧 Attempting to save to table:', QUERIES_TABLE);
    
    const { data, error } = await supabase
      .from(QUERIES_TABLE)
      .insert([queryData])
      .select('id');
    
    if (error) {
      console.error('❌ Error saving query:', error);
      console.error('❌ Error details:', JSON.stringify(error, null, 2));
      // Don't throw error - query logging is optional
    } else {
      console.log('✅ Query saved with ID:', data?.[0]?.id);
    }
  } catch (err) {
    console.error('❌ Error in saveQuery:', err);
    console.error('❌ Error stack:', err.stack);
    // Don't throw error - query logging is optional
  }
}

module.exports = async (req, res) => {
  console.log('=== RECOMMEND-EVENTS API CALLED ===');
  console.log('Method:', req.method);
  console.log('Body:', JSON.stringify(req.body, null, 2));
  
  if (req.method !== 'POST') {
    console.log('❌ Method not allowed:', req.method);
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  try {
    const { message, limit = 10 } = req.body || {};
    if (!message || typeof message !== 'string') {
      console.log('❌ Missing or invalid message');
      return res.status(400).json({ ok: false, error: 'Missing message' });
    }

    console.log('✅ Processing query:', message);
    console.log('✅ Limit:', limit);

    // Initialize clients
    console.log('🔧 Initializing Supabase client...');
    const supabase = getSupabaseClient();
    console.log('✅ Supabase client initialized');

    console.log('🔧 Initializing OpenAI client...');
    const openai = getOpenAI();
    console.log('✅ OpenAI client initialized:', openai ? 'Available' : 'Not available');

    // Step 1: Extract user context using OpenAI
    console.log('🔧 Step 1: Extracting user context...');
    const context = await extractUserContext(message, openai);
    console.log('✅ Extracted context:', JSON.stringify(context, null, 2));
    
    // Debug: Check if goals were extracted
    if (context.goals && context.goals.length > 0) {
      console.log('🎯 Goals extracted:', context.goals);
    } else {
      console.log('⚠️ No goals extracted from query');
    }

    // Step 2: Filter events based on context
    console.log('🔧 Step 2: Filtering events based on context...');
    const filteredEvents = await filterEvents(supabase, context, Math.max(200, limit * 20), 5000);
    console.log(`✅ Found ${filteredEvents.length} filtered events`);

    // Step 3: Use AI to refine and explain results
    console.log('🔧 Step 3: Refining events with AI...');
    const refinementResult = await refineEventsWithAI(openai, message, context, filteredEvents, limit);
    const finalEvents = refinementResult.events;
    const explanations = refinementResult.explanations;
    const overallReasoning = refinementResult.overallReasoning;
    console.log(`✅ AI refined to ${finalEvents.length} final events`);

    // Step 4: Shape response
    console.log('🔧 Step 4: Shaping response...');
    const results = finalEvents.map((e) => ({
      id: e.event_name_and_link || e.event_url || e.event_name, // Use as unique identifier
      name: e.event_name,
      description: e.event_description,
      date: e.event_date,
      time: e.event_time,
      location: e.event_location,
      host: e.hosted_by,
      price: e.price,
      url: e.event_url,
      tags: e.event_tags,
      usage_tags: e.usage_tags,
      industry_tags: e.industry_tags,
      women_specific: e.women_specific,
      invite_only: e.invite_only,
      outfit_category: e.outfit_category || generateEventCategory(e.event_name, e.event_description, e.event_tags),
      aiExplanation: e.aiExplanation || 'Selected based on relevance to your query'
    }));
    console.log(`✅ Shaped ${results.length} results`);

    // Step 5: Save query to database (optional)
    console.log('🔧 Step 5: Saving query to database...');
    await saveQuery(supabase, message, context, results);
    console.log('✅ Query saved (or skipped if table doesn\'t exist)');

    console.log(`✅ Returning ${results.length} results`);
    
    // If no results found, provide helpful message
    if (results.length === 0) {
      console.log('⚠️ No results found, returning empty response');
      return res.status(200).json({ 
        ok: true, 
        context, 
        results: [], 
        count: 0,
        overallReasoning: overallReasoning || 'No events found matching your criteria',
        message: 'No events found matching your criteria. Try broadening your search terms or check back later for new events.'
      });
    }

    console.log('✅ Success! Returning results');
    return res.status(200).json({ 
      ok: true, 
      context, 
      results, 
      count: results.length,
      overallReasoning: overallReasoning || 'Events selected based on your query and context',
      explanations: explanations,
      aiReasoning: {
        overall: overallReasoning || 'Events selected based on your query and context',
        events: results.map((event, index) => ({
          name: event.name,
          reason: event.aiExplanation || explanations[index] || 'Selected based on relevance to your query'
        })),
        relevance_suggestions: context.relevance_suggestions
      }
    });
  } catch (err) {
    console.error('❌ Error in recommend-events:', err);
    console.error('❌ Error stack:', err.stack);
    return res.status(500).json({ ok: false, error: err.message });
  }
};
