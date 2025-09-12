const { getSupabaseClient } = require('./_supabase');
const { getOpenAI } = require('./_openai');

const TABLE = process.env.EVENTS_TABLE || 'Event List';
const QUERIES_TABLE = process.env.QUERIES_TABLE || 'Query';

function sanitizeLikeValue(s) {
  if (!s || typeof s !== 'string') return '';
  return s.replace(/[(),]/g, ' ').replace(/\s+/g, ' ').trim();
}

const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';

async function extractPreferences(message, openai) {
  if (!openai) {
    // Enhanced fallback: better keyword extraction for wellness tech, angels, co-founders
    const keywords = message?.toLowerCase() || '';
    const industries = [];
    const goals = [];
    
    // Extract wellness tech related terms
    if (keywords.includes('wellness') || keywords.includes('health') || keywords.includes('fitness') || keywords.includes('mental health')) {
      industries.push('wellness', 'health tech', 'fitness tech');
    }
    
    // Extract investor/angel related terms
    if (keywords.includes('angel') || keywords.includes('investor') || keywords.includes('vc') || keywords.includes('funding')) {
      goals.push('meet investors', 'find angels', 'funding', 'investment');
    }
    
    // Extract co-founder related terms
    if (keywords.includes('co-founder') || keywords.includes('cofounder') || keywords.includes('founder') || keywords.includes('partner')) {
      goals.push('find co-founders', 'meet founders', 'partnership', 'collaboration');
    }
    
    return {
      industries,
      goals,
      location: null,
      day_of_week: [],
      time_window: null,
      budget: null,
      keywords: message?.slice(0, 200) || ''
    };
  }

  const system = `You are an expert at understanding user intent for SF Tech Week event recommendations. Extract structured preferences from user messages.

Focus on identifying:
- Industries: wellness, health tech, fitness, AI, blockchain, fintech, startup, etc.
- Goals: meeting investors/angels, finding co-founders, networking, learning, funding, hiring, etc.
- Location preferences: SOMA, FiDi, Mission, South Beach, etc.
- Time preferences: morning, afternoon, evening, specific days (Oct 6-10, 2024)
- Budget: free, paid, low-cost
- Event types: networking, panels, demos, pitch events, etc.

IMPORTANT: SF Tech Week runs from October 6-10, 2024. When users mention specific dates or days, map them to the correct day of week:
- Oct 6 = Sun, Oct 7 = Mon, Oct 8 = Tue, Oct 9 = Wed, Oct 10 = Thu

Return strict JSON with keys: industries (string[]), goals (string[]), location (string|null), day_of_week (string[] values among Mon,Tue,Wed,Thu,Fri,Sat,Sun), time_window ("morning"|"afternoon"|"evening"|null), budget ("free"|"paid"|null), keywords (string).

Be intelligent about understanding context - if someone mentions "wellness tech platform" they likely want health/wellness events, if they mention "co-founders" they want networking events, if they mention "angels" they want investor events.`;

  const user = `User message: ${message}`;

  const resp = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    temperature: 0.2,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ]
  });

  try {
    const text = resp.choices?.[0]?.message?.content || '{}';
    const data = JSON.parse(text);
    // Ensure defaults
    return {
      industries: Array.isArray(data.industries) ? data.industries : [],
      goals: Array.isArray(data.goals) ? data.goals : [],
      location: data.location ?? null,
      day_of_week: Array.isArray(data.day_of_week) ? data.day_of_week : [],
      time_window: data.time_window ?? null,
      budget: data.budget ?? null,
      keywords: typeof data.keywords === 'string' ? data.keywords : ''
    };
  } catch {
    return { industries: [], goals: [], location: null, day_of_week: [], time_window: null, budget: null, keywords: message || '' };
  }
}

function buildTextFilters(prefs) {
  const likes = [];
  const add = (s) => {
    const cleaned = sanitizeLikeValue(s);
    if (cleaned) likes.push(cleaned);
  };
  for (const g of prefs.goals || []) add(g);
  for (const ind of prefs.industries || []) add(ind);
  if (prefs.location) add(prefs.location);
  if (prefs.budget === 'free') add('free');
  if (prefs.keywords) add(prefs.keywords);
  return likes;
}

