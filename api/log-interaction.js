const { getSupabaseClient } = require('./_supabase');

const INTERACTIONS_TABLE = process.env.INTERACTIONS_TABLE || 'Query List';

module.exports = async (req, res) => {
  console.log('log-interaction API called with method:', req.method);
  console.log('Request body:', req.body);
  
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const { sessionId, email, type, data, timestamp, userAgent } = req.body;
    
    console.log('Parsed data:', { sessionId, email, type, data, timestamp, userAgent });
    
    if (!type || !data) {
      console.log('Missing required fields - type:', type, 'data:', data);
      return res.status(400).json({ ok: false, error: 'Missing required fields' });
    }

    const supabase = getSupabaseClient();
    
    const insertData = {
      session_id: sessionId,
      email: email || null,
      interaction_type: type,
      data: data, // Pass the object directly - Supabase will handle JSONB conversion
      user_agent: userAgent,
      timestamp: timestamp ? new Date(timestamp).toISOString() : new Date().toISOString()
    };
    
    console.log('Inserting to Supabase:', insertData);
    console.log('Table name:', INTERACTIONS_TABLE);
    
    const { error } = await supabase
      .from(INTERACTIONS_TABLE)
      .insert(insertData);

    if (error) {
      console.error('Supabase error:', error);
      console.error('Error code:', error.code);
      console.error('Error details:', error.details);
      console.error('Error hint:', error.hint);
      return res.status(500).json({ 
        ok: false, 
        error: 'Failed to log interaction', 
        details: error.message,
        code: error.code,
        hint: error.hint
      });
    }

    console.log('Successfully inserted to Supabase');
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Error logging interaction:', error);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
}
