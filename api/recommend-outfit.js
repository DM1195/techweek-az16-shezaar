const { getSupabaseClient } = require('./_supabase');
const { getOpenAI } = require('./_openai');

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
      .from('Outfit Recommendations')
      .select('*')
      .in('event_category', eventCategories);

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
      return [];
    }

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const { message, gender, currentEvents } = req.body;
    
    if (!message) {
      return res.status(400).json({ ok: false, error: 'Message is required' });
    }

    // Use current events from frontend if provided, otherwise fetch them
    let recommendedEvents = currentEvents || [];
    
    if (recommendedEvents.length === 0) {
      recommendedEvents = await getRecommendedEvents(message);
    }
    
    if (recommendedEvents.length === 0) {
      return res.status(200).json({ 
        ok: true, 
        recommendation: "No events found to base outfit recommendations on.",
        reasoning: "We couldn't find any events matching your criteria to generate outfit recommendations.",
        eventCategories: [],
        outfitRecommendations: []
      });
    }

    // Extract unique event categories from recommended events
    const eventCategories = [...new Set(recommendedEvents.map(event => event.event_category).filter(Boolean))];
    
    if (eventCategories.length === 0) {
      return res.status(200).json({ 
        ok: true, 
        recommendation: "No event categories found to base outfit recommendations on.",
        reasoning: "We couldn't determine the event categories for your recommended events.",
        eventCategories: [],
        outfitRecommendations: []
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
        const outfitRecommendation = generateOutfitFromStyleAndComfort(rec.event_category, rec.gender, rec.body_comfort, gender);
        
        return {
          event_category: rec.event_category,
          outfit_recommendation: rec.recommendation || outfitRecommendation, // Use database recommendation if available
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
        outfitRecommendations: mappedRecommendations
      });
    }

    // No outfit recommendations found in database
    return res.status(200).json({ 
      ok: true, 
      recommendation: "No specific outfit recommendations found for your event categories.",
      reasoning: "We couldn't find outfit recommendations in our database for your selected event categories and preferences.",
      eventCategories: eventCategories,
      outfitRecommendations: []
    });

  } catch (error) {
    console.error('Error generating outfit recommendation:', error);
    
    res.status(500).json({ 
      ok: false, 
      error: 'Failed to generate outfit recommendation',
      recommendation: "Sorry, we encountered an error while generating your outfit recommendation. Please try again later.",
      reasoning: "An error occurred while processing your request.",
      eventCategories: []
    });
  }
}

