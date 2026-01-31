#!/usr/bin/env node

/**
 * Seed the registry with demo agents
 * Usage: node scripts/seed.js [API_URL]
 */

const API_URL = process.argv[2] || 'http://localhost:3000';

const demoAgents = [
  {
    agent_name: 'weather-service',
    org: 'weatherco',
    public_key: 'ed25519:demo_weather_key_abc123',
    endpoint: 'https://api.weatherco.example/moltspeak',
    description: 'Real-time weather data and forecasts for any location worldwide',
    capabilities: ['weather', 'forecast', 'alerts', 'historical']
  },
  {
    agent_name: 'translator',
    org: 'langbridge',
    public_key: 'ed25519:demo_translate_key_def456',
    endpoint: 'https://langbridge.example/agent',
    description: 'Multi-language translation supporting 100+ languages',
    capabilities: ['translate', 'detect-language', 'transliterate']
  },
  {
    agent_name: 'research-assistant',
    org: 'openclaw',
    public_key: 'ed25519:demo_research_key_ghi789',
    endpoint: null,
    description: 'Academic research assistant with paper search and summarization',
    capabilities: ['research', 'summarize', 'cite', 'arxiv', 'scholar']
  },
  {
    agent_name: 'calendar-agent',
    org: 'schedulebot',
    public_key: 'ed25519:demo_calendar_key_jkl012',
    endpoint: 'https://schedulebot.example/moltspeak',
    description: 'Calendar management and meeting scheduling',
    capabilities: ['calendar', 'schedule', 'availability', 'reminders']
  },
  {
    agent_name: 'code-reviewer',
    org: 'devtools',
    public_key: 'ed25519:demo_code_key_mno345',
    endpoint: 'https://devtools.example/review',
    description: 'Automated code review with security and style checks',
    capabilities: ['code-review', 'security-scan', 'lint', 'suggest']
  },
  {
    agent_name: 'news-aggregator',
    org: 'newsflow',
    public_key: 'ed25519:demo_news_key_pqr678',
    endpoint: 'https://newsflow.example/agent',
    description: 'News aggregation from trusted sources with topic filtering',
    capabilities: ['news', 'headlines', 'search', 'summarize', 'topics']
  },
  {
    agent_name: 'image-analyzer',
    org: 'visionai',
    public_key: 'ed25519:demo_vision_key_stu901',
    endpoint: 'https://visionai.example/analyze',
    description: 'Image analysis, OCR, and visual question answering',
    capabilities: ['vision', 'ocr', 'describe', 'classify', 'detect']
  },
  {
    agent_name: 'data-analyst',
    org: 'analytix',
    public_key: 'ed25519:demo_data_key_vwx234',
    endpoint: 'https://analytix.example/moltspeak',
    description: 'Data analysis, visualization, and statistical insights',
    capabilities: ['analyze', 'visualize', 'statistics', 'csv', 'charts']
  }
];

async function seed() {
  console.log(`🦞 Seeding registry at ${API_URL}\n`);
  
  for (const agent of demoAgents) {
    try {
      const res = await fetch(`${API_URL}/api/v1/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(agent)
      });
      
      const data = await res.json();
      
      if (res.ok) {
        console.log(`✅ ${agent.agent_name}@${agent.org}`);
      } else if (res.status === 409) {
        console.log(`⏭️  ${agent.agent_name}@${agent.org} (already exists)`);
      } else {
        console.log(`❌ ${agent.agent_name}@${agent.org}: ${data.error}`);
      }
    } catch (err) {
      console.log(`❌ ${agent.agent_name}@${agent.org}: ${err.message}`);
    }
  }
  
  console.log('\n✨ Seeding complete!');
}

seed();
