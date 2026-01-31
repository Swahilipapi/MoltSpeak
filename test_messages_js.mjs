#!/usr/bin/env node
/**
 * MoltSpeak Message Builder Comprehensive Test - JavaScript
 * Tests all 9 operations, builder patterns, factory functions, and message fields
 */

import { 
  Message, 
  MessageBuilder,
  Operation 
} from './sdk/js/dist/index.mjs';

// Import standalone SDK for factory functions
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const moltspeak = require('./sdk/js/moltspeak.js');

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

const sender = () => ({ agent: 'alice', org: 'testorg', key: 'pk_alice123' });
const recipient = () => ({ agent: 'bob', org: 'otherorg' });

// =============================================================================
// 1. ALL 9 OPERATIONS TEST
// =============================================================================
console.log('\n' + '='.repeat(60));
console.log('1. ALL 9 OPERATIONS');
console.log('='.repeat(60));

test('hello operation', () => {
  const msg = new Message({
    operation: Operation.HELLO,
    sender: sender(),
    recipient: recipient(),
    payload: {
      protocol: 'moltspeak',
      version: '0.1',
      capabilities: ['query', 'task']
    }
  });
  if (msg.operation !== Operation.HELLO) throw new Error('Wrong operation');
  if (msg.validate().length !== 0) throw new Error('Validation failed');
  const wire = msg.toWire();
  if (wire.op !== 'hello') throw new Error('Wrong wire op');
});

test('verify operation', () => {
  const msg = new Message({
    operation: Operation.VERIFY,
    sender: sender(),
    recipient: recipient(),
    payload: {
      challenge: 'abc123xyz',
      timestamp: Date.now()
    }
  });
  if (msg.operation !== Operation.VERIFY) throw new Error('Wrong operation');
  if (msg.validate().length !== 0) throw new Error('Validation failed');
});

test('query operation', () => {
  const msg = new Message({
    operation: Operation.QUERY,
    sender: sender(),
    recipient: recipient(),
    payload: {
      domain: 'weather',
      intent: 'current',
      params: { location: 'Amsterdam' }
    }
  });
  if (msg.operation !== Operation.QUERY) throw new Error('Wrong operation');
  if (msg.validate().length !== 0) throw new Error('Validation failed');
});

test('respond operation', () => {
  const msg = new Message({
    operation: Operation.RESPOND,
    sender: sender(),
    recipient: recipient(),
    payload: {
      status: 'success',
      data: { temperature: 22, conditions: 'sunny' }
    }
  });
  if (msg.operation !== Operation.RESPOND) throw new Error('Wrong operation');
  if (msg.validate().length !== 0) throw new Error('Validation failed');
});

test('task operation', () => {
  const msg = new Message({
    operation: Operation.TASK,
    sender: sender(),
    recipient: recipient(),
    payload: {
      action: 'create',
      task_id: 'task-001',
      type: 'analysis',
      description: 'Analyze data'
    }
  });
  if (msg.operation !== Operation.TASK) throw new Error('Wrong operation');
  if (msg.validate().length !== 0) throw new Error('Validation failed');
});

test('stream operation', () => {
  const msg = new Message({
    operation: Operation.STREAM,
    sender: sender(),
    recipient: recipient(),
    payload: {
      action: 'chunk',
      stream_id: 'stream-001',
      seq: 1,
      data: 'Hello world',
      progress: 0.5
    }
  });
  if (msg.operation !== Operation.STREAM) throw new Error('Wrong operation');
  if (msg.validate().length !== 0) throw new Error('Validation failed');
});

test('tool operation', () => {
  const msg = new Message({
    operation: Operation.TOOL,
    sender: sender(),
    recipient: recipient(),
    payload: {
      action: 'invoke',
      tool: 'calculator',
      input: { expression: '2+2' }
    }
  });
  if (msg.operation !== Operation.TOOL) throw new Error('Wrong operation');
  if (msg.validate().length !== 0) throw new Error('Validation failed');
});

test('consent operation', () => {
  const msg = new Message({
    operation: Operation.CONSENT,
    sender: sender(),
    recipient: recipient(),
    payload: {
      action: 'request',
      data_types: ['email', 'name'],
      purpose: 'personalization'
    }
  });
  if (msg.operation !== Operation.CONSENT) throw new Error('Wrong operation');
  if (msg.validate().length !== 0) throw new Error('Validation failed');
});

