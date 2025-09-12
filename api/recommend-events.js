const { getSupabaseClient } = require('./_supabase');
const { getOpenAI } = require('./_openai');

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
      budget: null
    };
    
    // Extract goals - be more comprehensive
    if (keywords.includes('hire') || keywords.includes('hiring') || keywords.includes('engineers') || keywords.includes('talent') || keywords.includes('recruit')) {
      context.goals.push('find-talent', 'hiring');
    }
    if (keywords.includes('investor') || keywords.includes('funding') || keywords.includes('angel') || keywords.includes('vc') || keywords.includes('venture')) {
      context.goals.push('find-investors', 'find-angels');
    }
    if (keywords.includes('co-founder') || keywords.includes('cofounder') || keywords.includes('co founder') || keywords.includes('partner') || keywords.includes('cofounder')) {
      context.goals.push('find-cofounder');
    }
    if (keywords.includes('customer') || keywords.includes('user') || keywords.includes('client') || keywords.includes('users')) {
      context.goals.push('find-users');
    }
    if (keywords.includes('advisor') || keywords.includes('mentor') || keywords.includes('guidance')) {
      context.goals.push('find-advisors');
    }
    if (keywords.includes('network') || keywords.includes('networking') || keywords.includes('connect') || keywords.includes('meet')) {
      context.goals.push('networking');
    }
    if (keywords.includes('learn') || keywords.includes('learning') || keywords.includes('skill') || keywords.includes('education')) {
      context.goals.push('learn-skills');
    }
    if (keywords.includes('feedback') || keywords.includes('validate') || keywords.includes('test')) {
      context.goals.push('get-user-feedback');
    }
    if (keywords.includes('insight') || keywords.includes('industry') || keywords.includes('trend')) {
      context.goals.push('industry-insights');
    }
    
    // Extract industries
    if (keywords.includes('fashion')) context.industries.push('fashion', 'fashion-tech');
    if (keywords.includes('tech')) context.industries.push('tech', 'technology');
    if (keywords.includes('ai') || keywords.includes('artificial intelligence')) context.industries.push('ai', 'artificial-intelligence');
    if (keywords.includes('fintech')) context.industries.push('fintech');
    if (keywords.includes('wellness') || keywords.includes('health')) context.industries.push('wellness', 'health-tech');
    
    return context;
  }

  const system = `You are an expert at understanding user context for SF Tech Week event recommendations. Extract key information from user messages to help find the most relevant events.

Focus on identifying:
1. Demographics: Is this person looking for women-specific events?
2. Goals: What are they trying to achieve? (hiring, finding investors, networking, learning, etc.)
3. Industries: What industries are they interested in? (fashion, tech, AI, fintech, wellness, etc.)
4. Location: Any specific area preferences?
5. Time: Any time preferences?
6. Budget: Free vs paid events?

IMPORTANT: Be broad and inclusive in your extraction. If someone mentions "female founder" they likely want women-specific events. If they mention "hiring engineers" they want talent/recruitment events.

Return JSON with keys: is_women_specific (boolean), goals (string[]), industries (string[]), location (string|null), time_preferences (string|null), budget (string|null).`;

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
    return {
      is_women_specific: Boolean(data.is_women_specific),
      goals: Array.isArray(data.goals) ? data.goals : [],
      industries: Array.isArray(data.industries) ? data.industries : [],
      location: data.location || null,
      time_preferences: data.time_preferences || null,
      budget: data.budget || null
    };
  } catch {
    return { is_women_specific: false, goals: [], industries: [], location: null, time_preferences: null, budget: null };
  }
}

async function filterEvents(supabase, context, limit = 100) {
  try {
    console.log('🔧 Building database query with context:', context);
    
    let query = supabase
      .from(TABLE)
      .select('id,event_name,event_date,event_time,event_location,event_description,hosted_by,price,event_url,event_tags,usage_tags,industry_tags,women_specific,invite_only,event_name_and_link,updated_at')
      .order('updated_at', { ascending: false })
      .limit(limit);

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
    
    if (!data || data.length === 0) {
      return [];
    }

    // Apply broad filtering based on context
    let filteredEvents = data;

    // Filter by usage tags (goals) - most important filter, be strict
    if (context.goals && context.goals.length > 0) {
      const beforeFilter = filteredEvents.length;
      filteredEvents = filteredEvents.filter(event => {
        const eventUsageTags = event.usage_tags || [];
        return context.goals.some(goal => eventUsageTags.includes(goal));
      });
      console.log(`✅ Filtered from ${beforeFilter} to ${filteredEvents.length} events based on goals`);
    }

    // Filter by industry tags - be loose, only filter if we have too many results
    // If we have fewer than 20 results after usage filtering, don't filter by industry
    if (context.industries && context.industries.length > 0 && filteredEvents.length > 20) {
      const beforeFilter = filteredEvents.length;
      filteredEvents = filteredEvents.filter(event => {
        const eventIndustryTags = event.industry_tags || [];
        const eventTags = event.event_tags || [];
        const allTags = [...eventIndustryTags, ...eventTags];
        
        return context.industries.some(industry => 
          allTags.some(tag => 
            tag.toLowerCase().includes(industry.toLowerCase()) || 
            industry.toLowerCase().includes(tag.toLowerCase())
          )
        );
      });
      console.log(`✅ Filtered from ${beforeFilter} to ${filteredEvents.length} events based on industries (loose filtering)`);
    } else if (context.industries && context.industries.length > 0) {
      console.log(`✅ Skipping industry filtering - only ${filteredEvents.length} events after usage filtering`);
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

Instructions:
1. Select the top ${limit} most relevant events for this user
2. For each selected event, provide a clear, concise explanation of why it's a good match
3. PRIORITIZE events that match the user's primary goals (especially cofounder, investor, talent finding)
4. Industry matching is secondary - include events that match goals even if industry doesn't perfectly align
5. If the user is looking for women-specific events, prioritize those
6. Consider event quality, networking potential, and relevance
7. For cofounder queries, prioritize events with 'find-cofounder' usage tags

Return JSON in this format:
{
  "selected_events": [
    {
      "index": 1,
      "explanation": "Why this event is perfect for the user"
    }
  ],
  "overall_reasoning": "Brief summary of your selection strategy"
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

    // Step 2: Filter events based on context
    console.log('🔧 Step 2: Filtering events based on context...');
    const filteredEvents = await filterEvents(supabase, context, Math.max(100, limit * 10));
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
      id: e.id,
      name: e.event_name,
      description: e.event_description,
      date: e.event_date,
      time: e.event_time,
      location: e.event_location,
      host: e.hosted_by,
      price: e.price,
      url: e.event_url,
      tags: e.event_tags,
      women_specific: e.women_specific,
      invite_only: e.invite_only,
      event_category: generateEventCategory(e.event_name, e.event_description, e.event_tags),
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
      explanations: explanations
    });
  } catch (err) {
    console.error('❌ Error in recommend-events:', err);
    console.error('❌ Error stack:', err.stack);
    return res.status(500).json({ ok: false, error: err.message });
  }
};