function mapGoalsToUsageTags(goals) {
  const goalToUsageTag = {
    'meet investors': ['find-investors', 'find-angels'],
    'find angels': ['find-angels'],
    'find co-founders': ['find-cofounder'],
    'meet founders': ['find-cofounder'],
    'partnership': ['find-cofounder'],
    'collaboration': ['find-cofounder'],
    'funding': ['find-investors', 'find-angels'],
    'investment': ['find-investors', 'find-angels'],
    'advisors': ['find-advisors'],
    'mentors': ['find-advisors'],
    'users': ['find-users'],
    'customers': ['find-users'],
    'beta testers': ['find-users'],
    'feedback': ['get-user-feedback'],
    'talent': ['find-talent'],
    'employees': ['find-talent'],
    'hiring': ['find-talent'],
    'learn': ['learn-skills'],
    'skills': ['learn-skills'],
    'workshop': ['learn-skills'],
    'networking': ['networking'],
    'connect': ['networking'],
    'industry': ['industry-insights'],
    'trends': ['industry-insights']
  };
  
  const usageTags = new Set();
  goals.forEach(goal => {
    const tags = goalToUsageTag[goal.toLowerCase()] || [];
    tags.forEach(tag => usageTags.add(tag));
  });
  
  return Array.from(usageTags);
}

function filterEventsByUsageTags(events, usageTags) {
  if (!usageTags || usageTags.length === 0) {
    return events;
  }
  
  return events.filter(event => {
    const eventUsageTags = event.usage_tags || [];
    return usageTags.some(tag => eventUsageTags.includes(tag));
  });
}

function filterEventsByDate(events, dayOfWeek, timeWindow) {
  if (!dayOfWeek || dayOfWeek.length === 0) {
    return events;
  }
  
  const dayMapping = {
    'Mon': 'Monday',
    'Tue': 'Tuesday', 
    'Wed': 'Wednesday',
    'Thu': 'Thursday',
    'Fri': 'Friday',
    'Sat': 'Saturday',
    'Sun': 'Sunday'
  };
  
  return events.filter(event => {
    if (!event.event_date) return true;
    
    // Parse date and get day of week
    const eventDate = new Date(event.event_date);
    const eventDay = eventDate.toLocaleDateString('en-US', { weekday: 'long' });
    
    // Check if event day matches any preferred days
    const matchesDay = dayOfWeek.some(day => {
      const fullDayName = dayMapping[day] || day;
      return eventDay.toLowerCase().includes(fullDayName.toLowerCase());
    });
    
    if (!matchesDay) return false;
    
    // If time window is specified, filter by time
    if (timeWindow && event.event_time) {
      const time = event.event_time.toLowerCase();
      const hour = parseInt(time.match(/(\d+)/)?.[1] || '0');
      const isPM = time.includes('pm');
      const hour24 = isPM && hour !== 12 ? hour + 12 : (!isPM && hour === 12 ? 0 : hour);
      
      switch (timeWindow) {
        case 'morning':
          return hour24 >= 6 && hour24 < 12;
        case 'afternoon':
          return hour24 >= 12 && hour24 < 17;
        case 'evening':
          return hour24 >= 17 || hour24 < 6;
        default:
          return true;
      }
    }
    
    return true;
  });
}

function filterEventsByLocation(events, location) {
  if (!location) return events;
  
  const locationKeywords = location.toLowerCase().split(/[,\s]+/).filter(w => w.length > 2);
  
  return events.filter(event => {
    if (!event.event_location) return true;
    
    const eventLocation = event.event_location.toLowerCase();
    return locationKeywords.some(keyword => eventLocation.includes(keyword));
  });
}

function filterEventsByBudget(events, budget) {
  if (!budget) return events;
  
  return events.filter(event => {
    if (budget === 'free') {
      return event.price === '0' || event.price === 0 || !event.price || event.price.toLowerCase().includes('free');
    } else if (budget === 'paid') {
      return event.price && event.price !== '0' && event.price !== 0 && !event.price.toLowerCase().includes('free');
    }
    return true;
  });
}

