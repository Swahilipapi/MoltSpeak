/**
 * MoltSpeak SDK Test Suite
 * 
 * Run with: node test.js
 */

'use strict';

const moltspeak = require('./moltspeak');

// ============================================================================
// Test Utilities
// ============================================================================

let passed = 0;
let failed = 0;
const errors = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    errors.push({ name, error: e.message });
    console.log(`  ✗ ${name}: ${e.message}`);
  }
}

function assertEqual(actual, expected, message = '') {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message} Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertTrue(value, message = '') {
  if (!value) {
    throw new Error(`${message} Expected truthy, got ${value}`);
  }
}

function assertFalse(value, message = '') {
  if (value) {
    throw new Error(`${message} Expected falsy, got ${value}`);
  }
}

function assertThrows(fn, expectedError = null, message = '') {
  try {
    fn();
    throw new Error(`${message} Expected function to throw`);
  } catch (e) {
    if (expectedError && !e.message.includes(expectedError)) {
      throw new Error(`${message} Expected error containing "${expectedError}", got "${e.message}"`);
    }
  }
}

// ============================================================================
// Test Suites
// ============================================================================

console.log('\n🧪 MoltSpeak SDK Tests\n');
console.log('─'.repeat(50));

// Test Constants
console.log('\n📌 Constants');
test('PROTOCOL_VERSION is defined', () => {
  assertEqual(moltspeak.PROTOCOL_VERSION, '0.1');
});

test('OPERATIONS are defined', () => {
  assertTrue(Object.keys(moltspeak.OPERATIONS).length >= 8);
  assertEqual(moltspeak.OPERATIONS.QUERY, 'query');
});

test('CLASSIFICATIONS are defined', () => {
  assertEqual(moltspeak.CLASSIFICATIONS.PUBLIC, 'pub');
  assertEqual(moltspeak.CLASSIFICATIONS.PII, 'pii');
});

test('ERROR_CODES are defined', () => {
  assertTrue(moltspeak.ERROR_CODES.E_PARSE);
  assertTrue(moltspeak.ERROR_CODES.E_CONSENT);
});

// Test Utilities
console.log('\n🔧 Utilities');
test('generateUUID returns valid UUID format', () => {
  const uuid = moltspeak.generateUUID();
  assertTrue(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid));
});

test('generateUUID returns unique values', () => {
  const uuid1 = moltspeak.generateUUID();
  const uuid2 = moltspeak.generateUUID();
  assertTrue(uuid1 !== uuid2);
});

test('now returns timestamp in milliseconds', () => {
  const ts = moltspeak.now();
  assertTrue(ts > 1700000000000); // After 2023
  assertTrue(ts < 2000000000000); // Before 2033
});

test('deepClone creates independent copy', () => {
  const original = { a: 1, b: { c: 2 } };
  const cloned = moltspeak.deepClone(original);
  cloned.b.c = 99;
  assertEqual(original.b.c, 2);
});

test('byteSize calculates correctly', () => {
  const size = moltspeak.byteSize('hello');
  assertEqual(size, 5);
});

// Test PII Detection
console.log('\n🔒 PII Detection');
test('detectPII finds email addresses', () => {
  const result = moltspeak.detectPII('Contact me at test@example.com');
  assertTrue(result.hasPII);
  assertTrue(result.types.includes('email'));
});

test('detectPII finds phone numbers', () => {
  const result = moltspeak.detectPII('Call me at 555-123-4567');
  assertTrue(result.hasPII);
  assertTrue(result.types.includes('phone'));
});

test('detectPII finds SSN patterns', () => {
  const result = moltspeak.detectPII('SSN: 123-45-6789');
  assertTrue(result.hasPII);
  assertTrue(result.types.includes('ssn'));
});

test('detectPII returns false for clean text', () => {
  const result = moltspeak.detectPII('The weather is nice today');
  assertFalse(result.hasPII);
});

test('detectPII works on objects', () => {
  const result = moltspeak.detectPII({ email: 'user@test.com', name: 'Test' });
  assertTrue(result.hasPII);
});

test('maskPII masks email addresses', () => {
  const masked = moltspeak.maskPII('Contact test@example.com please');
  assertTrue(!masked.includes('test@example.com'));
  assertTrue(masked.includes('*'));
});

test('maskPII preserves non-PII text', () => {
  const text = 'Hello world';
  const masked = moltspeak.maskPII(text);
  assertEqual(masked, text);
});

