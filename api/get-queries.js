const { getSupabaseClient } = require('./_supabase');

const QUERIES_TABLE = process.env.QUERIES_TABLE || 'Query';

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  try {
    const supabase = getSupabaseClient();
    const limit = Math.min(parseInt(req.query.limit) || 50, 5000);
    const offset = parseInt(req.query.offset) || 0;

    const { data, error } = await supabase
      .from(QUERIES_TABLE)
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching queries:', error);
      return res.status(500).json({ ok: false, error: 'Failed to fetch queries' });
    }

    return res.status(200).json({ 
      ok: true, 
      queries: data || [], 
      count: data?.length || 0 
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: err.message });
  }
};