function filterEventsByIndustry(events, industries) {
  if (!industries || industries.length === 0) return events;
  
  const industryKeywords = industries.flatMap(ind => [
    ind.toLowerCase(),
    ind.replace(/\s+/g, '').toLowerCase(),
    ind.replace(/\s+/g, '-').toLowerCase()
  ]);
  
  return events.filter(event => {
    const searchText = `${event.event_name} ${event.event_description || ''} ${event.event_tags?.join(' ') || ''}`.toLowerCase();
    return industryKeywords.some(keyword => searchText.includes(keyword));
  });
}

async function fetchCandidateEvents(supabase, prefs, limit = 200) {
  try {
    console.log('🔧 Building base query...');
    let query = supabase
      .from(TABLE)
      .select('id,event_name,event_date,event_time,event_location,event_description,hosted_by,price,event_url,event_tags,usage_tags,invite_only,event_name_and_link,updated_at')
      .order('updated_at', { ascending: false })
      .limit(limit);
    console.log('✅ Base query built');

    console.log('🔧 Executing database query...');
    const { data, error } = await query;
    
    if (error) {
      console.error('❌ Database query error:', error);
      console.error('❌ Error details:', JSON.stringify(error, null, 2));
      throw error;
    }
    
    console.log(`✅ Found ${data?.length || 0} candidate events`);
    
    // Apply smart filtering based on user preferences
    let filteredEvents = data || [];
    const initialCount = filteredEvents.length;
    console.log(`🔧 Starting with ${initialCount} events for smart filtering`);
    
    // 1. Filter by usage tags (goals) - most important filter
    if (prefs.goals && prefs.goals.length > 0) {
      const usageTags = mapGoalsToUsageTags(prefs.goals);
      console.log('🔧 Mapped goals to usage tags:', usageTags);
      
      const beforeFilter = filteredEvents.length;
      filteredEvents = filterEventsByUsageTags(filteredEvents, usageTags);
      console.log(`✅ Filtered from ${beforeFilter} to ${filteredEvents.length} events based on usage tags`);
    }
    
    // 2. Filter by industry keywords
    if (prefs.industries && prefs.industries.length > 0) {
      const beforeFilter = filteredEvents.length;
      filteredEvents = filterEventsByIndustry(filteredEvents, prefs.industries);
      console.log(`✅ Filtered from ${beforeFilter} to ${filteredEvents.length} events based on industry keywords`);
    }
    
    // 3. Filter by date/time preferences
    if (prefs.day_of_week && prefs.day_of_week.length > 0) {
      const beforeFilter = filteredEvents.length;
      filteredEvents = filterEventsByDate(filteredEvents, prefs.day_of_week, prefs.time_window);
      console.log(`✅ Filtered from ${beforeFilter} to ${filteredEvents.length} events based on date/time preferences`);
    }
    
    // 4. Filter by location
    if (prefs.location) {
      const beforeFilter = filteredEvents.length;
      filteredEvents = filterEventsByLocation(filteredEvents, prefs.location);
      console.log(`✅ Filtered from ${beforeFilter} to ${filteredEvents.length} events based on location`);
    }
    
    // 5. Filter by budget
    if (prefs.budget) {
      const beforeFilter = filteredEvents.length;
      filteredEvents = filterEventsByBudget(filteredEvents, prefs.budget);
      console.log(`✅ Filtered from ${beforeFilter} to ${filteredEvents.length} events based on budget`);
    }
    
    console.log(`🎯 Smart filtering complete: ${initialCount} → ${filteredEvents.length} events (${Math.round((1 - filteredEvents.length/initialCount) * 100)}% reduction)`);
    
    // If filtering is too aggressive (less than 5 events), fall back to less strict filtering
    if (filteredEvents.length < 5 && initialCount > 10) {
      console.log('⚠️ Too few events after filtering, applying fallback strategy...');
      
      // Fallback: only apply usage tag filtering (most important) and industry filtering
      let fallbackEvents = data || [];
      
      if (prefs.goals && prefs.goals.length > 0) {
        const usageTags = mapGoalsToUsageTags(prefs.goals);
        fallbackEvents = filterEventsByUsageTags(fallbackEvents, usageTags);
        console.log(`🔄 Fallback: ${fallbackEvents.length} events after usage tag filtering`);
      }
      
      if (prefs.industries && prefs.industries.length > 0) {
        fallbackEvents = filterEventsByIndustry(fallbackEvents, prefs.industries);
        console.log(`🔄 Fallback: ${fallbackEvents.length} events after industry filtering`);
      }
      
      // If still too few, just use usage tag filtering
      if (fallbackEvents.length < 5 && prefs.goals && prefs.goals.length > 0) {
        const usageTags = mapGoalsToUsageTags(prefs.goals);
        fallbackEvents = filterEventsByUsageTags(data || [], usageTags);
        console.log(`🔄 Final fallback: ${fallbackEvents.length} events with usage tags only`);
      }
      
      // If still too few, return original data
      if (fallbackEvents.length < 3) {
        console.log('🔄 Using original unfiltered data as last resort');
        return data || [];
      }
      
      return fallbackEvents;
    }
    
    return filteredEvents;
  } catch (err) {
    console.error('❌ Error in fetchCandidateEvents:', err);
    console.error('❌ Error stack:', err.stack);
    throw err;
  }
}