// Test Message Validation
console.log('\n✅ Message Validation');
test('validateMessage accepts valid message', () => {
  const msg = {
    v: '0.1',
    id: moltspeak.generateUUID(),
    ts: moltspeak.now(),
    op: 'query',
    from: { agent: 'test-agent' },
    cls: 'int',
    p: { domain: 'test' }
  };
  const result = moltspeak.validateMessage(msg);
  assertTrue(result.valid);
  assertEqual(result.errors.length, 0);
});

test('validateMessage rejects missing required fields', () => {
  const msg = { v: '0.1' }; // Missing id, ts, op
  const result = moltspeak.validateMessage(msg, { strict: true });
  assertFalse(result.valid);
  assertTrue(result.errors.length > 0);
});

test('validateMessage rejects invalid classification', () => {
  const msg = {
    v: '0.1',
    id: moltspeak.generateUUID(),
    ts: moltspeak.now(),
    op: 'query',
    cls: 'invalid-cls'
  };
  const result = moltspeak.validateMessage(msg, { strict: false });
  assertFalse(result.valid);
  assertTrue(result.errors.some(e => e.includes('classification')));
});

test('validateMessage detects PII without consent', () => {
  const msg = {
    v: '0.1',
    id: moltspeak.generateUUID(),
    ts: moltspeak.now(),
    op: 'query',
    from: { agent: 'test' },
    cls: 'int',
    p: { email: 'secret@email.com' }
  };
  const result = moltspeak.validateMessage(msg, { checkPII: true });
  assertFalse(result.valid);
  assertTrue(result.errors.some(e => e.includes('PII')));
});

test('validateMessage allows PII with proper classification', () => {
  const msg = {
    v: '0.1',
    id: moltspeak.generateUUID(),
    ts: moltspeak.now(),
    op: 'query',
    from: { agent: 'test' },
    cls: 'pii',
    p: { email: 'user@email.com' }
  };
  const result = moltspeak.validateMessage(msg);
  assertTrue(result.valid);
});

// Test Message Building
console.log('\n🏗️ Message Building');
test('MessageBuilder creates valid message', () => {
  const msg = moltspeak.createMessage('query')
    .from({ agent: 'sender' })
    .to({ agent: 'receiver' })
    .payload({ domain: 'test', intent: 'demo' })
    .build();
  
  assertEqual(msg.op, 'query');
  assertEqual(msg.from.agent, 'sender');
  assertEqual(msg.to.agent, 'receiver');
  assertTrue(msg.id);
  assertTrue(msg.ts);
});

test('MessageBuilder supports chaining', () => {
  const msg = moltspeak.createMessage('task')
    .from({ agent: 'a' })
    .to({ agent: 'b' })
    .payload({ description: 'Test task' })
    .classification('conf')
    .replyTo('original-id')
    .expiresIn(60000)
    .requireCapabilities(['task.create'])
    .build({ validate: false });
  
  assertEqual(msg.cls, 'conf');
  assertEqual(msg.re, 'original-id');
  assertTrue(msg.exp > moltspeak.now());
  assertTrue(msg.cap.includes('task.create'));
});

// Test Factory Functions
console.log('\n🏭 Factory Functions');
test('createHello creates valid hello message', () => {
  const hello = moltspeak.createHello(
    { agent: 'test-agent', org: 'test-org' },
    { operations: ['query', 'respond', 'task'] }
  );
  
  assertEqual(hello.op, 'hello');
  assertTrue(hello.p.capabilities.includes('query'));
  assertTrue(hello.p.protocol_versions.includes('0.1'));
});

test('createQuery creates valid query message', () => {
  const query = moltspeak.createQuery(
    { domain: 'weather', intent: 'forecast', params: { loc: 'Tokyo' } },
    { agent: 'sender' },
    { agent: 'receiver' }
  );
  
  assertEqual(query.op, 'query');
  assertEqual(query.p.domain, 'weather');
  assertEqual(query.p.params.loc, 'Tokyo');
});

test('createResponse creates valid response message', () => {
  const response = moltspeak.createResponse(
    'original-query-id',
    { temperature: 22, unit: 'C' },
    { agent: 'responder' },
    { agent: 'requester' }
  );
  
  assertEqual(response.op, 'respond');
  assertEqual(response.re, 'original-query-id');
  assertEqual(response.p.status, 'success');
});

