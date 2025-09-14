// Tag Validation and Consistency System for SF Tech Week Event Recommendations
const { USAGE_TAGS, INDUSTRY_TAGS, TAG_RELATIONSHIPS } = require('./tag-config');

// Use centralized tag configurations
const VALID_USAGE_TAGS = USAGE_TAGS;
const VALID_INDUSTRY_TAGS = INDUSTRY_TAGS;

// Validation functions
function validateUsageTags(tags) {
  const errors = [];
  const warnings = [];
  const validTags = [];
  
  if (!Array.isArray(tags)) {
    errors.push('Usage tags must be an array');
    return { valid: false, errors, warnings, validTags };
  }
  
  tags.forEach(tag => {
    if (typeof tag !== 'string') {
      errors.push(`Usage tag must be a string: ${tag}`);
      return;
    }
    
    const normalizedTag = tag.toLowerCase().trim();
    if (VALID_USAGE_TAGS[normalizedTag]) {
      validTags.push(normalizedTag);
    } else {
      warnings.push(`Unknown usage tag: ${tag}. Consider using one of: ${Object.keys(VALID_USAGE_TAGS).join(', ')}`);
    }
  });
  
  // Check for conflicting tags
  if (validTags.includes('find-investors') && validTags.includes('find-angels')) {
    warnings.push('Both find-investors and find-angels specified - these are complementary, not conflicting');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    validTags
  };
}

function validateIndustryTags(tags) {
  const errors = [];
  const warnings = [];
  const validTags = [];
  
  if (!Array.isArray(tags)) {
    errors.push('Industry tags must be an array');
    return { valid: false, errors, warnings, validTags };
  }
  
  tags.forEach(tag => {
    if (typeof tag !== 'string') {
      errors.push(`Industry tag must be a string: ${tag}`);
      return;
    }
    
    const normalizedTag = tag.toLowerCase().trim();
    if (VALID_INDUSTRY_TAGS[normalizedTag]) {
      validTags.push(normalizedTag);
    } else {
      warnings.push(`Unknown industry tag: ${tag}. Consider using one of: ${Object.keys(VALID_INDUSTRY_TAGS).join(', ')}`);
    }
  });
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    validTags
  };
}

function validateEventTags(event) {
  const usageValidation = validateUsageTags(event.usage_tags || []);
  const industryValidation = validateIndustryTags(event.industry_tags || []);
  
  return {
    usage: usageValidation,
    industry: industryValidation,
    overall: usageValidation.valid && industryValidation.valid
  };
}

function suggestRelatedTags(tags, tagType = 'usage') {
  const validTags = tagType === 'usage' ? VALID_USAGE_TAGS : VALID_INDUSTRY_TAGS;
  const relationships = TAG_RELATIONSHIPS;
  const suggestions = [];
  
  tags.forEach(tag => {
    if (relationships[tag]) {
      relationships[tag].forEach(relatedTag => {
        if (validTags[relatedTag] && !tags.includes(relatedTag)) {
          suggestions.push({
            tag: relatedTag,
            reason: `Often goes with ${tag}`,
            weight: validTags[relatedTag].weight
          });
        }
      });
    }
  });
  
  return suggestions.sort((a, b) => b.weight - a.weight);
}

function calculateTagScore(usageTags, industryTags) {
  let score = 0;
  const breakdown = [];
  
  // Calculate usage tag score
  usageTags.forEach(tag => {
    const tagInfo = VALID_USAGE_TAGS[tag];
    if (tagInfo) {
      score += tagInfo.weight;
      breakdown.push(`${tag}: +${tagInfo.weight}`);
    }
  });
  
  // Calculate industry tag score
  industryTags.forEach(tag => {
    const tagInfo = VALID_INDUSTRY_TAGS[tag];
    if (tagInfo) {
      score += tagInfo.weight;
      breakdown.push(`${tag}: +${tagInfo.weight}`);
    }
  });
  
  // Bonus for complementary tags
  const complementaryBonus = calculateComplementaryBonus(usageTags, industryTags);
  if (complementaryBonus > 0) {
    score += complementaryBonus;
    breakdown.push(`Complementary bonus: +${complementaryBonus}`);
  }
  
  return { score, breakdown };
}

function calculateComplementaryBonus(usageTags, industryTags) {
  let bonus = 0;
  
  // Check for complementary usage tags
  if (usageTags.includes('find-investors') && usageTags.includes('pitch-opportunities')) {
    bonus += 25;
  }
  if (usageTags.includes('find-cofounder') && usageTags.includes('networking')) {
    bonus += 25;
  }
  if (usageTags.includes('find-talent') && usageTags.includes('networking')) {
    bonus += 25;
  }
  
  // Check for complementary industry tags
  if (industryTags.includes('ai-ml') && industryTags.includes('fintech')) {
    bonus += 15;
  }
  if (industryTags.includes('blockchain') && industryTags.includes('sustainability')) {
    bonus += 15;
  }
  
  return bonus;
}

// Export functions
module.exports = {
  VALID_USAGE_TAGS,
  VALID_INDUSTRY_TAGS,
  TAG_RELATIONSHIPS,
  validateUsageTags,
  validateIndustryTags,
  validateEventTags,
  suggestRelatedTags,
  calculateTagScore,
  calculateComplementaryBonus
};
