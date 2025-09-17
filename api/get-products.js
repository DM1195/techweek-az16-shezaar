const { getSupabaseClient } = require('./_supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      console.error('Supabase client not available');
      return res.status(500).json({ ok: false, error: 'Database connection failed' });
    }

    // Get outfit_recommendation_id from query parameters
    const { outfit_recommendation_id } = req.query;

    let query = supabase
      .from('Product List')
      .select('*')
      .order('created_at', { ascending: false });

    // Filter by outfit recommendation ID if provided
    if (outfit_recommendation_id) {
      query = query.eq('outfit_recommendation_id', outfit_recommendation_id);
    }

    const { data: products, error } = await query;

    if (error) {
      console.error('Error fetching products:', error);
      return res.status(500).json({ ok: false, error: 'Failed to fetch products' });
    }

    return res.status(200).json({ 
      ok: true, 
      products: products || [],
      count: products ? products.length : 0,
      outfit_recommendation_id: outfit_recommendation_id || null
    });

  } catch (error) {
    console.error('Error in get-products handler:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
}