test('error operation', () => {
  const msg = new Message({
    operation: Operation.ERROR,
    sender: sender(),
    recipient: recipient(),
    payload: {
      code: 'E_AUTH_FAILED',
      category: 'auth',
      message: 'Invalid signature',
      recoverable: false
    }
  });
  if (msg.operation !== Operation.ERROR) throw new Error('Wrong operation');
  if (msg.validate().length !== 0) throw new Error('Validation failed');
});

// =============================================================================
// 2. BUILDER PATTERN TESTS
// =============================================================================
console.log('\n' + '='.repeat(60));
console.log('2. BUILDER PATTERN');
console.log('='.repeat(60));

test('builder chaining (.from().to().payload().classify())', () => {
  const msg = new MessageBuilder(Operation.QUERY)
    .from('alice', 'testorg', 'pk_alice')
    .to('bob', 'otherorg')
    .withPayload({ domain: 'test', intent: 'ping' })
    .classifiedAs('int')
    .build();
  
  if (msg.sender.agent !== 'alice') throw new Error('Wrong sender');
  if (msg.recipient.org !== 'otherorg') throw new Error('Wrong recipient org');
  if (msg.payload.domain !== 'test') throw new Error('Wrong payload');
  if (msg.classification !== 'int') throw new Error('Wrong classification');
});

test('builder all methods', () => {
  const msg = new MessageBuilder(Operation.TASK)
    .from('alice', 'org1', 'key123')
    .to('bob', 'org2')
    .withPayload({ action: 'create', task_id: 't1' })
    .classifiedAs('conf')
    .inReplyTo('msg-123')
    .expiresIn(3600)  // 1 hour from now
    .requiresCapabilities(['task_create', 'task_execute'])
    .withExtension('myext', { custom: 'data' })
    .build();
  
  if (msg.sender.agent !== 'alice') throw new Error('Wrong sender');
  if (msg.replyTo !== 'msg-123') throw new Error('Wrong replyTo');
  if (!msg.expires) throw new Error('Missing expires');
  if (msg.capabilitiesRequired.length !== 2) throw new Error('Wrong capabilities');
  if (!msg.extensions.myext) throw new Error('Missing extension');
  if (msg.classification !== 'conf') throw new Error('Wrong classification');
});

test('builder expiresAt', () => {
  const futureTs = Date.now() + 60000;
  const msg = new MessageBuilder(Operation.QUERY)
    .from('a', 'org')
    .to('b', 'org')
    .withPayload({})
    .expiresAt(futureTs)
    .build();
  
  if (msg.expires !== futureTs) throw new Error('Wrong expires');
});

test('builder withPII', () => {
  const msg = new MessageBuilder(Operation.QUERY)
    .from('alice', 'org')
    .to('bob', 'org')
    .withPayload({ domain: 'profile', intent: 'get' })
    .withPII(['email', 'phone'], 'consent-token-123', 'user support')
    .build();
  
  if (msg.classification !== 'pii') throw new Error('Should be PII classification');
  if (!msg.piiMeta) throw new Error('Missing piiMeta');
  if (!msg.piiMeta.types.includes('email')) throw new Error('Missing email type');
  if (msg.piiMeta.consent.proof !== 'consent-token-123') throw new Error('Wrong consent token');
});

test('builder missing sender (should fail)', () => {
  try {
    new MessageBuilder(Operation.QUERY)
      .to('bob', 'org')
      .withPayload({})
      .build();
    throw new Error('Should have thrown');
  } catch (e) {
    if (!e.message.includes('Sender')) throw new Error('Wrong error: ' + e.message);
  }
});

test('builder missing recipient (should fail)', () => {
  try {
    new MessageBuilder(Operation.QUERY)
      .from('alice', 'org')
      .withPayload({})
      .build();
    throw new Error('Should have thrown');
  } catch (e) {
    if (!e.message.includes('Recipient')) throw new Error('Wrong error: ' + e.message);
  }
});

// =============================================================================
// 3. FACTORY FUNCTIONS (from moltspeak.js standalone)
// =============================================================================
console.log('\n' + '='.repeat(60));
console.log('3. FACTORY FUNCTIONS');
console.log('='.repeat(60));

