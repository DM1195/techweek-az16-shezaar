#!/usr/bin/env node

// Data Quality Analyzer and Fixer for SF Tech Week Events
// This script analyzes and fixes data quality issues across all industries and use cases

require('dotenv').config();
const { getSupabaseClient } = require('./api/_supabase');

// Define keyword mappings for automatic tag detection
const KEYWORD_MAPPINGS = {
  // Usage tag keywords
  usage: {
    'meeting-investors': ['investor', 'vc', 'venture capital', 'funding', 'angel', 'capital', 'investment', 'pitch', 'demo day', 'fundraising'],
    'connecting-investors': ['investor networking', 'vc networking', 'investor connect', 'funding', 'investment'],
    'meeting-founders': ['founder', 'co-founder', 'cofounder', 'entrepreneur', 'startup', 'entrepreneurship', 'founders'],
    'meeting-people': ['networking', 'meet', 'connect', 'social', 'community', 'people'],
    'business-pitching': ['pitch', 'pitching', 'presentation', 'demo', 'showcase', 'pitch night', 'demo day'],
    'product-demos': ['demo', 'demos', 'showcase', 'product launch', 'presentation', 'demo day'],
    'learning': ['learn', 'learning', 'education', 'workshop', 'training', 'skill', 'development'],
    'women-specific': ['women', 'female', 'diversity', 'women in tech', 'female founders', 'women entrepreneurs']
  },
  
  // Industry tag keywords
  industry: {
    'healthtech': ['health', 'healthcare', 'medical', 'health tech', 'digital health', 'medtech', 'clinical', 'therapeutics'],
    'biotech': ['biotech', 'biotechnology', 'life sciences', 'pharmaceutical', 'medical device', 'pharma'],
    'fintech': ['fintech', 'financial technology', 'payments', 'banking', 'crypto', 'cryptocurrency', 'finance'],
    'ai': ['ai', 'artificial intelligence', 'machine learning', 'ml', 'deep learning', 'neural network'],
    'cybersecurity': ['cybersecurity', 'security', 'privacy', 'data protection', 'compliance', 'infosec'],
    'sustainability': ['sustainability', 'climate tech', 'green tech', 'clean energy', 'environmental', 'climate'],
    'blockchain': ['blockchain', 'web3', 'defi', 'nft', 'smart contract', 'cryptocurrency'],
    'fashion-tech': ['fashion', 'fashion tech', 'retail', 'e-commerce', 'style', 'apparel', 'clothing'],
    'food-tech': ['food tech', 'agtech', 'food delivery', 'agriculture', 'food technology', 'foodtech'],
    'space': ['space', 'aerospace', 'satellite', 'space tech', 'space technology'],
    'robotics': ['robotics', 'automation', 'industrial tech', 'robot', 'automated'],
    'edtech': ['edtech', 'education tech', 'learning', 'education', 'training', 'e-learning']
  }
};

class DataQualityAnalyzer {
  constructor() {
    this.supabase = getSupabaseClient();
    this.issues = [];
    this.fixes = [];
  }

  async analyzeAllEvents() {
    console.log('🔍 Analyzing all events for data quality issues...\n');
    
    const { data, error } = await this.supabase
      .from('Event List')
      .select('event_name, usage_tags, industry_tags, event_tags, event_description, event_name_and_link')
      .limit(5000);
    
    if (error) {
      console.error('❌ Error fetching events:', error);
      return;
    }
    
    console.log(`📊 Analyzing ${data.length} events...\n`);
    
    // Analyze each event
    for (const event of data) {
      await this.analyzeEvent(event);
    }
    
    this.printSummary();
  }