test('createTask creates valid task message', () => {
  const task = moltspeak.createTask(
    { description: 'Search for papers', type: 'research', priority: 'high' },
    { agent: 'delegator' },
    { agent: 'worker' }
  );
  
  assertEqual(task.op, 'task');
  assertEqual(task.p.type, 'research');
  assertEqual(task.p.priority, 'high');
  assertTrue(task.p.task_id.startsWith('task-'));
});

test('createError creates valid error message', () => {
  const error = moltspeak.createError(
    'failed-msg-id',
    { code: 'E_INVALID_PARAM', message: 'Missing location', recoverable: true },
    { agent: 'service' },
    { agent: 'client' }
  );
  
  assertEqual(error.op, 'error');
  assertEqual(error.p.code, 'E_INVALID_PARAM');
  assertTrue(error.p.recoverable);
});

// Test Envelope Functions
console.log('\n📦 Envelope Functions');
test('wrapInEnvelope wraps message correctly', () => {
  const msg = moltspeak.createQuery(
    { domain: 'test' },
    { agent: 'a' },
    { agent: 'b' }
  );
  
  const envelope = moltspeak.wrapInEnvelope(msg);
  
  assertEqual(envelope.moltspeak, '0.1');
  assertEqual(envelope.envelope.encrypted, false);
  assertTrue(envelope.message);
  assertEqual(envelope.message.op, 'query');
});

test('unwrapEnvelope extracts message', () => {
  const msg = { v: '0.1', id: 'test', ts: 123, op: 'query' };
  const envelope = moltspeak.wrapInEnvelope(msg);
  const unwrapped = moltspeak.unwrapEnvelope(envelope);
  
  assertEqual(unwrapped.op, 'query');
});

test('unwrapEnvelope throws on encrypted envelope', () => {
  const envelope = {
    moltspeak: '0.1',
    envelope: { encrypted: true },
    ciphertext: 'encrypted-data'
  };
  
  assertThrows(() => moltspeak.unwrapEnvelope(envelope), 'decrypt');
});

// Test Encoding/Decoding
console.log('\n🔄 Encoding/Decoding');
test('encode produces valid JSON', () => {
  const msg = moltspeak.createQuery({ domain: 'test' }, { agent: 'a' }, { agent: 'b' });
  const encoded = moltspeak.encode(msg);
  
  assertTrue(typeof encoded === 'string');
  const parsed = JSON.parse(encoded); // Should not throw
  assertEqual(parsed.op, 'query');
});

test('encode with pretty option formats nicely', () => {
  const msg = { v: '0.1', id: 'test', ts: 123, op: 'query' };
  const encoded = moltspeak.encode(msg, { pretty: true });
  
  assertTrue(encoded.includes('\n'));
  assertTrue(encoded.includes('  ')); // Indentation
});

test('encode with envelope option wraps message', () => {
  const msg = { v: '0.1', id: 'test', ts: 123, op: 'query' };
  const encoded = moltspeak.encode(msg, { envelope: true });
  const parsed = JSON.parse(encoded);
  
  assertTrue(parsed.moltspeak);
  assertTrue(parsed.envelope);
  assertTrue(parsed.message);
});

test('decode parses valid JSON message', () => {
  const original = moltspeak.createQuery({ domain: 'test' }, { agent: 'a' }, { agent: 'b' });
  const encoded = moltspeak.encode(original);
  const decoded = moltspeak.decode(encoded);
  
  assertEqual(decoded.op, 'query');
  assertEqual(decoded.p.domain, 'test');
});

test('decode unwraps envelope by default', () => {
  const msg = { v: '0.1', id: 'test', ts: 123, op: 'query' };
  const encoded = moltspeak.encode(msg, { envelope: true });
  const decoded = moltspeak.decode(encoded);
  
  assertEqual(decoded.op, 'query');
  assertFalse(decoded.moltspeak); // Unwrapped
});

test('decode throws on invalid JSON', () => {
  assertThrows(() => moltspeak.decode('not json'), 'Invalid JSON');
});

// Test Signing
console.log('\n🔐 Signing');
test('sign adds signature to message', () => {
  const msg = { v: '0.1', id: 'test', ts: 123, op: 'query' };
  const signed = moltspeak.sign(msg, 'mock-private-key');
  
  assertTrue(signed.sig);
  assertTrue(signed.sig.startsWith('ed25519:'));
});

test('sign does not modify original message', () => {
  const msg = { v: '0.1', id: 'test', ts: 123, op: 'query' };
  moltspeak.sign(msg, 'mock-private-key');
  
  assertFalse(msg.sig);
});