test('createHello factory', () => {
  const identity = { agent: 'testagent', org: 'testorg' };
  const msg = moltspeak.createHello(identity, { operations: ['query', 'respond'] });
  if (msg.op !== 'hello') throw new Error('Wrong op');
  if (!msg.p.protocol_versions) throw new Error('Missing protocol_versions');
  if (!msg.p.capabilities) throw new Error('Missing capabilities');
});

test('createQuery factory', () => {
  const q = { domain: 'weather', intent: 'forecast', params: { days: 5 } };
  const msg = moltspeak.createQuery(q, sender(), recipient());
  if (msg.op !== 'query') throw new Error('Wrong op');
  if (msg.p.domain !== 'weather') throw new Error('Wrong domain');
  if (msg.p.intent !== 'forecast') throw new Error('Wrong intent');
});

test('createResponse factory', () => {
  const resp = { status: 'success', data: { result: 42 } };
  const msg = moltspeak.createResponse('orig-msg-id', resp, sender(), recipient());
  if (msg.op !== 'respond') throw new Error('Wrong op');
  if (msg.re !== 'orig-msg-id') throw new Error('Missing reply-to');
  if (msg.p.status !== 'success') throw new Error('Wrong status');
});

test('createTask factory', () => {
  const task = { id: 'task-001', type: 'analysis', description: 'Analyze data' };
  const msg = moltspeak.createTask(task, sender(), recipient());
  if (msg.op !== 'task') throw new Error('Wrong op');
  if (msg.p.task_id !== 'task-001') throw new Error('Wrong task_id');
  if (msg.p.action !== 'create') throw new Error('Wrong action');
});

test('createError factory', () => {
  const err = { code: 'E_AUTH', category: 'auth', message: 'Failed', recoverable: false };
  const msg = moltspeak.createError('orig-msg-id', err, sender(), recipient());
  if (msg.op !== 'error') throw new Error('Wrong op');
  if (msg.re !== 'orig-msg-id') throw new Error('Missing reply-to');
  if (msg.p.code !== 'E_AUTH') throw new Error('Wrong error code');
});

test('createMessage factory (OPERATIONS enum)', () => {
  const { createMessage, OPERATIONS } = moltspeak;
  const msg = createMessage(OPERATIONS.QUERY)
    .from(sender())
    .to(recipient())
    .payload({ domain: 'test', intent: 'ping' })
    .build();
  if (msg.op !== 'query') throw new Error('Wrong op');
  if (msg.p.domain !== 'test') throw new Error('Wrong domain');
});

test('MessageBuilder from standalone', () => {
  const { MessageBuilder: MB, OPERATIONS } = moltspeak;
  const msg = new MB(OPERATIONS.TASK)
    .from(sender())
    .to(recipient())
    .payload({ action: 'create', task_id: 't1' })
    .classification('conf')
    .build();
  
  if (msg.from.agent !== 'alice') throw new Error('Wrong sender');
  if (msg.cls !== 'conf') throw new Error('Wrong classification');
});

// =============================================================================
// 4. MESSAGE FIELDS
// =============================================================================
console.log('\n' + '='.repeat(60));
console.log('4. MESSAGE FIELDS');
console.log('='.repeat(60));

test('required fields auto-generated', () => {
  const msg = new Message({
    operation: Operation.QUERY,
    sender: sender(),
    recipient: recipient(),
    payload: { domain: 'test', intent: 'ping' }
  });
  if (!msg.messageId) throw new Error('Missing messageId');
  if (!msg.timestamp) throw new Error('Missing timestamp');
  if (msg.version !== '0.1') throw new Error('Wrong version');
  const errs = msg.validate();
  if (errs.length !== 0) throw new Error('Validation failed: ' + errs.join(', '));
});

test('wire format (compact fields)', () => {
  const msg = new Message({
    operation: Operation.QUERY,
    sender: sender(),
    recipient: recipient(),
    payload: { test: 123 }
  });
  const wire = msg.toWire();
  const required = ['v', 'id', 'ts', 'op', 'from', 'to', 'p', 'cls'];
  for (const key of required) {
    if (!(key in wire)) throw new Error(`Missing field: ${key}`);
  }
});

test('optional field: exp (expires)', () => {
  const msg = new Message({
    operation: Operation.QUERY,
    sender: sender(),
    recipient: recipient(),
    payload: {},
    expires: Date.now() + 60000
  });
  const wire = msg.toWire();
  if (!('exp' in wire)) throw new Error('Missing exp');
});

