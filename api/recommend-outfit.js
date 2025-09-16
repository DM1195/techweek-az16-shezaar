const { getSupabaseClient } = require('./_supabase');
const { getOpenAI } = require('./_openai');

const OUTFIT_TABLE = process.env.OUTFIT_TABLE || 'Outfit Recommendations';

// Database schema for Outfit Recommendations table:
// - id (SERIAL PRIMARY KEY)
// - event_category (TEXT NOT NULL) - Event type (Business Casual, Activity, etc.)
// - gender (TEXT NOT NULL) - Gender preference (female, male, gender-neutral)
// - body_comfort (TEXT NOT NULL) - Comfort level (modest, bold, mid)
// - created_at (TIMESTAMP)
// - updated_at (TIMESTAMP)

// Generate outfit recommendation based on style_fit and body_comfort from database
function generateOutfitFromStyleAndComfort(eventCategory, styleFit, bodyComfort, gender) {
  const isFemale = gender === 'female';
  const isMale = gender === 'male';
  
  // Base recommendations by event category
  let baseRecommendation = '';
  
  if (eventCategory === 'Business Casual') {
    if (isFemale) {
      baseRecommendation = "A tailored blazer with dress pants or a professional dress, paired with closed-toe heels or professional flats. Consider a crisp white or light blue blouse, minimal jewelry, and a professional handbag.";
    } else if (isMale) {
      baseRecommendation = "Dark navy or charcoal suit with a crisp white or light blue dress shirt, leather dress shoes, and a professional watch. Consider a blazer with dress pants for a slightly more relaxed look.";
    } else {
      baseRecommendation = "Professional business attire - a well-fitted suit or equivalent professional ensemble. Choose neutral colors like navy, charcoal, or black.";
    }
  } else if (eventCategory === 'Activity') {
    if (isFemale) {
      baseRecommendation = "Comfortable athleisure or activewear that's still presentable - think structured joggers, a nice athletic top, and clean sneakers.";
    } else if (isMale) {
      baseRecommendation = "Comfortable athleisure or activewear that's still presentable - think structured joggers, a nice athletic top, and clean sneakers.";
    } else {
      baseRecommendation = "Comfortable athleisure or activewear that's still presentable. Choose breathable, comfortable pieces that allow for movement.";
    }
  } else if (eventCategory === 'Daytime Social') {
    if (isFemale) {
      baseRecommendation = "Light, airy pieces like a sundress with a cardigan, or nice pants with a flowy top. Comfortable flats or low heels.";
    } else if (isMale) {
      baseRecommendation = "Light, comfortable pieces like chinos with a polo or button-down shirt, clean sneakers or loafers.";
    } else {
      baseRecommendation = "Light, comfortable pieces that are appropriate for daytime gatherings. Choose breathable fabrics and comfortable footwear.";
    }
  } else if (eventCategory === 'Evening Social') {
    if (isFemale) {
      baseRecommendation = "Dressier attire like a cocktail dress or nice pants with a dressy top, heels or dressy flats, and elegant accessories.";
    } else if (isMale) {
      baseRecommendation = "Dressier attire like dark jeans or dress pants with a dress shirt or nice polo, dress shoes or clean sneakers, and a blazer.";
    } else {
      baseRecommendation = "Dressier attire appropriate for evening gatherings. Choose pieces that are more formal than daytime wear.";
    }
  } else {
    // Default for other categories
    if (isFemale) {
      baseRecommendation = "Smart casual attire - dark jeans or well-fitted pants, a stylish blouse or button-down shirt, comfortable flats or low heels, and a light jacket or blazer.";
    } else if (isMale) {
      baseRecommendation = "Smart casual attire - dark jeans or chinos, a button-down shirt or nice polo, clean sneakers or loafers, and a light jacket or blazer.";
    } else {
      baseRecommendation = "Smart casual attire that balances professionalism with comfort. Choose well-fitted, comfortable pieces in neutral colors.";
    }
  }
  
  // Adjust based on body comfort level
  if (bodyComfort === 'modest') {
    baseRecommendation += " Opt for more conservative cuts and longer hemlines. Avoid anything too tight or revealing.";
  } else if (bodyComfort === 'bold') {
    baseRecommendation += " Feel free to experiment with bolder colors, patterns, or statement pieces that express your personality.";
  } else if (bodyComfort === 'mid') {
    baseRecommendation += " Balance comfort with style - choose pieces that are both comfortable and stylish without being too conservative or too bold.";
  }
  
  return baseRecommendation;
}

