const { getSupabaseClient } = require('./_supabase');
const { getOpenAI } = require('./_openai');

const OUTFIT_TABLE = process.env.OUTFIT_TABLE || 'Outfit Recommendations';

// Database schema for Outfit Recommendations table:
// - id (SERIAL PRIMARY KEY)
// - outfit_category (TEXT NOT NULL) - Event type (business-casual, activity, etc.)
// - gender (TEXT NOT NULL) - Gender preference (female, male, gender-neutral)
// - body_comfort (TEXT NOT NULL) - Comfort level (modest, bold, mid)
// - outfit_recommendation (TEXT) - The actual outfit recommendation text
// - reasoning (TEXT) - Why this outfit works for this category
// - created_at (TIMESTAMP)
// - updated_at (TIMESTAMP)

// Generate outfit recommendation based on style_fit and body_comfort from database
function generateOutfitFromStyleAndComfort(eventCategory, styleFit, bodyComfort, gender) {
  const isFemale = gender === 'female';
  const isMale = gender === 'male';
  
  // Normalize event category to handle different formats
  const normalizedCategory = eventCategory
    .toLowerCase()
    .replace(/-/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  
  // Base recommendations by event category
  let baseRecommendation = '';
  
  if (normalizedCategory === 'Business Casual') {
    if (isFemale) {
      baseRecommendation = "A tailored blazer with dress pants or a professional dress, paired with closed-toe heels or professional flats. Consider a crisp white or light blue blouse, minimal jewelry, and a professional handbag.";
    } else if (isMale) {
      baseRecommendation = "Dark navy or charcoal suit with a crisp white or light blue dress shirt, leather dress shoes, and a professional watch. Consider a blazer with dress pants for a slightly more relaxed look.";
    } else {
      baseRecommendation = "Professional business attire - a well-fitted suit or equivalent professional ensemble. Choose neutral colors like navy, charcoal, or black.";
    }
  } else if (normalizedCategory === 'Activity') {
    if (isFemale) {
      baseRecommendation = "Comfortable athleisure or activewear that's still presentable - think structured joggers, a nice athletic top, and clean sneakers.";
    } else if (isMale) {
      baseRecommendation = "Comfortable athleisure or activewear that's still presentable - think structured joggers, a nice athletic top, and clean sneakers.";
    } else {
      baseRecommendation = "Comfortable athleisure or activewear that's still presentable. Choose breathable, comfortable pieces that allow for movement.";
    }
  } else if (normalizedCategory === 'Daytime Social') {
    if (isFemale) {
      baseRecommendation = "Light, airy pieces like a sundress with a cardigan, or nice pants with a flowy top. Comfortable flats or low heels.";
    } else if (isMale) {
      baseRecommendation = "Light, comfortable pieces like chinos with a polo or button-down shirt, clean sneakers or loafers.";
    } else {
      baseRecommendation = "Light, comfortable pieces that are appropriate for daytime gatherings. Choose breathable fabrics and comfortable footwear.";
    }
  } else if (normalizedCategory === 'Evening Social') {
    if (isFemale) {
      baseRecommendation = "Dressier attire like a cocktail dress or nice pants with a dressy top, heels or dressy flats, and elegant accessories.";
    } else if (isMale) {
      baseRecommendation = "Dressier attire like dark jeans or dress pants with a dress shirt or nice polo, dress shoes or clean sneakers, and a blazer.";
    } else {
      baseRecommendation = "Dressier attire appropriate for evening gatherings. Choose pieces that are more formal than daytime wear.";
    }
  } else if (normalizedCategory === 'Casual') {
    if (isFemale) {
      baseRecommendation = "Relaxed yet put-together pieces like well-fitted jeans, a nice t-shirt or blouse, comfortable sneakers or flats, and a casual jacket or cardigan.";
    } else if (isMale) {
      baseRecommendation = "Relaxed yet put-together pieces like dark jeans, a polo shirt or casual button-down, clean sneakers or casual shoes, and a light jacket.";
    } else {
      baseRecommendation = "Relaxed yet put-together pieces that are comfortable and stylish. Choose well-fitted, casual pieces that look intentional.";
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
async function getOutfitRecommendationsFromSupabase(eventCategories, gender, rawEventCategories = []) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      console.error('Supabase client not available');
      return [];
    }

    // Build query for outfit recommendations
    // Convert title case back to kebab-case for database query
    const dbCategories = eventCategories.map(category => 
      category.toLowerCase().replace(/\s+/g, '-')
    );
    
    console.log('🔍 Raw event categories from frontend:', rawEventCategories);
    console.log('🔍 Normalized event categories:', eventCategories);
    console.log('🔍 Database query categories (kebab-case):', dbCategories);
    console.log('🔍 Querying table:', OUTFIT_TABLE);
    
    // First, let's check what outfit categories actually exist in the database
    const { data: allOutfitData, error: allError } = await supabase
      .from(OUTFIT_TABLE)
      .select('outfit_category, gender')
      .limit(10);
    
    if (allError) {
      console.error('❌ Error checking database contents:', allError);
    } else {
      console.log('🔍 Sample outfit categories in database:', allOutfitData);
    }
    
    let query = supabase
      .from(OUTFIT_TABLE)
      .select('*')
      .in('outfit_category', dbCategories);

    console.log('Querying outfit recommendations for categories:', dbCategories);
    
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
      console.error('❌ Error fetching outfit recommendations:', error);
      console.error('❌ Error details:', JSON.stringify(error, null, 2));
      return [];
    }

    console.log(`✅ Found ${data?.length || 0} outfit recommendations from database`);
    console.log('🔍 Database response data:', data);
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
    const rawEventCategories = [...new Set(recommendedEvents.map(event => event.outfit_category).filter(Boolean))];
    
    // Convert kebab-case to title case for database lookup
    const eventCategories = rawEventCategories.map(category => {
      return category
        .toLowerCase()
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    });
    
    console.log('🔍 Raw event categories:', rawEventCategories);
    console.log('🔍 Normalized event categories:', eventCategories);
    console.log('🔍 Sample recommended event:', recommendedEvents[0]);
    
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
    const outfitRecommendations = await getOutfitRecommendationsFromSupabase(eventCategories, gender, rawEventCategories);
    
    console.log('Event categories:', eventCategories);
    console.log('Gender:', gender);
    console.log('Found outfit recommendations:', outfitRecommendations.length);
    
    if (outfitRecommendations.length > 0) {
      // Map database records to the expected format
      const mappedRecommendations = outfitRecommendations.map(rec => {
        const bodyComfort = rec.body_comfort || 'mid'; // Default to 'mid' if not specified
        
        // Convert kebab-case outfit_category to title case for display
        const displayCategory = rec.outfit_category
          .toLowerCase()
          .split('-')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        
        return {
          outfit_category: displayCategory,
          outfit_recommendation: rec.outfit_recommendation || generateOutfitFromStyleAndComfort(displayCategory, rec.gender, bodyComfort, gender),
          reasoning: rec.reasoning || `This ${rec.gender} style is perfect for ${displayCategory} events.`,
          style_fit: rec.gender,
          body_comfort: bodyComfort
        };
      });
      
      // Combine all recommendations for the categories
      const combinedRecommendation = mappedRecommendations.map(rec => 
        `**${rec.outfit_category}**: ${rec.outfit_recommendation}`
      ).join('\n\n');
      
      const combinedReasoning = mappedRecommendations.map(rec => 
        `**${rec.outfit_category}**: ${rec.reasoning}`
      ).join('\n\n');
      
      // Create tabs structure for the frontend
      const tabs = mappedRecommendations.map(rec => ({
        outfit_category: rec.outfit_category,
        outfit_recommendation: rec.outfit_recommendation,
        reasoning: rec.reasoning,
        style_fit: rec.style_fit,
        body_comfort: rec.body_comfort,
        count: 1
      }));

      return res.status(200).json({ 
        ok: true, 
        recommendation: combinedRecommendation,
        reasoning: combinedReasoning,
        outfitCategories: eventCategories,
        outfitRecommendations: mappedRecommendations,
        tabs: tabs, // New tabbed structure
        count: mappedRecommendations.length,
        message: `Found ${mappedRecommendations.length} outfit recommendations for your outfit categories.`
      });
    }

    // No outfit recommendations found in database - return empty response
    return res.status(200).json({ 
      ok: true, 
      recommendation: "No outfit recommendations found in our database for your outfit categories.",
      reasoning: "We couldn't find outfit recommendations in our database for your selected outfit categories and preferences.",
      outfitCategories: eventCategories,
      outfitRecommendations: [],
      tabs: [], // Empty tabs array
      count: 0,
      message: "No outfit recommendations found in our database for your outfit categories."
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

