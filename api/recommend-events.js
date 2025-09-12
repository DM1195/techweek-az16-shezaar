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
- Time preferences: morning, afternoon, evening, specific days
- Budget: free, paid, low-cost
- Event types: networking, panels, demos, pitch events, etc.

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

async function fetchCandidateEvents(supabase, prefs, limit = 200) {
  try {
    console.log('🔧 Building base query...');
    let query = supabase
      .from(TABLE)
      .select('id,event_name,event_date,event_time,event_location,event_description,hosted_by,price,event_url,event_tags,invite_only,event_name_and_link,updated_at')
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
    return data || [];
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
  console.log('🔧 Starting intelligent ranking...');
  console.log('🔧 Candidates count:', candidates?.length || 0);
  console.log('🔧 OpenAI available:', !!openai);
  
  if (!openai || !candidates?.length) {
    console.log('⚠️ No OpenAI or candidates, returning first', topK, 'candidates');
    return candidates.slice(0, topK);
  }

  try {
    // Create a detailed context for OpenAI to understand the user's needs
    const userQuery = prefs.keywords || '';
    const userGoals = prefs.goals || [];
    const userIndustries = prefs.industries || [];
    
    // Prepare event data for OpenAI analysis
    const eventSummaries = candidates.slice(0, 50).map((event, index) => {
      return `${index + 1}. ${event.event_name}
   Date: ${event.event_date || 'TBA'}
   Time: ${event.event_time || 'TBA'}
   Location: ${event.event_location || 'TBA'}
   Host: ${event.hosted_by || 'TBA'}
   Price: ${event.price || 'TBA'}
   Description: ${event.event_description ? event.event_description.substring(0, 300) + '...' : 'No description'}
   Tags: ${event.event_tags ? event.event_tags.join(', ') : 'None'}`;
    }).join('\n\n');

    const systemPrompt = `You are an expert event recommendation assistant for SF Tech Week. Your job is to analyze a user's query and find the most relevant events from a list.

User Query: "${userQuery}"
User Goals: ${userGoals.join(', ')}
User Industries: ${userIndustries.join(', ')}

Here are the available events:
${eventSummaries}

Please analyze the user's query and select the ${topK} most relevant events. Consider:
1. Direct keyword matches in event names, descriptions, and tags
2. Industry relevance (wellness, health tech, AI, etc.)
3. Networking goals (finding co-founders, investors, etc.)
4. Event type and format
5. Location preferences
6. Time and date relevance

IMPORTANT: For each selected event, provide a brief explanation of why it's relevant to the user's query.

Return a JSON object with this structure:
{
  "reasoning": "Brief explanation of your overall analysis approach",
  "selected_events": [
    {
      "index": 3,
      "reason": "Why this event is relevant to the user's query"
    },
    {
      "index": 7,
      "reason": "Why this event is relevant to the user's query"
    }
  ]
}`;

    console.log('🔧 Sending to OpenAI for intelligent ranking...');
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Please rank the most relevant events for: "${userQuery}"` }
      ],
      temperature: 0.3,
      max_tokens: 500
    });

    const responseText = response.choices?.[0]?.message?.content || '';
    console.log('🔧 OpenAI response:', responseText);

    // Parse the structured response
    let aiReasoning = null;
    let selectedEvents = [];
    
    try {
      // Try to parse the JSON response
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
        // Fallback: look for numbers in the response
        const numbers = responseText.match(/\d+/g);
        if (numbers) {
          selectedEvents = numbers.slice(0, topK).map(n => ({ index: parseInt(n) }));
        }
      }
    } catch (parseError) {
      console.error('❌ Error parsing OpenAI response:', parseError);
      console.log('⚠️ Using fallback ranking');
      return candidates.slice(0, topK);
    }

    // Map indices back to actual events
    const rankedEvents = selectedEvents
      .map(selection => {
        const idx = selection.index - 1; // Convert to 0-based
        if (idx >= 0 && idx < candidates.length) {
          return {
            ...candidates[idx],
            aiReason: selection.reason || 'No reason provided'
          };
        }
        return null;
      })
      .filter(Boolean);

    console.log(`✅ Intelligent ranking complete, returning ${rankedEvents.length} results`);
    return {
      events: rankedEvents.slice(0, topK),
      reasoning: {
        overall: aiReasoning,
        events: selectedEvents.map(selection => ({
          name: candidates[selection.index - 1]?.event_name || 'Unknown',
          reason: selection.reason || 'No reason provided'
        }))
      }
    };

  } catch (error) {
    console.error('❌ Error in intelligent ranking:', error);
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
