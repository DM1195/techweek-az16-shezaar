const { getSupabaseClient } = require('./_supabase');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      console.error('Supabase client not available');
      return res.status(500).json({ ok: false, error: 'Database connection failed' });
    }

    // Get products from the product_list table
    const { data: products, error } = await supabase
      .from('product_list')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching products:', error);
      return res.status(500).json({ ok: false, error: 'Failed to fetch products' });
    }

    return res.status(200).json({ 
      ok: true, 
      products: products || [],
      count: products ? products.length : 0
    });

  } catch (error) {
    console.error('Error in get-products handler:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
}
