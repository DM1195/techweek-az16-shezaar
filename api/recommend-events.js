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

  const system = `You extract structured event preferences from a user message about finding SF Tech Week events.
Focus on identifying:
- Industries: wellness, health tech, fitness, AI, blockchain, fintech, etc.
- Goals: meeting investors/angels, finding co-founders, networking, learning, funding, etc.
- Location preferences: SOMA, FiDi, Mission, etc.
- Time preferences: morning, afternoon, evening, specific days
- Budget: free, paid, low-cost

Return strict JSON with keys: industries (string[]), goals (string[]), location (string|null), day_of_week (string[] values among Mon,Tue,Wed,Thu,Fri,Sat,Sun), time_window ("morning"|"afternoon"|"evening"|null), budget ("free"|"paid"|null), keywords (string).

For wellness tech platforms looking for angels and co-founders, prioritize:
- industries: ["wellness", "health tech", "fitness tech", "AI", "startup"]
- goals: ["meet investors", "find angels", "find co-founders", "networking", "funding"]`;

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
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    console.log('✅ Base query built');

    // Build search terms from extracted preferences
    const searchTerms = [];
    
    // Add keywords from the user message
    if (prefs.keywords) {
      searchTerms.push(prefs.keywords);
    }
    
    // Add industries
    if (prefs.industries && prefs.industries.length > 0) {
      searchTerms.push(...prefs.industries);
    }
    
    // Add goals
    if (prefs.goals && prefs.goals.length > 0) {
      searchTerms.push(...prefs.goals);
    }
    
    // Add location if specified
    if (prefs.location) {
      searchTerms.push(prefs.location);
    }
    
    // Add specific terms for wellness tech, angels, and co-founders
    const message = prefs.keywords?.toLowerCase() || '';
    if (message.includes('wellness') || message.includes('health') || message.includes('fitness')) {
      searchTerms.push('wellness', 'health', 'fitness', 'mental health', 'wellbeing');
    }
    if (message.includes('angel') || message.includes('investor') || message.includes('vc')) {
      searchTerms.push('angel', 'investor', 'vc', 'funding', 'investment', 'capital');
    }
    if (message.includes('co-founder') || message.includes('founder') || message.includes('startup')) {
      searchTerms.push('founder', 'co-founder', 'startup', 'entrepreneur', 'founders');
    }
    
    console.log('🔧 Search terms built:', searchTerms);

    // If we have search terms, use them to filter events
    if (searchTerms.length > 0) {
      // Clean and deduplicate search terms, then join them
      const cleanTerms = [...new Set(searchTerms
        .filter(term => term && term.trim())
        .map(term => term.trim())
        .filter(term => term.length > 1))]; // Remove single character terms
      
      console.log('🔧 Clean terms:', cleanTerms);
      
      if (cleanTerms.length > 0) {
        // Create a single search string like the working get-events.js approach
        const searchString = cleanTerms.slice(0, 5).join(' '); // Join terms with spaces
        const cleaned = sanitizeLikeValue(searchString);
        
        console.log('🔧 Search string:', searchString);
        console.log('🔧 Cleaned string:', cleaned);
        
        if (cleaned) {
          console.log('🔧 Applying search filter...');
          
          // Use the same pattern as get-events.js (event_tags removed due to JSON type)
          query = query.or(
            `event_name.ilike.%${cleaned}%,event_description.ilike.%${cleaned}%,event_location.ilike.%${cleaned}%,hosted_by.ilike.%${cleaned}%`
          );
          console.log('✅ Search filter applied');
        }
      }
    } else {
      console.log('⚠️ No search terms, using base query');
    }

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
  if (!openai || !events?.length) return [];
  const missing = events.filter((e) => e.embedding == null);
  if (!missing.length) return [];

  // Prepare inputs
  const inputs = missing.map((e) => `${e.event_name}\n${e.event_description || ''}`.slice(0, 8000));

  // Batch in chunks to respect token/rate limits
  const batchSize = 50;
  for (let i = 0; i < inputs.length; i += batchSize) {
    const slice = inputs.slice(i, i + batchSize);
    const resp = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: slice });
    const vectors = resp.data.map((d) => d.embedding);
    const updates = missing.slice(i, i + batchSize).map((e, idx) => ({ id: e.id, embedding: vectors[idx] }));
    const { error } = await supabase.from(TABLE).upsert(updates).select('id');
    if (error) {
      // If the column doesn't exist, give up silently; caller will fall back to text ranking
      if (!/column .*embedding.* does not exist/i.test(error.message)) {
        throw error;
      }
      return [];
    }
  }
  return missing.map((e) => e.id);
}

function cosineSimilarity(a, b) {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-8);
}

async function rankWithEmbeddings(openai, supabase, prefs, candidates, topK = 10) {
  if (!openai || !candidates?.length) return candidates.slice(0, topK);
  // Ensure embeddings exist in DB for these candidates
  await ensureEmbeddingsForEvents(openai, supabase, candidates);
  // Re-fetch candidates with embeddings
  const ids = candidates.map((e) => e.id).filter(Boolean);
  if (!ids.length) return candidates.slice(0, topK);
  const { data, error } = await supabase.from(TABLE).select('id,event_name,event_description,event_date,event_time,event_location,hosted_by,price,event_url,embedding').in('id', ids);
  if (error) throw error;
  const haveEmb = data.filter((e) => Array.isArray(e.embedding));
  if (!haveEmb.length) return candidates.slice(0, topK);

  const userText = [prefs.keywords, ...(prefs.goals||[]), ...(prefs.industries||[])].filter(Boolean).join(' ').trim() || 'events that match my goals';
  const userEmb = (await openai.embeddings.create({ model: EMBEDDING_MODEL, input: userText })).data[0].embedding;

  const scored = haveEmb.map((e) => ({ e, score: cosineSimilarity(userEmb, e.embedding) }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).map((x) => x.e);
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

    // 3) Rank with embeddings when available
    console.log('🔧 Step 3: Ranking events...');
    const ranked = await rankWithEmbeddings(openai, supabase, prefs, candidates, limit);
    console.log(`✅ Ranked to ${ranked.length} events`);

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
      tags: e.event_tags
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
        message: 'No events found matching your criteria. Try broadening your search terms or check back later for new events.'
      });
    }

    console.log('✅ Success! Returning results');
    return res.status(200).json({ ok: true, prefs, results, count: results.length });
  } catch (err) {
    console.error('❌ Error in recommend-events:', err);
    console.error('❌ Error stack:', err.stack);
    return res.status(500).json({ ok: false, error: err.message });
  }
};
