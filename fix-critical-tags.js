#!/usr/bin/env node

// Critical Tag Fixer - Focuses on the most important missing tags
require('dotenv').config();
const { getSupabaseClient } = require('./api/_supabase');

class CriticalTagFixer {
  constructor() {
    this.supabase = getSupabaseClient();
    this.fixedCount = 0;
    this.errorCount = 0;
  }

  async fixCriticalIssues() {
    console.log('🔧 Fixing critical data quality issues...\n');
    
    // Get all events
    const { data, error } = await this.supabase
      .from('Event List')
      .select('event_name, usage_tags, industry_tags, event_tags, event_description, event_name_and_link')
      .limit(1000);
    
    if (error) {
      console.error('❌ Error fetching events:', error);
      return;
    }
    
    console.log(`📊 Processing ${data.length} events...\n`);
    
    // Process events in batches to avoid overwhelming the database
    const batchSize = 50;
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      await this.processBatch(batch);
      
      // Progress indicator
      if (i % 200 === 0) {
        console.log(`Processed ${i}/${data.length} events...`);
      }
    }
    
    console.log(`\n📊 Fix Summary:`);
    console.log(`  Events fixed: ${this.fixedCount}`);
    console.log(`  Errors: ${this.errorCount}`);
  }

  async processBatch(events) {
    for (const event of events) {
      try {
        const updates = this.generateCriticalUpdates(event);
        
        if (Object.keys(updates).length > 0) {
          const { error } = await this.supabase
            .from('Event List')
            .update(updates)
            .eq('event_name_and_link', event.event_name_and_link);
          
          if (error) {
            console.error(`❌ Error fixing ${event.event_name}:`, error.message);
            this.errorCount++;
          } else {
            this.fixedCount++;
          }
        }
      } catch (err) {
        console.error(`❌ Error processing ${event.event_name}:`, err.message);
        this.errorCount++;
      }
    }
  }

  generateCriticalUpdates(event) {
    const updates = {};
    const description = (event.event_description || '').toLowerCase();
    const name = (event.event_name || '').toLowerCase();
    const allText = `${name} ${description}`;
    
    const currentUsageTags = event.usage_tags || [];
    const currentIndustryTags = event.industry_tags || [];
    const currentEventTags = event.event_tags || [];
    const allIndustryTags = [...currentIndustryTags, ...currentEventTags];
    
    const newUsageTags = [...currentUsageTags];
    const newIndustryTags = [...currentIndustryTags];
    
    // Critical usage tag fixes
    if (allText.includes('investor') || allText.includes('vc') || allText.includes('funding') || allText.includes('angel')) {
      if (!newUsageTags.includes('meeting-investors')) {
        newUsageTags.push('meeting-investors');
      }
    }
    
    if (allText.includes('founder') || allText.includes('co-founder') || allText.includes('entrepreneur')) {
      if (!newUsageTags.includes('meeting-founders')) {
        newUsageTags.push('meeting-founders');
      }
    }
    
    if (allText.includes('pitch') || allText.includes('demo') || allText.includes('showcase')) {
      if (!newUsageTags.includes('business-pitching')) {
        newUsageTags.push('business-pitching');
      }
    }
    
    if (allText.includes('networking') || allText.includes('meet') || allText.includes('connect')) {
      if (!newUsageTags.includes('meeting-people')) {
        newUsageTags.push('meeting-people');
      }
    }
    
    if (allText.includes('women') || allText.includes('female')) {
      if (!newUsageTags.includes('women-specific')) {
        newUsageTags.push('women-specific');
      }
    }
    
    // Critical industry tag fixes
    if (allText.includes('health') || allText.includes('healthcare') || allText.includes('medical')) {
      if (!allIndustryTags.includes('healthtech')) {
        newIndustryTags.push('healthtech');
      }
    }
    
    if (allText.includes('ai') || allText.includes('artificial intelligence') || allText.includes('machine learning')) {
      if (!allIndustryTags.includes('ai')) {
        newIndustryTags.push('ai');
      }
    }
    
    if (allText.includes('fintech') || allText.includes('financial') || allText.includes('payments') || allText.includes('banking')) {
      if (!allIndustryTags.includes('fintech')) {
        newIndustryTags.push('fintech');
      }
    }
    
    if (allText.includes('startup') || allText.includes('entrepreneur')) {
      if (!allIndustryTags.includes('startup')) {
        newIndustryTags.push('startup');
      }
    }
    
    if (allText.includes('blockchain') || allText.includes('web3') || allText.includes('crypto')) {
      if (!allIndustryTags.includes('blockchain')) {
        newIndustryTags.push('blockchain');
      }
    }
    
    // Add default tags if none exist
    if (newUsageTags.length === 0) {
      newUsageTags.push('meeting-people', 'networking');
    }
    
    if (newIndustryTags.length === 0) {
      newIndustryTags.push('technology', 'startup');
    }
    
    // Only update if there are changes
    if (newUsageTags.length !== currentUsageTags.length || 
        newIndustryTags.length !== currentIndustryTags.length ||
        !newUsageTags.every(tag => currentUsageTags.includes(tag)) ||
        !newIndustryTags.every(tag => currentIndustryTags.includes(tag))) {
      
      updates.usage_tags = newUsageTags;
      updates.industry_tags = newIndustryTags;
      updates.updated_at = new Date().toISOString();
    }
    
    return updates;
  }
}

// Main execution
async function main() {
  const fixer = new CriticalTagFixer();
  await fixer.fixCriticalIssues();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { CriticalTagFixer };
