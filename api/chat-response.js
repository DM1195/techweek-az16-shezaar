const { getSupabaseClient } = require('./_supabase');
const TABLE = process.env.EVENTS_TABLE || 'Event List';
let OpenAI;
try {
  OpenAI = require('openai');
} catch {
  OpenAI = null;
}

async function searchEvents(supabase, query, limit = 10) {
  if (!query) return [];
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .or(`event_name.ilike.%${query}%,event_description.ilike.%${query}%,event_location.ilike.%${query}%,hosted_by.ilike.%${query}%`)
    .limit(limit);
  if (error) throw error;
  return data || [];
}

function formatEventsPlain(events) {
  if (!events.length) return 'No matching events found.';
  return events.map((e, i) => (
    `${i + 1}. ${e.event_name} — ${e.event_date} ${e.event_time || ''}\n   Where: ${e.event_location || 'TBA'}\n   Host: ${e.hosted_by || 'N/A'}\n   Price: ${e.price || 'N/A'}\n   URL: ${e.event_url}`
  )).join('\n\n');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  try {
    const { message, limit = 8, llm = true } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ ok: false, error: 'Missing message' });
    }

    const supabase = getSupabaseClient();
    const events = await searchEvents(supabase, message, limit);
    const plain = formatEventsPlain(events);

    const useLLM = llm && process.env.OPENAI_API_KEY && OpenAI;
    if (!useLLM) {
      return res.status(200).json({ ok: true, response: plain, events });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const system = 'You are an assistant that helps users find relevant SF Tech Week events. Summarize and format results clearly.';
    const user = `User query: ${message}\n\nHere are matching events (format and highlight the top few):\n\n${plain}`;

    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      temperature: 0.4
    });

    const text = completion.choices?.[0]?.message?.content || plain;
    return res.status(200).json({ ok: true, response: text, events });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: err.message });
  }
};
