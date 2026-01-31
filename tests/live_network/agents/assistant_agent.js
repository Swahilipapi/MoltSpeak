#!/usr/bin/env node
/**
 * Assistant Agent - MoltSpeak JavaScript SDK
 * 
 * The main routing agent that coordinates with specialist agents.
 * Routes queries to weather, research, and translation specialists.
 * Demonstrates JavaScript SDK message building and signing.
 */

'use strict';

const path = require('path');
const fs = require('fs');

// Load SDK
const sdkPath = path.join(__dirname, '..', '..', '..', 'sdk', 'js', 'moltspeak.js');
const moltspeak = require(sdkPath);

// ============================================================================
// Agent Identity
// ============================================================================

const IDENTITY = {
  agent: 'assistant-agent',
  org: 'moltspeak-network',
  key: 'ed25519:assistant_public_key_12345'
};
const PRIVATE_KEY = 'ed25519:assistant_private_key_12345';

// ============================================================================
// Specialist Agents
// ============================================================================

const SPECIALISTS = {
  weather: {
    agent: 'weather-agent',
    org: 'moltspeak-network',
    key: 'ed25519:weather_public_key_12345',
    domains: ['weather', 'forecast', 'temperature']
  },
  translate: {
    agent: 'translate-agent',
    org: 'moltspeak-network',
    key: 'ed25519:translate_public_key_12345',
    domains: ['translation', 'language', 'translate']
  },
  research: {
    agent: 'research-agent',
    org: 'moltspeak-network',
    key: 'ed25519:research_public_key_12345',
    domains: ['research', 'news', 'search', 'information']
  }
};

// ============================================================================
// Routing Logic
// ============================================================================

function routeQuery(text) {
  const lowerText = text.toLowerCase();
  
  // Check for weather-related keywords
  if (lowerText.includes('weather') || lowerText.includes('temperature') || 
      lowerText.includes('forecast') || lowerText.includes('rain')) {
    return { specialist: 'weather', domain: 'weather' };
  }
  
  // Check for translation-related keywords
  if (lowerText.includes('translat') || lowerText.includes('french') || 
      lowerText.includes('spanish') || lowerText.includes('german')) {
    return { specialist: 'translate', domain: 'translation' };
  }
  
  // Check for research-related keywords
  if (lowerText.includes('news') || lowerText.includes('research') || 
      lowerText.includes('latest') || lowerText.includes('find')) {
    return { specialist: 'research', domain: 'research' };
  }
  
  // Default to research for general queries
  return { specialist: 'research', domain: 'general' };
}

// ============================================================================
// Message Creation
// ============================================================================

function createQueryToSpecialist(specialist, queryParams) {
  const target = SPECIALISTS[specialist];
  if (!target) {
    throw new Error(`Unknown specialist: ${specialist}`);
  }
  
  const query = moltspeak.createQuery(
    {
      domain: queryParams.domain || specialist,
      intent: queryParams.intent || 'information',
      params: queryParams.params || {}
    },
    IDENTITY,
    target
  );
  
  return moltspeak.sign(query, PRIVATE_KEY);
}

function createTaskForSpecialist(specialist, taskDescription, constraints = {}) {
  const target = SPECIALISTS[specialist];
  if (!target) {
    throw new Error(`Unknown specialist: ${specialist}`);
  }
  
  const task = moltspeak.createTask(
    {
      description: taskDescription,
      type: specialist,
      constraints: constraints
    },
    IDENTITY,
    target
  );
  
  return moltspeak.sign(task, PRIVATE_KEY);
}

function handleResponse(message) {
  // Verify the response signature
  const senderKey = message.from?.key;
  if (senderKey && message.sig) {
    const isValid = moltspeak.verify(message, senderKey);
    if (!isValid) {
      console.warn(`WARNING: Invalid signature from ${message.from?.agent}`);
      return { error: 'Invalid signature', verified: false };
    }
  }
  
  // Extract response data
  const payload = message.p || {};
  return {
    status: payload.status || 'unknown',
    data: payload.data || payload,
    from: message.from?.agent,
    verified: true
  };
}

// ============================================================================
// Demo Functions
// ============================================================================

function demoRoutingWorkflow() {
  console.log('\n=== Assistant Agent Demo ===\n');
  
  // Demo 1: Weather query
  console.log('1. Creating weather query...');
  const weatherQuery = createQueryToSpecialist('weather', {
    domain: 'weather',
    intent: 'forecast',
    params: { location: 'Tokyo' }
  });
  console.log('   Query created and signed:', weatherQuery.id.slice(0, 8) + '...');
  
  // Demo 2: Translation task
  console.log('\n2. Creating translation task...');
  const translateTask = createTaskForSpecialist('translate', 
    "Translate 'hello' to French",
    { source: 'en', target: 'fr', text: 'hello' }
  );
  console.log('   Task created and signed:', translateTask.id.slice(0, 8) + '...');
  
  // Demo 3: Research query
  console.log('\n3. Creating research query...');
  const researchQuery = createQueryToSpecialist('research', {
    domain: 'research',
    intent: 'news',
    params: { topic: 'AI', recency: 'latest' }
  });
  console.log('   Query created and signed:', researchQuery.id.slice(0, 8) + '...');
  
  console.log('\n=== All messages created successfully ===');
  
  return { weatherQuery, translateTask, researchQuery };
}

// ============================================================================
// Main
// ============================================================================

console.log(`Assistant Agent (${IDENTITY.agent}) initialized`);
console.log(`SDK: JavaScript | Org: ${IDENTITY.org}`);
console.log(`Connected specialists: ${Object.keys(SPECIALISTS).join(', ')}`);

// Run demo if called directly
if (require.main === module) {
  if (process.argv[2] === '--demo') {
    demoRoutingWorkflow();
  } else if (process.argv[2]) {
    // Process a message file
    const msgFile = process.argv[2];
    const msgContent = fs.readFileSync(msgFile, 'utf8');
    const message = moltspeak.decode(msgContent, { validate: true });
    const result = handleResponse(message);
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('\nUsage:');
    console.log('  node assistant_agent.js --demo     Run routing demo');
    console.log('  node assistant_agent.js <file>    Process a response file');
  }
}

// Export for testing and orchestrator
module.exports = { 
  IDENTITY, 
  SPECIALISTS,
  createQueryToSpecialist, 
  createTaskForSpecialist, 
  handleResponse,
  routeQuery 
};
