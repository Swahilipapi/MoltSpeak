#!/usr/bin/env node
/**
 * MoltSpeak Conversation Flow Tests - JavaScript
 * Tests realistic multi-turn conversation patterns with ref chaining
 */

import { Message, Operation } from '../../sdk/js/dist/index.mjs';

// Test tracking
const results = { passed: 0, failed: 0, tests: [] };

function test(name, fn) {
  try {
    fn();
    results.passed++;
    results.tests.push({ name, status: 'PASS' });
    console.log(`  ✅ PASS: ${name}`);
    return true;
  } catch (e) {
    results.failed++;
    results.tests.push({ name, status: 'FAIL', error: e.message });
    console.log(`  ❌ FAIL: ${name} - ${e.message}`);
    return false;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

// Agents
const agentA = () => ({ agent: 'assistant', org: 'openai', key: 'ed25519:pk_assistant' });
const agentB = () => ({ agent: 'translator', org: 'deepl', key: 'ed25519:pk_translator' });

// =============================================================================
// 1. SIMPLE QUERY-RESPONSE HANDSHAKE
// =============================================================================
console.log('\n' + '='.repeat(60));
console.log('1. SIMPLE QUERY-RESPONSE HANDSHAKE');
console.log('='.repeat(60));

test('simple handshake with query-response', () => {
  const conversation = [];
  
  // Step 1: Agent A says HELLO
  const helloA = new Message({
    operation: Operation.HELLO,
    sender: agentA(),
    recipient: agentB(),
    payload: {
      protocol: 'moltspeak',
      version: '0.1',
      capabilities: ['query', 'task', 'stream']
    }
  });
  conversation.push(helloA);
  assert(helloA.operation === Operation.HELLO, 'Should be HELLO');
  assert(!helloA.replyTo, 'First message should have no ref');
  
  // Step 2: Agent B responds with HELLO (ref to A's hello)
  const helloB = new Message({
    operation: Operation.HELLO,
    sender: agentB(),
    recipient: agentA(),
    replyTo: helloA.id,
    payload: {
      protocol: 'moltspeak',
      version: '0.1',
      capabilities: ['translate', 'respond']
    }
  });
  conversation.push(helloB);
  assert(helloB.replyTo === helloA.id, 'B should ref A hello');
  
  // Step 3: Agent A sends QUERY
  const queryA = new Message({
    operation: Operation.QUERY,
    sender: agentA(),
    recipient: agentB(),
    replyTo: helloB.id,
    payload: {
      domain: 'translation',
      intent: 'translate',
      params: {
        text: 'Hello, world!',
        source_lang: 'en',
        target_lang: 'es'
      }
    }
  });
  conversation.push(queryA);
  assert(queryA.replyTo === helloB.id, 'Query should ref hello');
  
  // Step 4: Agent B responds
  const respondB = new Message({
    operation: Operation.RESPOND,
    sender: agentB(),
    recipient: agentA(),
    replyTo: queryA.id,
    payload: {
      status: 'success',
      data: {
        translated: '¡Hola, mundo!',
        source_lang: 'en',
        target_lang: 'es',
        confidence: 0.98
      }
    }
  });
  conversation.push(respondB);
  assert(respondB.replyTo === queryA.id, 'Response should ref query');
  
  // Verify complete chain
  assert(conversation.length === 4, 'Should have 4 messages');
  assert(!conversation[0].replyTo, 'First msg no ref');
  assert(conversation[1].replyTo === conversation[0].id, 'Chain 1->0');
  assert(conversation[2].replyTo === conversation[1].id, 'Chain 2->1');
  assert(conversation[3].replyTo === conversation[2].id, 'Chain 3->2');
  
  // Validate all messages
  for (const msg of conversation) {
    const errors = msg.validate();
    assert(errors.length === 0, `Validation failed: ${errors.join(', ')}`);
  }
});


// =============================================================================
// 2. TASK WITH STATUS UPDATES (STREAMING)
// =============================================================================
console.log('\n' + '='.repeat(60));
console.log('2. TASK WITH STATUS UPDATES (STREAMING)');
console.log('='.repeat(60));

test('task with status streaming updates', () => {
  const conversation = [];
  
  // Step 1: Agent A sends TASK (translate document)
  const taskMsg = new Message({
    operation: Operation.TASK,
    sender: agentA(),
    recipient: agentB(),
    payload: {
      action: 'translate_document',
      params: {
        document_id: 'doc-12345',
        document_name: 'quarterly_report.pdf',
        source_lang: 'en',
        target_lang: 'de',
        pages: 50
      },
      async: true,
      callback: 'https://openai.example/webhooks/task'
    }
  });
  conversation.push(taskMsg);
  
  // Step 2: Agent B accepts (RESPOND with status)
  const acceptMsg = new Message({
    operation: Operation.RESPOND,
    sender: agentB(),
    recipient: agentA(),
    replyTo: taskMsg.id,
    payload: {
      status: 'success',
      data: {
        task_id: 'task-abc123',
        accepted: true,
        estimated_time_ms: 60000,
        message: 'Task accepted, processing started'
      }
    }
  });
  conversation.push(acceptMsg);
  assert(acceptMsg.replyTo === taskMsg.id, 'Accept should ref task');
  
  // Step 3-5: Agent B streams progress
  const progressLevels = [25, 50, 75];
  for (let i = 0; i < progressLevels.length; i++) {
    const streamMsg = new Message({
      operation: Operation.STREAM,
      sender: agentB(),
      recipient: agentA(),
      replyTo: taskMsg.id,  // All streams ref original task
      payload: {
        task_id: 'task-abc123',
        seq: i + 1,
        total: 4,
        delta: {
          progress: progressLevels[i],
          pages_processed: Math.floor(50 * progressLevels[i] / 100),
          status: 'processing'
        }
      }
    });
    conversation.push(streamMsg);
    assert(streamMsg.replyTo === taskMsg.id, `Stream ${i+1} should ref task`);
  }
  
  // Step 6: Final RESPOND with complete result
  const completeMsg = new Message({
    operation: Operation.RESPOND,
    sender: agentB(),
    recipient: agentA(),
    replyTo: taskMsg.id,
    payload: {
      status: 'success',
      data: {
        task_id: 'task-abc123',
        progress: 100,
        pages_processed: 50,
        status: 'complete',
        result: {
          output_document_id: 'doc-67890',
          output_document_name: 'quarterly_report_de.pdf',
          word_count: 15420,
          processing_time_ms: 58230
        }
      }
    }
  });
  conversation.push(completeMsg);
  
  // Verify stream chain - all ref the original task
  assert(
    conversation.slice(1).every(msg => msg.replyTo === taskMsg.id),
    'All messages should ref original task'
  );
  
  // Verify sequence numbers
  const streamMsgs = conversation.filter(m => m.operation === Operation.STREAM);
  const seqs = streamMsgs.map(m => m.payload.seq);
  assert(JSON.stringify(seqs) === JSON.stringify([1, 2, 3]), 'Sequences should be 1,2,3');
});


// =============================================================================
// 3. ERROR RECOVERY FLOW
// =============================================================================
console.log('\n' + '='.repeat(60));
console.log('3. ERROR RECOVERY FLOW');
console.log('='.repeat(60));

test('error recovery flow', () => {
  const conversation = [];
  
  // Step 1: Agent A sends invalid QUERY (missing required param)
  const badQuery = new Message({
    operation: Operation.QUERY,
    sender: agentA(),
    recipient: agentB(),
    payload: {
      domain: 'translation',
      intent: 'translate',
      params: {
        text: 'Hello, world!'
        // Missing target_lang - intentional error
      }
    }
  });
  conversation.push(badQuery);
  
  // Step 2: Agent B returns ERROR
  const errorMsg = new Message({
    operation: Operation.ERROR,
    sender: agentB(),
    recipient: agentA(),
    replyTo: badQuery.id,
    payload: {
      code: 'E_VALIDATION',
      message: 'Missing required parameter: target_lang',
      details: {
        field: 'params.target_lang',
        constraint: 'required',
        provided_params: ['text']
      },
      retry: true,
      docs: 'https://deepl.example/docs/translate#parameters'
    }
  });
  conversation.push(errorMsg);
  assert(errorMsg.replyTo === badQuery.id, 'Error should ref bad query');
  assert(errorMsg.payload.code === 'E_VALIDATION', 'Should be validation error');
  assert(errorMsg.payload.retry === true, 'Should be retryable');
  
  // Step 3: Agent A sends corrected QUERY
  const goodQuery = new Message({
    operation: Operation.QUERY,
    sender: agentA(),
    recipient: agentB(),
    replyTo: errorMsg.id,
    payload: {
      domain: 'translation',
      intent: 'translate',
      params: {
        text: 'Hello, world!',
        source_lang: 'en',
        target_lang: 'fr'
      }
    }
  });
  conversation.push(goodQuery);
  assert(goodQuery.replyTo === errorMsg.id, 'Correction should ref error');
  
  // Step 4: Agent B returns success
  const successMsg = new Message({
    operation: Operation.RESPOND,
    sender: agentB(),
    recipient: agentA(),
    replyTo: goodQuery.id,
    payload: {
      status: 'success',
      data: {
        translated: 'Bonjour, le monde!',
        source_lang: 'en',
        target_lang: 'fr',
        confidence: 0.99
      }
    }
  });
  conversation.push(successMsg);
  
  // Verify recovery chain
  assert(!conversation[0].replyTo, 'First has no ref');
  assert(conversation[1].replyTo === conversation[0].id, 'Error refs bad query');
  assert(conversation[2].replyTo === conversation[1].id, 'Correction refs error');
  assert(conversation[3].replyTo === conversation[2].id, 'Success refs correction');
});


// =============================================================================
// 4. CONSENT FLOW (PII HANDLING)
// =============================================================================
console.log('\n' + '='.repeat(60));
console.log('4. CONSENT FLOW (PII HANDLING)');
console.log('='.repeat(60));

test('consent flow with PII', () => {
  const conversation = [];
  
  // Step 1: Agent A sends QUERY containing PII
  const piiQuery = new Message({
    operation: Operation.QUERY,
    sender: agentA(),
    recipient: agentB(),
    classification: 'pii',
    payload: {
      domain: 'user_profile',
      intent: 'translate_profile',
      params: {
        user_name: 'John Doe',
        user_email: 'john.doe@example.com',
        bio: 'Software engineer from San Francisco',
        target_lang: 'ja'
      }
    },
    piiMeta: {
      types: ['name', 'email', 'location'],
      consent: {
        granted_by: 'user-12345',
        purpose: 'profile translation',
        proof: 'consent-token-abc'
      },
      mask_fields: ['user_email']
    }
  });
  conversation.push(piiQuery);
  assert(piiQuery.classification === 'pii', 'Should be PII classified');
  
  // Step 2: Agent B requests additional consent
  const consentRequest = new Message({
    operation: Operation.CONSENT,
    sender: agentB(),
    recipient: agentA(),
    replyTo: piiQuery.id,
    classification: 'pii',
    payload: {
      request: true,
      reason: 'temporary_storage',
      purpose: 'Translation requires temporary storage of PII for processing',
      duration_ms: 3600000,
      data_types: ['name', 'email', 'location'],
      processing: {
        stored: false,
        shared: false,
        retention_policy: 'delete_after_processing'
      }
    }
  });
  conversation.push(consentRequest);
  assert(consentRequest.replyTo === piiQuery.id, 'Consent request should ref query');
  assert(consentRequest.payload.request === true, 'Should be a request');
  
  // Step 3: Agent A grants consent
  const consentGrant = new Message({
    operation: Operation.CONSENT,
    sender: agentA(),
    recipient: agentB(),
    replyTo: consentRequest.id,
    classification: 'pii',
    payload: {
      grant: true,
      scope: {
        data_types: ['name', 'email', 'location'],
        purpose: 'profile translation',
        duration_ms: 3600000
      },
      proof: 'consent-grant-xyz789',
      granted_by: 'user-12345',
      audit_log: true
    }
  });
  conversation.push(consentGrant);
  assert(consentGrant.replyTo === consentRequest.id, 'Grant should ref request');
  assert(consentGrant.payload.grant === true, 'Should be a grant');
  
  // Step 4: Agent B responds with translated profile
  const translatedResponse = new Message({
    operation: Operation.RESPOND,
    sender: agentB(),
    recipient: agentA(),
    replyTo: consentGrant.id,
    classification: 'pii',
    payload: {
      status: 'success',
      data: {
        translated_name: 'ジョン・ドウ',
        translated_bio: 'サンフランシスコのソフトウェアエンジニア',
        source_lang: 'en',
        target_lang: 'ja'
      },
      pii_processed: {
        consent_proof: 'consent-grant-xyz789',
        data_deleted: true,
        processing_completed: true
      }
    },
    piiMeta: {
      types: ['name', 'location'],
      consent: {
        granted_by: 'user-12345',
        purpose: 'profile translation',
        proof: 'consent-grant-xyz789'
      }
    }
  });
  conversation.push(translatedResponse);
  
  // Verify consent chain
  assert(conversation.length === 4, 'Should have 4 messages');
  assert(conversation[1].replyTo === conversation[0].id, 'Consent req refs query');
  assert(conversation[2].replyTo === conversation[1].id, 'Grant refs request');
  assert(conversation[3].replyTo === conversation[2].id, 'Response refs grant');
  
  // Verify all PII messages have correct classification
  assert(
    conversation.every(msg => msg.classification === 'pii'),
    'All messages should be PII classified'
  );
});


// =============================================================================
// 5. REF FIELD CHAIN VERIFICATION
// =============================================================================
console.log('\n' + '='.repeat(60));
console.log('5. REF FIELD CHAIN VERIFICATION');
console.log('='.repeat(60));

test('ref chain integrity over 10 messages', () => {
  const messages = [];
  
  // First message - no ref
  let msg = new Message({
    operation: Operation.HELLO,
    sender: agentA(),
    recipient: agentB(),
    payload: { protocol: 'moltspeak', version: '0.1' }
  });
  messages.push(msg);
  
  // Chain 9 more messages alternating senders
  const ops = [
    Operation.HELLO, Operation.QUERY, Operation.RESPOND,
    Operation.QUERY, Operation.STREAM, Operation.STREAM,
    Operation.RESPOND, Operation.QUERY, Operation.RESPOND
  ];
  
  for (let i = 0; i < ops.length; i++) {
    const sender = i % 2 === 0 ? agentA() : agentB();
    const recipient = i % 2 === 0 ? agentB() : agentA();
    
    msg = new Message({
      operation: ops[i],
      sender,
      recipient,
      replyTo: messages[messages.length - 1].id,
      payload: { seq: i + 1 }
    });
    messages.push(msg);
  }
  
  // Verify chain integrity
  assert(!messages[0].replyTo, 'First message should have no ref');
  
  for (let i = 1; i < messages.length; i++) {
    assert(
      messages[i].replyTo === messages[i - 1].id,
      `Message ${i} ref should point to message ${i - 1}`
    );
  }
  
  // Verify wire format contains 're' field
  for (let i = 0; i < messages.length; i++) {
    const wire = messages[i].toWire();
    if (i === 0) {
      assert(!('re' in wire), "First message wire should not have 're'");
    } else {
      assert(
        wire.re === messages[i - 1].id,
        `Wire 're' field should match replyTo`
      );
    }
  }
});


test('ref field survives JSON roundtrip', () => {
  const original = new Message({
    operation: Operation.QUERY,
    sender: agentA(),
    recipient: agentB(),
    replyTo: 'previous-msg-uuid-12345',
    payload: { domain: 'test' }
  });
  
  // Serialize to JSON
  const jsonStr = JSON.stringify(original.toWire());
  
  // Parse back
  const wireData = JSON.parse(jsonStr);
  const parsed = Message.fromWire(wireData);
  
  // Verify ref preserved
  assert(parsed.replyTo === original.replyTo, 'replyTo should match');
  assert(parsed.replyTo === 'previous-msg-uuid-12345', 'Should be correct value');
});


// =============================================================================
// SUMMARY
// =============================================================================
console.log('\n' + '='.repeat(60));
console.log('CONVERSATION FLOW TEST SUMMARY - JAVASCRIPT');
console.log('='.repeat(60));
console.log(`  Total: ${results.passed + results.failed}`);
console.log(`  ✅ Passed: ${results.passed}`);
console.log(`  ❌ Failed: ${results.failed}`);
console.log('='.repeat(60));

// Exit with error code if any failed
process.exit(results.failed === 0 ? 0 : 1);
