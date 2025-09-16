const { getSupabaseClient } = require('./_supabase');

module.exports = async (req, res) => {
  try {
    console.log('Testing Supabase connection...');
    
    const supabase = getSupabaseClient();
    
    // Test 1: Check if we can connect
    console.log('Testing basic connection...');
    
    // Test 2: Try to query the table structure
    console.log('Testing table access...');
    const { data, error } = await supabase
      .from('Query List')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('Table access error:', error);
      return res.status(500).json({ 
        ok: false, 
        error: 'Table access failed',
        details: error.message,
        code: error.code,
        hint: error.hint
      });
    }
    
    console.log('Table access successful, sample data:', data);
    
    // Test 3: Try a simple insert
    console.log('Testing insert...');
    const testData = {
      session_id: 'test_session_' + Date.now(),
      email: 'test@example.com',
      interaction_type: 'test',
      data: { test: true },
      user_agent: 'test-agent',
      timestamp: new Date().toISOString()
    };
    
    const { error: insertError } = await supabase
      .from('Query List')
      .insert(testData);
    
    if (insertError) {
      console.error('Insert test error:', insertError);
      return res.status(500).json({ 
        ok: false, 
        error: 'Insert test failed',
        details: insertError.message,
        code: insertError.code,
        hint: insertError.hint
      });
    }
    
    console.log('Insert test successful');
    
    res.status(200).json({ 
      ok: true, 
      message: 'Supabase connection and table access working',
      testData: testData
    });
    
  } catch (error) {
    console.error('Test error:', error);
    res.status(500).json({ 
      ok: false, 
      error: 'Test failed',
      details: error.message
    });
  }
};