// Get outfit recommendations from Supabase based on event categories and gender
async function getOutfitRecommendationsFromSupabase(eventCategories, gender) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      console.error('Supabase client not available');
      return [];
    }

    // Build query for outfit recommendations
    let query = supabase
      .from(OUTFIT_TABLE)
      .select('*')
      .in('outfit_category', eventCategories);

    console.log('Querying outfit recommendations for categories:', eventCategories);
    
    // Filter by gender if specified
    if (gender) {
      if (gender === 'prefer-not-to-say') {
        // Show gender-neutral options when user prefers not to say
        query = query.eq('gender', 'gender-neutral');
        console.log('Filtering by gender-neutral recommendations');
      } else if (gender === 'female') {
        // Show female style options
        query = query.eq('gender', 'female');
        console.log('Filtering by female recommendations');
      } else if (gender === 'male') {
        // Show male style options
        query = query.eq('gender', 'male');
        console.log('Filtering by male recommendations');
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching outfit recommendations:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      return [];
    }

    console.log(`✅ Found ${data?.length || 0} outfit recommendations from database`);
    return data || [];
  } catch (error) {
    console.error('Error in getOutfitRecommendationsFromSupabase:', error);
    return [];
  }
}

// Get recommended events to extract their categories
async function getRecommendedEvents(message) {
  try {
    const response = await fetch(`${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'http://localhost:3000'}/api/recommend-events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, limit: 10 }) // Get fewer events just for categories
    });
    
    const data = await response.json();
    if (data.ok && data.results) {
      return data.results;
    }
    return [];
  } catch (error) {
    console.error('Error fetching recommended events:', error);
    return [];
  }
}

module.exports = async function handler(req, res) {
  console.log('=== RECOMMEND-OUTFIT API CALLED ===');
  console.log('Method:', req.method);
  console.log('Body:', JSON.stringify(req.body, null, 2));
  
  if (req.method !== 'POST') {
    console.log('❌ Method not allowed:', req.method);
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const { message, gender, currentEvents } = req.body;
    
    if (!message) {
      console.log('❌ Missing message parameter');
      return res.status(400).json({ ok: false, error: 'Message is required' });
    }
    
    console.log('✅ Processing outfit recommendation request');
    console.log('✅ Message:', message);
    console.log('✅ Gender:', gender);
    console.log('✅ Current events provided:', currentEvents ? 'Yes' : 'No');

    // Use current events from frontend if provided, otherwise fetch them
    let recommendedEvents = currentEvents || [];
    
    if (recommendedEvents.length === 0) {
      recommendedEvents = await getRecommendedEvents(message);
    }
    
    if (recommendedEvents.length === 0) {
      console.log('⚠️ No events found to base outfit recommendations on');
      return res.status(200).json({ 
        ok: true, 
        recommendation: "No events found to base outfit recommendations on.",
        reasoning: "We couldn't find any events matching your criteria to generate outfit recommendations.",
        eventCategories: [],
        outfitRecommendations: [],
        count: 0,
        message: "No events found to base outfit recommendations on."
      });
    }

    // Extract unique event categories from recommended events
    const eventCategories = [...new Set(recommendedEvents.map(event => event.event_category).filter(Boolean))];
    
    if (eventCategories.length === 0) {
      console.log('⚠️ No event categories found to base outfit recommendations on');
      return res.status(200).json({ 
        ok: true, 
        recommendation: "No event categories found to base outfit recommendations on.",
        reasoning: "We couldn't determine the event categories for your recommended events.",
        eventCategories: [],
        outfitRecommendations: [],
        count: 0,
        message: "No event categories found to base outfit recommendations on."
      });
    }

    // Get outfit recommendations from Supabase for these categories and gender
    const outfitRecommendations = await getOutfitRecommendationsFromSupabase(eventCategories, gender);
    
    console.log('Event categories:', eventCategories);
    console.log('Gender:', gender);
    console.log('Found outfit recommendations:', outfitRecommendations.length);
    
    if (outfitRecommendations.length > 0) {
      // Map database records to the expected format
      const mappedRecommendations = outfitRecommendations.map(rec => {
        // Generate outfit recommendation based on the available data
        // Fix parameter order: (eventCategory, styleFit, bodyComfort, gender)
        const outfitRecommendation = generateOutfitFromStyleAndComfort(rec.event_category, rec.gender, rec.body_comfort, gender);
        
        return {
          event_category: rec.event_category,
          outfit_recommendation: outfitRecommendation, // Always use generated recommendation since DB doesn't store it
          reasoning: `This ${rec.gender} style with ${rec.body_comfort} comfort level is perfect for ${rec.event_category} events.`,
          style_fit: rec.gender,
          body_comfort: rec.body_comfort
        };
      });
      
      // Combine all recommendations for the categories
      const combinedRecommendation = mappedRecommendations.map(rec => 
        `**${rec.event_category}**: ${rec.outfit_recommendation}`
      ).join('\n\n');
      
      const combinedReasoning = mappedRecommendations.map(rec => 
        `**${rec.event_category}**: ${rec.reasoning}`
      ).join('\n\n');
      
      return res.status(200).json({ 
        ok: true, 
        recommendation: combinedRecommendation,
        reasoning: combinedReasoning,
        eventCategories: eventCategories,
        outfitRecommendations: mappedRecommendations,
        count: mappedRecommendations.length,
        message: `Found ${mappedRecommendations.length} outfit recommendations for your event categories.`
      });
    }

    // No outfit recommendations found in database - generate fallback recommendations for each category
    const fallbackTabs = eventCategories.map(category => {
      const fallbackRecommendation = generateOutfitFromStyleAndComfort(category, 'mid', 'mid', gender);
      return {
        event_category: category,
        outfit_recommendation: fallbackRecommendation,
        reasoning: `This outfit recommendation is tailored for ${category} events based on your preferences.`,
        style_fit: 'mid',
        body_comfort: 'mid',
        count: 1
      };
    });
    
    const combinedFallbackRecommendation = fallbackTabs.map(rec => 
      `**${rec.event_category}**: ${rec.outfit_recommendation}`
    ).join('\n\n');
    
    const combinedFallbackReasoning = fallbackTabs.map(rec => 
      `**${rec.event_category}**: ${rec.reasoning}`
    ).join('\n\n');
    
    return res.status(200).json({ 
      ok: true, 
      recommendation: combinedFallbackRecommendation,
      reasoning: combinedFallbackReasoning,
      eventCategories: eventCategories,
      outfitRecommendations: [],
      tabs: fallbackTabs, // New tabbed structure
      count: 0,
      message: `Generated outfit recommendations for your ${eventCategories.length} event categories.`
    });

  } catch (error) {
    console.error('Error generating outfit recommendation:', error);
    
    res.status(500).json({ 
      ok: false, 
      error: 'Failed to generate outfit recommendation',
      recommendation: "Sorry, we encountered an error while generating your outfit recommendation. Please try again later.",
      reasoning: "An error occurred while processing your request.",
      eventCategories: [],
      count: 0,
      message: "An error occurred while processing your request."
    });
  }
}

