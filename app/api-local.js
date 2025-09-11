// Simple local API for testing without Vercel
const fs = require('fs');
const path = require('path');

// Load events data
const eventsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'events.json'), 'utf8'));

// Simple recommendation function
function recommendEvents(message, limit = 10) {
  const keywords = message.toLowerCase();
  
  // Simple keyword matching
  const scoredEvents = eventsData.map(event => {
    let score = 0;
    const text = `${event.event_name} ${event.event_description} ${event.hosted_by}`.toLowerCase();
    
    // Score based on keyword matches
    if (keywords.includes('ai') && text.includes('ai')) score += 3;
    if (keywords.includes('startup') && text.includes('startup')) score += 2;
    if (keywords.includes('founder') && text.includes('founder')) score += 2;
    if (keywords.includes('investor') && text.includes('investor')) score += 2;
    if (keywords.includes('evening') && event.event_time && event.event_time.includes('pm')) score += 1;
    if (keywords.includes('free') && event.price === 'Free') score += 1;
    
    return { ...event, score };
  });
  
  // Sort by score and return top results
  return scoredEvents
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(event => ({
      name: event.event_name,
      date: event.event_date,
      time: event.event_time,
      location: event.event_location,
      price: event.price,
      host: event.hosted_by,
      url: event.event_url,
      description: event.event_description
    }));
}

// Export for use in HTML
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { recommendEvents };
}

// For browser use
if (typeof window !== 'undefined') {
  window.recommendEvents = recommendEvents;
}