async function ensureEmbeddingsForEvents(openai, supabase, events) {
  console.log('🔧 ensureEmbeddingsForEvents called');
  console.log('🔧 OpenAI available:', !!openai);
  console.log('🔧 Events count:', events?.length || 0);
  
  if (!openai || !events?.length) {
    console.log('⚠️ No OpenAI or events, skipping embeddings');
    return [];
  }
  
  const missing = events.filter((e) => e.embedding == null);
  console.log('🔧 Events missing embeddings:', missing.length);
  
  if (!missing.length) {
    console.log('✅ All events already have embeddings');
    return [];
  }

  try {
    // Prepare inputs
    const inputs = missing.map((e) => `${e.event_name}\n${e.event_description || ''}`.slice(0, 8000));
    console.log('🔧 Prepared', inputs.length, 'inputs for embedding');

    // Batch in chunks to respect token/rate limits
    const batchSize = 50;
    for (let i = 0; i < inputs.length; i += batchSize) {
      const slice = inputs.slice(i, i + batchSize);
      console.log(`🔧 Processing batch ${i / batchSize + 1}/${Math.ceil(inputs.length / batchSize)}`);
      
      const resp = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: slice });
      const vectors = resp.data.map((d) => d.embedding);
      const updates = missing.slice(i, i + batchSize).map((e, idx) => ({ id: e.id, embedding: vectors[idx] }));
      
      console.log('🔧 Attempting to upsert embeddings...');
      const { error } = await supabase.from(TABLE).upsert(updates).select('id');
      
      if (error) {
        console.error('❌ Error upserting embeddings:', error);
        console.error('❌ Error details:', JSON.stringify(error, null, 2));
        
        // If the column doesn't exist or there's a JSON operator error, give up silently
        if (!/column .*embedding.* does not exist/i.test(error.message) && 
            !/operator does not exist.*json/i.test(error.message)) {
          throw error;
        }
        console.log('⚠️ Embedding column issue, skipping embedding storage');
        return [];
      }
      console.log('✅ Batch upserted successfully');
    }
    
    console.log('✅ All embeddings processed successfully');
    return missing.map((e) => e.id);
  } catch (err) {
    console.error('❌ Error in ensureEmbeddingsForEvents:', err);
    console.log('⚠️ Continuing without embeddings');
    return [];
  }
}

function cosineSimilarity(a, b) {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-8);
}