test('optional field: ref (replyTo)', () => {
  const msg = new Message({
    operation: Operation.RESPOND,
    sender: sender(),
    recipient: recipient(),
    payload: { status: 'success', data: {} },
    replyTo: 'original-msg-id'
  });
  const wire = msg.toWire();
  if (wire.re !== 'original-msg-id') throw new Error('Wrong re');
});

test('optional field: cap (capabilities)', () => {
  const msg = new Message({
    operation: Operation.TASK,
    sender: sender(),
    recipient: recipient(),
    payload: { action: 'create', task_id: 't1' },
    capabilitiesRequired: ['execute', 'admin']
  });
  const wire = msg.toWire();
  if (!wire.cap || wire.cap.length !== 2) throw new Error('Wrong cap');
});

test('optional field: ext (extensions)', () => {
  const msg = new Message({
    operation: Operation.QUERY,
    sender: sender(),
    recipient: recipient(),
    payload: {},
    extensions: { custom: { key: 'value' } }
  });
  const wire = msg.toWire();
  if (!wire.ext || !wire.ext.custom) throw new Error('Missing ext');
});

test('piiMeta handling', () => {
  const msg = new Message({
    operation: Operation.QUERY,
    sender: sender(),
    recipient: recipient(),
    payload: { user_email: 'test@example.com' },
    classification: 'pii',
    piiMeta: {
      types: ['email'],
      consent: {
        granted_by: 'user123',
        purpose: 'support',
        proof: 'consent-token'
      }
    }
  });
  const errs = msg.validate();
  if (errs.length !== 0) throw new Error('Validation failed: ' + errs.join(', '));
  const wire = msg.toWire();
  if (wire.cls !== 'pii') throw new Error('Wrong cls');
  if (!wire.pii_meta) throw new Error('Missing pii_meta');
});

test('pii classification without meta (should fail validation)', () => {
  const msg = new Message({
    operation: Operation.QUERY,
    sender: sender(),
    recipient: recipient(),
    payload: {},
    classification: 'pii'
    // No piiMeta
  });
  const errs = msg.validate();
  if (!errs.some(e => e.toLowerCase().includes('pii'))) {
    throw new Error('Should have PII validation error');
  }
});

test('JSON roundtrip (serialize/deserialize)', () => {
  const original = new Message({
    operation: Operation.TASK,
    sender: sender(),
    recipient: recipient(),
    payload: { action: 'create', task_id: 't1' },
    classification: 'conf',
    replyTo: 'prev-msg',
    expires: 999999999,
    capabilitiesRequired: ['cap1'],
    extensions: { ext1: { data: 123 } }
  });
  
  const jsonStr = original.toJSON();
  const restored = Message.fromJSON(jsonStr);
  
  if (restored.operation !== original.operation) throw new Error('Operation mismatch');
  if (restored.sender.agent !== original.sender.agent) throw new Error('Sender mismatch');
  if (restored.recipient.org !== original.recipient.org) throw new Error('Recipient mismatch');
  if (restored.classification !== original.classification) throw new Error('Classification mismatch');
  if (restored.replyTo !== original.replyTo) throw new Error('ReplyTo mismatch');
  if (restored.expires !== original.expires) throw new Error('Expires mismatch');
});

test('all classification levels', () => {
  for (const cls of ['pub', 'int', 'conf', 'sec']) {
    const msg = new Message({
      operation: Operation.QUERY,
      sender: sender(),
      recipient: recipient(),
      payload: {},
      classification: cls
    });
    const errs = msg.validate();
    if (errs.length !== 0) throw new Error(`Classification '${cls}' failed: ${errs}`);
  }
});

// =============================================================================
// SUMMARY
// =============================================================================
console.log('\n' + '='.repeat(60));
console.log('SUMMARY - JAVASCRIPT');
console.log('='.repeat(60));
console.log(`Total:  ${results.passed + results.failed}`);
console.log(`Passed: ${results.passed}`);
console.log(`Failed: ${results.failed}`);

if (results.failed > 0) {
  console.log('\nFailed tests:');
  for (const t of results.tests) {
    if (t.status === 'FAIL') {
      console.log(`  - ${t.name}: ${t.error || 'Unknown error'}`);
    }
  }
  process.exit(1);
} else {
  console.log('\n🎉 All JavaScript tests passed!');
  process.exit(0);
}
