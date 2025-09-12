const { getSupabaseClient } = require('./_supabase');
const { getOpenAI } = require('./_openai');

// Get outfit recommendations from Supabase based on event categories
async function getOutfitRecommendationsFromSupabase(eventCategories) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      console.error('Supabase client not available');
      return [];
    }

    // Get outfit recommendations for the given event categories
    const { data, error } = await supabase
      .from('Outfit Recommendations')
      .select('*')
      .in('event_category', eventCategories);

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
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ ok: false, error: 'Message is required' });
    }

    // Get recommended events to extract their categories
    const recommendedEvents = await getRecommendedEvents(message);
    
    if (recommendedEvents.length === 0) {
      // Fallback if no events found
      const fallbackRecommendation = generateFallbackOutfitRecommendation(message);
      return res.status(200).json({ 
        ok: true, 
        recommendation: fallbackRecommendation,
        reasoning: "Based on your description, here's a general outfit recommendation for SF Tech Week events.",
        eventCategories: ['General']
      });
    }

    // Extract unique event categories from recommended events
    const eventCategories = [...new Set(recommendedEvents.map(event => event.event_category).filter(Boolean))];
    
    if (eventCategories.length === 0) {
      // Fallback if no categories found
      const fallbackRecommendation = generateFallbackOutfitRecommendation(message);
      return res.status(200).json({ 
        ok: true, 
        recommendation: fallbackRecommendation,
        reasoning: "Based on your description, here's a general outfit recommendation for SF Tech Week events.",
        eventCategories: ['General']
      });
    }

    // Get outfit recommendations from Supabase for these categories
    const outfitRecommendations = await getOutfitRecommendationsFromSupabase(eventCategories);
    
    if (outfitRecommendations.length > 0) {
      // Combine all recommendations for the categories
      const combinedRecommendation = outfitRecommendations.map(rec => 
        `**${rec.event_category}**: ${rec.outfit_recommendation}`
      ).join('\n\n');
      
      const combinedReasoning = outfitRecommendations.map(rec => 
        `**${rec.event_category}**: ${rec.reasoning}`
      ).join('\n\n');
      
      return res.status(200).json({ 
        ok: true, 
        recommendation: combinedRecommendation,
        reasoning: combinedReasoning,
        eventCategories: eventCategories,
        outfitRecommendations: outfitRecommendations
      });
    }

    // Fallback if no outfit recommendations found in database
    const fallbackRecommendation = generateFallbackOutfitRecommendation(message);
    return res.status(200).json({ 
      ok: true, 
      recommendation: fallbackRecommendation,
      reasoning: "Based on your description, here's a general outfit recommendation for SF Tech Week events.",
      eventCategories: eventCategories
    });

  } catch (error) {
    console.error('Error generating outfit recommendation:', error);
    
    // Fallback recommendation
    const fallbackRecommendation = generateFallbackOutfitRecommendation(req.body.message || '');
    
    res.status(200).json({ 
      ok: true, 
      recommendation: fallbackRecommendation,
      reasoning: "Here's a general outfit recommendation for SF Tech Week events.",
      eventCategories: ['General']
    });
  }
}

function generateFallbackOutfitRecommendation(message) {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('investor') || lowerMessage.includes('angel') || lowerMessage.includes('funding')) {
    return "For investor meetings: Dark navy or charcoal suit with a crisp white or light blue dress shirt, leather dress shoes, and a professional watch. Consider a blazer with dress pants for a slightly more relaxed but still professional look.";
  } else if (lowerMessage.includes('co-founder') || lowerMessage.includes('startup') || lowerMessage.includes('pitch')) {
    return "For startup networking: Smart casual with dark jeans or chinos, a well-fitted button-down shirt or polo, clean sneakers or loafers, and a blazer. This strikes the right balance between professional and approachable.";
  } else if (lowerMessage.includes('wellness') || lowerMessage.includes('health') || lowerMessage.includes('fitness')) {
    return "For wellness tech events: Business casual with comfortable yet professional pieces - dark jeans or chinos, a collared shirt or nice sweater, and clean sneakers or casual dress shoes. Consider athleisure-inspired pieces that reflect the wellness industry.";
  } else {
    return "For general SF Tech Week events: Smart casual attire works best - dark jeans or chinos, a button-down shirt or nice polo, clean sneakers or loafers, and a light jacket or blazer. This versatile look works for most tech events while keeping you comfortable.";
  }
}