async function intelligentRanking(openai, prefs, candidates, topK = 10) {
  console.log('🔧 Starting hybrid ranking approach...');
  console.log('🔧 Candidates count:', candidates?.length || 0);
  console.log('🔧 OpenAI available:', !!openai);
  
  if (!openai || !candidates?.length) {
    console.log('⚠️ No OpenAI or candidates, returning first', topK, 'candidates');
    return {
      events: candidates.slice(0, topK),
      reasoning: null
    };
  }

  try {
    const userQuery = prefs.keywords || '';
    const userGoals = prefs.goals || [];
    const userIndustries = prefs.industries || [];
    
    // Step 1: Events are already pre-filtered by smart filtering, so we can work with them directly
    console.log('🔧 Step 1: Events already pre-filtered by smart filtering, using all candidates');
    const relevantEvents = candidates;
    
    console.log(`🔧 Working with ${relevantEvents.length} pre-filtered events`);
    
    // Step 2: Use AI to rank the pre-filtered events
    if (relevantEvents.length === 0) {
      console.log('⚠️ No relevant events found, returning first few candidates');
      return {
        events: candidates.slice(0, topK),
        reasoning: {
          overall: "No events matched the search criteria, showing general events",
          events: []
        }
      };
    }
    
    // Take only the most promising events for AI analysis (reduced from 15 to 10 for efficiency)
    const eventsToAnalyze = relevantEvents.slice(0, 10);
    
    const eventSummaries = eventsToAnalyze.map((event, index) => {
      return `${index + 1}. ${event.event_name}
   Date: ${event.event_date || 'TBA'}
   Time: ${event.event_time || 'TBA'}
   Location: ${event.event_location || 'TBA'}
   Host: ${event.hosted_by || 'TBA'}
   Price: ${event.price || 'TBA'}
   Description: ${event.event_description ? event.event_description.substring(0, 200) + '...' : 'No description'}
   Tags: ${event.event_tags ? event.event_tags.join(', ') : 'None'}`;
    }).join('\n\n');

    const systemPrompt = `You are an expert event recommendation assistant. These events have already been pre-filtered based on the user's specific criteria (goals, industries, dates, location, budget). Your job is to rank and select the BEST matches from this curated list.

User Query: "${userQuery}"
User Goals: ${userGoals.join(', ')}
User Industries: ${userIndustries.join(', ')}

Pre-filtered Events to analyze:
${eventSummaries}

Since these events are already filtered for relevance, focus on:
1. Event quality and networking potential
2. Specific match to user's stated goals
3. Event timing and logistics
4. Overall value and exclusivity

Return JSON with your top recommendations:
{
  "reasoning": "Brief explanation of your selection approach",
  "selected_events": [
    {
      "index": 3,
      "reason": "Why this event is the best match for the user"
    }
  ]
}`;

    console.log('🔧 Sending to OpenAI for focused analysis...');
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Find the best events for: "${userQuery}"` }
      ],
      temperature: 0.1,
      max_tokens: 600
    });

    const responseText = response.choices?.[0]?.message?.content || '';
    console.log('🔧 OpenAI response:', responseText);

    // Parse response
    let aiReasoning = null;
    let selectedEvents = [];
    
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        aiReasoning = parsed.reasoning;
        selectedEvents = parsed.selected_events || [];
        
        console.log('🧠 AI Reasoning:', aiReasoning);
        console.log('🎯 Selected Events with Reasons:');
        selectedEvents.forEach((event, idx) => {
          console.log(`  ${idx + 1}. Event ${event.index}: ${event.reason}`);
        });
      } else {
        // Fallback: return first few events
        selectedEvents = eventsToAnalyze.slice(0, topK).map((_, idx) => ({ 
          index: idx + 1, 
          reason: 'Selected based on keyword matching' 
        }));
      }
    } catch (parseError) {
      console.error('❌ Error parsing OpenAI response:', parseError);
      selectedEvents = eventsToAnalyze.slice(0, topK).map((_, idx) => ({ 
        index: idx + 1, 
        reason: 'Selected based on keyword matching' 
      }));
    }

    // Map to actual events
    const rankedEvents = selectedEvents
      .map(selection => {
        const idx = selection.index - 1;
        if (idx >= 0 && idx < eventsToAnalyze.length) {
          return {
            ...eventsToAnalyze[idx],
            aiReason: selection.reason || 'No reason provided'
          };
        }
        return null;
      })
      .filter(Boolean);

    console.log(`✅ Hybrid ranking complete, returning ${rankedEvents.length} results`);
    return {
      events: rankedEvents.slice(0, topK),
      reasoning: {
        overall: aiReasoning || "Used keyword pre-filtering + AI ranking",
        events: selectedEvents.map(selection => ({
          name: eventsToAnalyze[selection.index - 1]?.event_name || 'Unknown',
          reason: selection.reason || 'No reason provided'
        }))
      }
    };

  } catch (error) {
    console.error('❌ Error in hybrid ranking:', error);
    console.log('⚠️ Returning first', topK, 'candidates without ranking');
    return {
      events: candidates.slice(0, topK),
      reasoning: null
    };
  }
}

async function saveQuery(supabase, message, prefs, results) {
  try {
    console.log('🔧 Preparing query data for saving...');
    const queryData = {
      user_message: message,
      extracted_preferences: prefs,
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

    console.log('🔧 Initializing Supabase client...');
    const supabase = getSupabaseClient();
    console.log('✅ Supabase client initialized');

    console.log('🔧 Initializing OpenAI client...');
    const openai = getOpenAI();
    console.log('✅ OpenAI client initialized:', openai ? 'Available' : 'Not available');

    // 1) Extract structured preferences using OpenAI
    console.log('🔧 Step 1: Extracting preferences...');
    const prefs = await extractPreferences(message, openai);
    console.log('✅ Extracted preferences:', JSON.stringify(prefs, null, 2));

    // 2) Pull text-matched candidates from DB
    console.log('🔧 Step 2: Fetching candidate events...');
    const candidates = await fetchCandidateEvents(supabase, prefs, Math.max(50, limit * 10));
    console.log(`✅ Found ${candidates.length} candidate events`);

    // 3) Use intelligent ranking with OpenAI
    console.log('🔧 Step 3: Intelligent ranking with OpenAI...');
    let ranked;
    let aiReasoning = null;
    try {
      const rankingResult = await intelligentRanking(openai, prefs, candidates, limit);
      ranked = rankingResult.events;
      aiReasoning = rankingResult.reasoning;
      console.log(`✅ Intelligently ranked to ${ranked.length} events`);
      if (aiReasoning) {
        console.log('🧠 AI Reasoning captured:', aiReasoning.overall);
      }
    } catch (rankError) {
      console.error('❌ Error in intelligent ranking, using simple fallback:', rankError);
      console.log('⚠️ Using simple fallback ranking');
      // Simple fallback: just return the first N candidates
      ranked = candidates.slice(0, limit);
      aiReasoning = null;
      console.log(`✅ Fallback: returning first ${ranked.length} events`);
    }

    // 4) Shape minimal response
    console.log('🔧 Step 4: Shaping response...');
    const results = ranked.map((e) => ({
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
      invite_only: e.invite_only,
      aiReason: e.aiReason || null
    }));
    console.log(`✅ Shaped ${results.length} results`);

    // 5) Save query to database (optional - won't fail if table doesn't exist)
    console.log('🔧 Step 5: Saving query to database...');
    await saveQuery(supabase, message, prefs, results);
    console.log('✅ Query saved (or skipped if table doesn\'t exist)');

    console.log(`✅ Returning ${results.length} results`);
    
    // If no results found, provide helpful message
    if (results.length === 0) {
      console.log('⚠️ No results found, returning empty response');
      return res.status(200).json({ 
        ok: true, 
        prefs, 
        results: [], 
        count: 0,
        aiReasoning: aiReasoning,
        message: 'No events found matching your criteria. Try broadening your search terms or check back later for new events.'
      });
    }

    console.log('✅ Success! Returning results');
    return res.status(200).json({ 
      ok: true, 
      prefs, 
      results, 
      count: results.length,
      aiReasoning: aiReasoning
    });
  } catch (err) {
    console.error('❌ Error in recommend-events:', err);
    console.error('❌ Error stack:', err.stack);
    return res.status(500).json({ ok: false, error: err.message });
  }
};
