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
    const { message, gender } = req.body;
    
    if (!message) {
      return res.status(400).json({ ok: false, error: 'Message is required' });
    }

    // Get recommended events to extract their categories
    const recommendedEvents = await getRecommendedEvents(message);
    
    if (recommendedEvents.length === 0) {
      // Fallback if no events found
      const fallbackRecommendation = generateFallbackOutfitRecommendation(message, gender);
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
      const fallbackRecommendation = generateFallbackOutfitRecommendation(message, gender);
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
    const fallbackRecommendation = generateFallbackOutfitRecommendation(message, gender);
    return res.status(200).json({ 
      ok: true, 
      recommendation: fallbackRecommendation,
      reasoning: "Based on your description, here's a general outfit recommendation for SF Tech Week events.",
      eventCategories: eventCategories
    });

  } catch (error) {
    console.error('Error generating outfit recommendation:', error);
    
    // Fallback recommendation
    const fallbackRecommendation = generateFallbackOutfitRecommendation(req.body.message || '', req.body.gender);
    
    res.status(200).json({ 
      ok: true, 
      recommendation: fallbackRecommendation,
      reasoning: "Here's a general outfit recommendation for SF Tech Week events.",
      eventCategories: ['General']
    });
  }
}

function generateFallbackOutfitRecommendation(message, gender) {
  const lowerMessage = message.toLowerCase();
  
  // Gender-specific recommendations
  const isFemale = gender === 'female';
  const isMale = gender === 'male';
  const preferNotToSay = gender === 'prefer-not-to-say';
  
  if (lowerMessage.includes('investor') || lowerMessage.includes('angel') || lowerMessage.includes('funding')) {
    if (isFemale) {
      return "For investor meetings: A tailored blazer with dress pants or a professional dress, paired with closed-toe heels or professional flats. Consider a crisp white or light blue blouse, minimal jewelry, and a professional handbag. A structured blazer dress is also a great option for a polished look.";
    } else if (isMale) {
      return "For investor meetings: Dark navy or charcoal suit with a crisp white or light blue dress shirt, leather dress shoes, and a professional watch. Consider a blazer with dress pants for a slightly more relaxed but still professional look.";
    } else {
      return "For investor meetings: Professional business attire - a well-fitted suit or equivalent professional ensemble. Choose neutral colors like navy, charcoal, or black. Ensure clothing is clean, pressed, and fits well. Professional shoes and minimal accessories complete the look.";
    }
  } else if (lowerMessage.includes('co-founder') || lowerMessage.includes('startup') || lowerMessage.includes('pitch')) {
    if (isFemale) {
      return "For startup networking: Smart casual with dark jeans or well-fitted pants, a stylish blouse or button-down shirt, comfortable flats or low heels, and a chic blazer or cardigan. Consider a structured tote bag and minimal, elegant jewelry.";
    } else if (isMale) {
      return "For startup networking: Smart casual with dark jeans or chinos, a well-fitted button-down shirt or polo, clean sneakers or loafers, and a blazer. This strikes the right balance between professional and approachable.";
    } else {
      return "For startup networking: Smart casual attire that balances professionalism with approachability. Choose well-fitted, comfortable pieces in neutral colors. A blazer or cardigan can elevate the look while maintaining a friendly, accessible vibe.";
    }
  } else if (lowerMessage.includes('wellness') || lowerMessage.includes('health') || lowerMessage.includes('fitness')) {
    if (isFemale) {
      return "For wellness tech events: Business casual with comfortable yet professional pieces - dark jeans or tailored pants, a stylish sweater or blouse, comfortable flats or low boots, and a light cardigan or blazer. Consider athleisure-inspired pieces like a structured jogger or ponte pants.";
    } else if (isMale) {
      return "For wellness tech events: Business casual with comfortable yet professional pieces - dark jeans or chinos, a collared shirt or nice sweater, and clean sneakers or casual dress shoes. Consider athleisure-inspired pieces that reflect the wellness industry.";
    } else {
      return "For wellness tech events: Business casual with comfortable yet professional pieces that reflect the wellness industry. Choose breathable fabrics and comfortable footwear. Consider athleisure-inspired pieces that maintain a professional appearance.";
    }
  } else {
    if (isFemale) {
      return "For general SF Tech Week events: Smart casual attire works best - dark jeans or well-fitted pants, a stylish blouse or button-down shirt, comfortable flats or low heels, and a light jacket or blazer. This versatile look works for most tech events while keeping you comfortable and professional.";
    } else if (isMale) {
      return "For general SF Tech Week events: Smart casual attire works best - dark jeans or chinos, a button-down shirt or nice polo, clean sneakers or loafers, and a light jacket or blazer. This versatile look works for most tech events while keeping you comfortable.";
    } else {
      return "For general SF Tech Week events: Smart casual attire works best - well-fitted pants or jeans, a comfortable shirt or blouse, appropriate footwear, and a light jacket or cardigan. This versatile look works for most tech events while keeping you comfortable and professional.";
    }
  }
}
