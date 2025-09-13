const { getSupabaseClient } = require('./_supabase');

const INTERACTIONS_TABLE = process.env.INTERACTIONS_TABLE || 'UserInteractions';

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const { type, data, timestamp, userAgent } = req.body;
    
    if (!type || !data) {
      return res.status(400).json({ ok: false, error: 'Missing required fields' });
    }

    const supabase = getSupabaseClient();
    
    const { error } = await supabase
      .from(INTERACTIONS_TABLE)
      .insert({
        type,
        data: JSON.stringify(data),
        timestamp: timestamp || new Date().toISOString(),
        user_agent: userAgent,
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ ok: false, error: 'Failed to log interaction' });
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Error logging interaction:', error);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
}
