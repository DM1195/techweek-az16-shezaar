const { getSupabaseClient } = require('./_supabase');
const { getOpenAI } = require('./_openai');

const TABLE = process.env.EVENTS_TABLE || 'Event List';

const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';

async function extractPreferences(message, openai) {
  if (!openai) {
    // Minimal fallback: return the raw message as a keyword and defaults
    return {
      industries: [],
      goals: [],
      location: null,
      day_of_week: [],
      time_window: null,
      budget: null,
      keywords: message?.slice(0, 200) || ''
    };
  }

  const system = `You extract structured event preferences from a short user message.
Return strict JSON with keys: industries (string[]), goals (string[]), location (string|null), day_of_week (string[] values among Mon,Tue,Wed,Thu,Fri,Sat,Sun), time_window ("morning"|"afternoon"|"evening"|null), budget ("free"|"paid"|null), keywords (string).`;

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
  const add = (s) => s && likes.push(`%${s}%`);
  for (const g of prefs.goals || []) add(g);
  for (const ind of prefs.industries || []) add(ind);
  if (prefs.location) add(prefs.location);
  if (prefs.budget === 'free') add('free');
  if (prefs.keywords) add(prefs.keywords);
  return likes;
}

async function fetchCandidateEvents(supabase, prefs, limit = 200) {
  let query = supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  const likes = buildTextFilters(prefs);
  if (likes.length) {
    const ors = likes.flatMap((like) => [
      `event_name.ilike.${like}`,
      `event_description.ilike.${like}`,
      `event_location.ilike.${like}`,
      `hosted_by.ilike.${like}`,
    ]);
    query = query.or(ors.join(','));
  }

  // Day/time filters are best with normalized columns; for now, match text tokens
  if (Array.isArray(prefs.day_of_week) && prefs.day_of_week.length) {
    const tokens = prefs.day_of_week.join('|');
    query = query.or([
      `event_date.ilike.%${tokens}%`,
      `event_description.ilike.%${tokens}%`
    ].join(','));
  }

  if (prefs.time_window) {
    const token = prefs.time_window;
    query = query.or([
      `event_time.ilike.%${token}%`,
      `event_description.ilike.%${token}%`
    ].join(','));
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
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
    const { error } = await supabase.from('events').upsert(updates).select('id');
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

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  try {
    const { message, limit = 10 } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ ok: false, error: 'Missing message' });
    }

    const supabase = getSupabaseClient();
    const openai = getOpenAI();

    // 1) Extract structured preferences
    const prefs = await extractPreferences(message, openai);

    // 2) Pull text-matched candidates from DB
    const candidates = await fetchCandidateEvents(supabase, prefs, Math.max(50, limit * 10));

    // 3) Rank with embeddings when available
    const ranked = await rankWithEmbeddings(openai, supabase, prefs, candidates, limit);

    // 4) Shape minimal response
    const results = ranked.map((e) => ({
      id: e.id,
      name: e.event_name,
      date: e.event_date,
      time: e.event_time,
      location: e.event_location,
      host: e.hosted_by,
      price: e.price,
      url: e.event_url
    }));

    return res.status(200).json({ ok: true, prefs, results, count: results.length });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: err.message });
  }
};
