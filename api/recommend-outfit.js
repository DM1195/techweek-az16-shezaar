const { getSupabaseClient } = require('./_supabase');
const { getOpenAI } = require('./_openai');
const fs = require('fs');
const path = require('path');

// Load outfit recommendations from CSV
function loadOutfitRecommendations() {
  try {
    const csvPath = path.join(process.cwd(), 'outfit-recommendations.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    const recommendations = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      // Simple CSV parsing - find the first two commas to split into 3 parts
      const firstComma = line.indexOf(',');
      const secondComma = line.indexOf(',', firstComma + 1);
      
      if (firstComma !== -1 && secondComma !== -1) {
        recommendations.push({
          event_type: line.substring(0, firstComma),
          outfit_recommendation: line.substring(firstComma + 1, secondComma),
          reasoning: line.substring(secondComma + 1)
        });
      }
    }
    
    return recommendations;
  } catch (error) {
    console.error('Error loading outfit recommendations:', error);
    return [];
  }
}

// Analyze message to determine event types
function analyzeEventTypes(message) {
  const lowerMessage = message.toLowerCase();
  const eventTypes = [];
  
  if (lowerMessage.includes('investor') || lowerMessage.includes('angel') || lowerMessage.includes('funding') || lowerMessage.includes('vc')) {
    eventTypes.push('investor_meeting');
  }
  if (lowerMessage.includes('co-founder') || lowerMessage.includes('cofounder') || lowerMessage.includes('founder')) {
    eventTypes.push('co_founder_meetup');
  }
  if (lowerMessage.includes('startup') || lowerMessage.includes('pitch') || lowerMessage.includes('pitching')) {
    eventTypes.push('startup_pitch');
  }
  if (lowerMessage.includes('networking') || lowerMessage.includes('network')) {
    eventTypes.push('networking_event');
  }
  if (lowerMessage.includes('tech') || lowerMessage.includes('technology')) {
    eventTypes.push('tech_meetup');
  }
  if (lowerMessage.includes('wellness') || lowerMessage.includes('health') || lowerMessage.includes('fitness')) {
    eventTypes.push('wellness_tech');
  }
  if (lowerMessage.includes('fintech') || lowerMessage.includes('financial') || lowerMessage.includes('fintech')) {
    eventTypes.push('fintech');
  }
  if (lowerMessage.includes('ai') || lowerMessage.includes('artificial intelligence') || lowerMessage.includes('machine learning') || lowerMessage.includes('ml')) {
    eventTypes.push('ai_ml');
  }
  if (lowerMessage.includes('sustainability') || lowerMessage.includes('sustainable') || lowerMessage.includes('green') || lowerMessage.includes('climate')) {
    eventTypes.push('sustainability');
  }
  if (lowerMessage.includes('healthcare') || lowerMessage.includes('health care') || lowerMessage.includes('medical')) {
    eventTypes.push('healthcare_tech');
  }
  
  return eventTypes.length > 0 ? eventTypes : ['networking_event']; // Default to networking if no specific type detected
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

    // Load outfit recommendations from CSV
    const outfitRecommendations = loadOutfitRecommendations();
    const eventTypes = analyzeEventTypes(message);
    
    // Find matching recommendations
    const matchingRecommendations = outfitRecommendations.filter(rec => 
      eventTypes.includes(rec.event_type)
    );
    
    if (matchingRecommendations.length > 0) {
      // Use the first matching recommendation
      const recommendation = matchingRecommendations[0];
      return res.status(200).json({ 
        ok: true, 
        recommendation: recommendation.outfit_recommendation,
        reasoning: recommendation.reasoning,
        eventTypes: eventTypes
      });
    }

    const openai = getOpenAI();
    
    if (!openai) {
      // Fallback recommendation without OpenAI
      const fallbackRecommendation = generateFallbackOutfitRecommendation(message);
      return res.status(200).json({ 
        ok: true, 
        recommendation: fallbackRecommendation,
        reasoning: "Based on your description, here's a general outfit recommendation for SF Tech Week events."
      });
    }

    // Use OpenAI to generate outfit recommendation
    const systemPrompt = `You are a fashion consultant specializing in SF Tech Week events. Based on the user's goals and the type of events they're attending, recommend appropriate outfits.

Consider:
- Professional networking events (business casual to smart casual)
- Startup pitch events (professional but approachable)
- Tech meetups (casual to business casual)
- Investor meetings (professional)
- Co-founder meetups (smart casual)
- Industry-specific events (appropriate for that industry)

Provide:
1. A specific outfit recommendation with clothing items
2. Brief reasoning for why this outfit works for their goals
3. Consider the SF climate and tech culture

Keep recommendations practical and achievable.`;

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      max_tokens: 500,
      temperature: 0.7
    });

    const response = completion.choices[0]?.message?.content || '';
    
    // Parse the response to extract recommendation and reasoning
    const lines = response.split('\n').filter(line => line.trim());
    let recommendation = '';
    let reasoning = '';
    
    // Simple parsing - look for key sections
    let currentSection = 'recommendation';
    for (const line of lines) {
      if (line.toLowerCase().includes('reasoning') || line.toLowerCase().includes('why')) {
        currentSection = 'reasoning';
        continue;
      }
      if (currentSection === 'recommendation') {
        recommendation += line + ' ';
      } else {
        reasoning += line + ' ';
      }
    }

    res.status(200).json({ 
      ok: true, 
      recommendation: recommendation.trim() || response,
      reasoning: reasoning.trim() || "This outfit is recommended based on your goals and the types of events you're planning to attend."
    });

  } catch (error) {
    console.error('Error generating outfit recommendation:', error);
    
    // Fallback recommendation
    const fallbackRecommendation = generateFallbackOutfitRecommendation(req.body.message || '');
    
    res.status(200).json({ 
      ok: true, 
      recommendation: fallbackRecommendation,
      reasoning: "Here's a general outfit recommendation for SF Tech Week events."
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
