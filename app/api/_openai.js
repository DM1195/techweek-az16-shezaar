let OpenAI;
try {
  OpenAI = require('openai');
} catch {
  OpenAI = null;
}

function getOpenAI() {
  if (!OpenAI || !process.env.OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

module.exports = { getOpenAI };

