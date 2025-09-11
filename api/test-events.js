const { getSupabaseClient } = require('./_supabase');

const TABLE = process.env.EVENTS_TABLE || 'Event List';

module.exports = async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    
    // Get a sample of events to test the connection
    const { data, error, count } = await supabase
      .from(TABLE)
      .select('*', { count: 'exact' })
      .limit(5);

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({ 
        ok: false, 
        error: error.message,
        details: 'Check your Supabase connection and table name'
      });
    }

    return res.status(200).json({ 
      ok: true, 
      total_events: count || 0,
      sample_events: data || [],
      table_name: TABLE,
      message: count === 0 ? 'No events found in database. You may need to populate the events table first.' : `Found ${count} events in database.`
    });
  } catch (err) {
    console.error('Test error:', err);
    return res.status(500).json({ 
      ok: false, 
      error: err.message,
      details: 'Check your environment variables and Supabase setup'
    });
  }
};
