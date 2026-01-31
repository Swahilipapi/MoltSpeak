#!/usr/bin/env node
/**
 * Translate Agent - MoltSpeak JavaScript SDK
 * 
 * A specialist agent that handles translation tasks.
 * Demonstrates JavaScript SDK message handling.
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
  agent: 'translate-agent',
  org: 'moltspeak-network',
  key: 'ed25519:translate_public_key_12345'
};
const PRIVATE_KEY = 'ed25519:translate_private_key_12345';

// ============================================================================
// Translation Data (Mock)
// ============================================================================

const TRANSLATIONS = {
  'en-fr': {
    'hello': 'bonjour',
    'goodbye': 'au revoir',
    'thank you': 'merci',
    'please': 's\'il vous plaît',
    'yes': 'oui',
    'no': 'non'
  },
  'en-es': {
    'hello': 'hola',
    'goodbye': 'adiós',
    'thank you': 'gracias',
    'please': 'por favor',
    'yes': 'sí',
    'no': 'no'
  },
  'en-de': {
    'hello': 'hallo',
    'goodbye': 'auf wiedersehen',
    'thank you': 'danke',
    'please': 'bitte',
    'yes': 'ja',
    'no': 'nein'
  }
};

// ============================================================================
// Message Handler
// ============================================================================

function translate(text, sourceLang, targetLang) {
  const key = `${sourceLang}-${targetLang}`;
  const dict = TRANSLATIONS[key] || {};
  const lowerText = text.toLowerCase();
  
  return dict[lowerText] || `[${targetLang}:${text}]`;
}

function handleTask(message) {
  const payload = message.p || {};
  const constraints = payload.constraints || {};
  
  const text = constraints.text || payload.description || '';
  const sourceLang = constraints.source || 'en';
  const targetLang = constraints.target || 'fr';
  
  const translatedText = translate(text, sourceLang, targetLang);
  
  const responseData = {
    source_text: text,
    translated_text: translatedText,
    source_lang: sourceLang,
    target_lang: targetLang,
    confidence: 0.95
  };
  
  // Get sender identity for response
  const sender = message.from || {};
  const toIdentity = {
    agent: sender.agent || 'unknown',
    org: sender.org,
    key: sender.key
  };
  
  // Create response
  const response = moltspeak.createResponse(
    message.id,
    responseData,
    IDENTITY,
    toIdentity
  );
  
  // Sign the response
  const signedResponse = moltspeak.sign(response, PRIVATE_KEY);
  
  return signedResponse;
}

function processMessage(msgJson) {
  const message = moltspeak.decode(msgJson, { validate: true });
  
  // Verify signature if present
  if (message.sig) {
    const senderKey = message.from?.key;
    if (senderKey) {
      const isValid = moltspeak.verify(message, senderKey);
      if (!isValid) {
        console.warn(`WARNING: Invalid signature from ${message.from?.agent}`);
      }
    }
  }
  
  // Handle based on operation
  if (message.op === moltspeak.OPERATIONS.TASK) {
    const response = handleTask(message);
    return moltspeak.encode(response, { pretty: true });
  }
  
  return JSON.stringify({ error: 'Unsupported operation' });
}

// ============================================================================
// Main
// ============================================================================

console.log(`Translate Agent (${IDENTITY.agent}) initialized`);
console.log(`SDK: JavaScript | Org: ${IDENTITY.org}`);

// Demo: process a sample task
if (process.argv[2]) {
  const msgFile = process.argv[2];
  const msgContent = fs.readFileSync(msgFile, 'utf8');
  const response = processMessage(msgContent);
  console.log(response);
} else {
  console.log('Ready to process translation tasks');
  console.log(`Supported language pairs: ${Object.keys(TRANSLATIONS).join(', ')}`);
}

// Export for testing
module.exports = { processMessage, handleTask, IDENTITY };