test('verify returns true for signed message', () => {
  const msg = { v: '0.1', id: 'test', ts: 123, op: 'query' };
  const signed = moltspeak.sign(msg, 'mock-private-key');
  const valid = moltspeak.verify(signed, 'mock-public-key');
  
  assertTrue(valid);
});

test('verify returns false for unsigned message', () => {
  const msg = { v: '0.1', id: 'test', ts: 123, op: 'query' };
  const valid = moltspeak.verify(msg, 'mock-public-key');
  
  assertFalse(valid);
});

// Test Natural Language
console.log('\n💬 Natural Language');
test('parseNaturalLanguage handles query patterns', () => {
  const msg = moltspeak.parseNaturalLanguage('query weather in Tokyo', { agent: 'user' });
  
  assertEqual(msg.op, 'query');
  assertTrue(msg.p.params.query.includes('weather'));
});

test('parseNaturalLanguage handles task patterns', () => {
  const msg = moltspeak.parseNaturalLanguage('do research on AI safety', { agent: 'user' });
  
  assertEqual(msg.op, 'task');
  assertTrue(msg.p.description.includes('research'));
});

test('toNaturalLanguage describes query message', () => {
  const msg = {
    op: 'query',
    from: { agent: 'alice' },
    to: { agent: 'bob' },
    p: { domain: 'weather', intent: 'forecast' }
  };
  
  const description = moltspeak.toNaturalLanguage(msg);
  
  assertTrue(description.includes('alice'));
  assertTrue(description.includes('bob'));
  assertTrue(description.includes('weather'));
});

test('toNaturalLanguage describes task message', () => {
  const msg = {
    op: 'task',
    from: { agent: 'manager' },
    to: { agent: 'worker' },
    p: { description: 'Complete the report', priority: 'high' }
  };
  
  const description = moltspeak.toNaturalLanguage(msg);
  
  assertTrue(description.includes('manager'));
  assertTrue(description.includes('Complete the report'));
  assertTrue(description.includes('high'));
});

// Test Integration
console.log('\n🔗 Integration Tests');
test('full message round-trip', () => {
  // Create → Sign → Encode → Decode → Verify
  const original = moltspeak.createQuery(
    { domain: 'weather', intent: 'forecast', params: { location: 'London' } },
    { agent: 'client-agent', org: 'acme' },
    { agent: 'weather-agent', org: 'weather-service' }
  );
  
  const signed = moltspeak.sign(original, 'private-key');
  const encoded = moltspeak.encode(signed, { envelope: true });
  const decoded = moltspeak.decode(encoded);
  const verified = moltspeak.verify(decoded, 'public-key');
  
  assertEqual(decoded.op, 'query');
  assertEqual(decoded.p.domain, 'weather');
  assertTrue(verified);
});

test('query-response exchange', () => {
  const alice = { agent: 'alice-agent', org: 'company-a' };
  const bob = { agent: 'bob-agent', org: 'company-b' };
  
  // Alice sends query
  const query = moltspeak.createQuery(
    { domain: 'inventory', intent: 'stock-check', params: { sku: 'ABC123' } },
    alice,
    bob
  );
  
  // Bob responds
  const response = moltspeak.createResponse(
    query.id,
    { sku: 'ABC123', quantity: 42, warehouse: 'WH-EAST' },
    bob,
    alice
  );
  
  assertEqual(response.re, query.id);
  assertEqual(response.p.data.quantity, 42);
});

test('error handling flow', () => {
  const client = { agent: 'client' };
  const server = { agent: 'server' };
  
  // Client sends malformed query
  const badQuery = moltspeak.createQuery(
    { domain: 'api' }, // Missing required params
    client,
    server
  );
  
  // Server responds with error
  const errorResponse = moltspeak.createError(
    badQuery.id,
    {
      code: 'E_MISSING_FIELD',
      message: 'Required parameter "params" is missing',
      field: 'p.params',
      recoverable: true,
      suggestion: { action: 'retry', fix: 'Add params object' }
    },
    server,
    client
  );
  
  assertEqual(errorResponse.re, badQuery.id);
  assertEqual(errorResponse.p.code, 'E_MISSING_FIELD');
  assertTrue(errorResponse.p.recoverable);
});

// ============================================================================
// Summary
// ============================================================================

console.log('\n' + '─'.repeat(50));
console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  console.log('\n❌ Failed tests:');
  errors.forEach(e => console.log(`   • ${e.name}: ${e.error}`));
  process.exit(1);
} else {
  console.log('\n✅ All tests passed!');
  process.exit(0);
}