  async analyzeEvent(event) {
    const issues = [];
    const suggestedFixes = [];
    
    const description = (event.event_description || '').toLowerCase();
    const name = (event.event_name || '').toLowerCase();
    const allText = `${name} ${description}`;
    
    const currentUsageTags = event.usage_tags || [];
    const currentIndustryTags = event.industry_tags || [];
    const currentEventTags = event.event_tags || [];
    const allIndustryTags = [...currentIndustryTags, ...currentEventTags];
    
    // Check for missing usage tags based on content
    for (const [tag, keywords] of Object.entries(KEYWORD_MAPPINGS.usage)) {
      const hasContent = keywords.some(keyword => allText.includes(keyword));
      const hasTag = currentUsageTags.includes(tag);
      
      if (hasContent && !hasTag) {
        issues.push(`Missing usage tag: ${tag} (content suggests this tag)`);
        suggestedFixes.push({
          type: 'add_usage_tag',
          tag: tag,
          reason: `Content contains keywords: ${keywords.filter(k => allText.includes(k)).join(', ')}`
        });
      }
    }
    
    // Check for missing industry tags based on content
    for (const [tag, keywords] of Object.entries(KEYWORD_MAPPINGS.industry)) {
      const hasContent = keywords.some(keyword => allText.includes(keyword));
      const hasTag = allIndustryTags.includes(tag);
      
      if (hasContent && !hasTag) {
        issues.push(`Missing industry tag: ${tag} (content suggests this tag)`);
        suggestedFixes.push({
          type: 'add_industry_tag',
          tag: tag,
          reason: `Content contains keywords: ${keywords.filter(k => allText.includes(k)).join(', ')}`
        });
      }
    }
    
    // Check for events with no usage tags
    if (currentUsageTags.length === 0) {
      issues.push('No usage tags assigned');
      suggestedFixes.push({
        type: 'add_default_usage_tags',
        reason: 'Event has no usage tags - needs basic categorization'
      });
    }
    
    // Check for events with no industry tags
    if (allIndustryTags.length === 0) {
      issues.push('No industry tags assigned');
      suggestedFixes.push({
        type: 'add_default_industry_tags',
        reason: 'Event has no industry tags - needs basic categorization'
      });
    }
    
    if (issues.length > 0) {
      this.issues.push({
        event: event.event_name,
        eventId: event.event_name_and_link,
        issues: issues,
        fixes: suggestedFixes
      });
    }
  }

  printSummary() {
    console.log('📋 DATA QUALITY ANALYSIS SUMMARY\n');
    console.log(`Total events analyzed: ${this.issues.length} events with issues\n`);
    
    // Group issues by type
    const issueTypes = {};
    this.issues.forEach(eventIssue => {
      eventIssue.issues.forEach(issue => {
        const type = issue.split(':')[0];
        issueTypes[type] = (issueTypes[type] || 0) + 1;
      });
    });
    
    console.log('Issue types found:');
    Object.entries(issueTypes)
      .sort(([,a], [,b]) => b - a)
      .forEach(([type, count]) => {
        console.log(`  ${type}: ${count} events`);
      });
    
    console.log('\nTop 10 events with most issues:');
    this.issues
      .sort((a, b) => b.issues.length - a.issues.length)
      .slice(0, 10)
      .forEach((eventIssue, i) => {
        console.log(`  ${i+1}. ${eventIssue.event} (${eventIssue.issues.length} issues)`);
        eventIssue.issues.slice(0, 3).forEach(issue => {
          console.log(`     - ${issue}`);
        });
        if (eventIssue.issues.length > 3) {
          console.log(`     ... and ${eventIssue.issues.length - 3} more`);
        }
      });
  }

  async applyFixes(dryRun = true) {
    console.log(`\n🔧 ${dryRun ? 'DRY RUN: ' : ''}Applying fixes...\n`);
    
    let fixedCount = 0;
    let errorCount = 0;
    
    for (const eventIssue of this.issues) {
      try {
        const updates = this.generateUpdates(eventIssue);
        
        if (Object.keys(updates).length > 0) {
          if (dryRun) {
            console.log(`Would fix: ${eventIssue.event}`);
            console.log(`  Updates: ${JSON.stringify(updates, null, 2)}`);
          } else {
            const { error } = await this.supabase
              .from('Event List')
              .update(updates)
              .eq('event_name_and_link', eventIssue.eventId);
            
            if (error) {
              console.error(`❌ Error fixing ${eventIssue.event}:`, error.message);
              errorCount++;
            } else {
              console.log(`✅ Fixed: ${eventIssue.event}`);
              fixedCount++;
            }
          }
        }
      } catch (err) {
        console.error(`❌ Error processing ${eventIssue.event}:`, err.message);
        errorCount++;
      }
    }
    
    console.log(`\n📊 Fix Summary:`);
    console.log(`  Events processed: ${this.issues.length}`);
    console.log(`  Events fixed: ${fixedCount}`);
    console.log(`  Errors: ${errorCount}`);
  }

  generateUpdates(eventIssue) {
    const updates = {};
    const newUsageTags = [...(eventIssue.event?.usage_tags || [])];
    const newIndustryTags = [...(eventIssue.event?.industry_tags || [])];
    
    for (const fix of eventIssue.fixes) {
      switch (fix.type) {
        case 'add_usage_tag':
          if (!newUsageTags.includes(fix.tag)) {
            newUsageTags.push(fix.tag);
          }
          break;
        case 'add_industry_tag':
          if (!newIndustryTags.includes(fix.tag)) {
            newIndustryTags.push(fix.tag);
          }
          break;
        case 'add_default_usage_tags':
          if (newUsageTags.length === 0) {
            newUsageTags.push('meeting-people', 'networking');
          }
          break;
        case 'add_default_industry_tags':
          if (newIndustryTags.length === 0) {
            newIndustryTags.push('technology', 'startup');
          }
          break;
      }
    }
    
    if (newUsageTags.length > 0) {
      updates.usage_tags = newUsageTags;
    }
    if (newIndustryTags.length > 0) {
      updates.industry_tags = newIndustryTags;
    }
    
    // Update timestamp to make event appear in recent results
    updates.updated_at = new Date().toISOString();
    
    return updates;
  }

  async createMonitoringScript() {
    const monitoringScript = `#!/usr/bin/env node

// Automated Data Quality Monitoring Script
// Run this script regularly to detect and fix data quality issues

const { DataQualityAnalyzer } = require('./data-quality-analyzer');

async function monitor() {
  const analyzer = new DataQualityAnalyzer();
  
  console.log('🔍 Running data quality monitoring...');
  await analyzer.analyzeAllEvents();
  
  // Only apply fixes if there are critical issues
  const criticalIssues = analyzer.issues.filter(issue => 
    issue.issues.some(i => i.includes('No usage tags') || i.includes('No industry tags'))
  );
  
  if (criticalIssues.length > 0) {
    console.log(\`\\n⚠️ Found \${criticalIssues.length} critical issues. Applying fixes...\`);
    await analyzer.applyFixes(false);
  } else {
    console.log('\\n✅ No critical issues found. Data quality is good!');
  }
}

monitor().catch(console.error);
`;
    
    require('fs').writeFileSync('/Users/durvamathure/Downloads/tech-week/monitor-data-quality.js', monitoringScript);
    console.log('📝 Created monitoring script: monitor-data-quality.js');
  }
}

// Main execution
async function main() {
  const analyzer = new DataQualityAnalyzer();
  
  const args = process.argv.slice(2);
  const command = args[0] || 'analyze';
  
  switch (command) {
    case 'analyze':
      await analyzer.analyzeAllEvents();
      break;
    case 'fix':
      await analyzer.analyzeAllEvents();
      await analyzer.applyFixes(false);
      break;
    case 'dry-run':
      await analyzer.analyzeAllEvents();
      await analyzer.applyFixes(true);
      break;
    case 'monitor':
      await analyzer.createMonitoringScript();
      break;
    default:
      console.log('Usage: node data-quality-analyzer.js [analyze|fix|dry-run|monitor]');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { DataQualityAnalyzer };
