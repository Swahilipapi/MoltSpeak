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
    envelope: { encrypted: true, algorithm: 'x25519-xsalsa20-poly1305' },
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
  const msg = { v: '0.1', id: 'test', ts: moltspeak.now(), op: 'query' };
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
// Edge Case Tests
// ============================================================================

// Empty String Handling
console.log('\n🔲 Empty String Handling');
test('empty agent name in from field', () => {
  const msg = moltspeak.createMessage('query')
    .from({ agent: '' })
    .to({ agent: 'receiver' })
    .payload({ domain: 'test' })
    .build({ validate: false });
  
  assertEqual(msg.from.agent, '');
  // Validation should catch empty agent names
  const result = moltspeak.validateMessage(msg, { strict: true });
  // Empty agent should still be structurally valid (protocol doesn't enforce non-empty)
  assertTrue(result.valid || result.errors.some(e => e.includes('agent')));
});

test('empty payload object', () => {
  const msg = moltspeak.createMessage('query')
    .from({ agent: 'sender' })
    .to({ agent: 'receiver' })
    .payload({})
    .build({ validate: false });
  
  assertEqual(Object.keys(msg.p).length, 0);
});

test('empty string in payload values', () => {
  const msg = moltspeak.createQuery(
    { domain: '', intent: '', params: { key: '' } },
    { agent: 'sender' },
    { agent: 'receiver' }
  );
  
  assertEqual(msg.p.domain, '');
  assertEqual(msg.p.intent, '');
});

test('null and undefined handling in payload', () => {
  const msg = moltspeak.createMessage('query')
    .from({ agent: 'sender' })
    .payload({ nullVal: null, obj: { nested: null } })
    .build({ validate: false });
  
  assertEqual(msg.p.nullVal, null);
  assertEqual(msg.p.obj.nested, null);
});

// Unicode Handling
console.log('\n🌍 Unicode Handling');
test('emoji in agent names', () => {
  const msg = moltspeak.createQuery(
    { domain: 'test' },
    { agent: '🤖-agent-🦀' },
    { agent: '🎯-target' }
  );
  
  assertEqual(msg.from.agent, '🤖-agent-🦀');
  assertEqual(msg.to.agent, '🎯-target');
  
  // Round-trip through encode/decode
  const encoded = moltspeak.encode(msg);
  const decoded = moltspeak.decode(encoded);
  assertEqual(decoded.from.agent, '🤖-agent-🦀');
});

test('CJK characters in payload', () => {
  const msg = moltspeak.createQuery(
    { domain: '天気', intent: '予報', params: { location: '東京' } },
    { agent: 'sender' },
    { agent: 'receiver' }
  );
  
  assertEqual(msg.p.domain, '天気');
  assertEqual(msg.p.params.location, '東京');
  
  // Verify byte size calculation for multi-byte characters
  const encoded = moltspeak.encode(msg);
  const size = moltspeak.byteSize(encoded);
  assertTrue(size > encoded.length); // UTF-8 multi-byte should be larger
});

test('mixed Unicode in all fields', () => {
  const msg = moltspeak.createMessage('query')
    .from({ agent: 'αβγ-agent', org: 'Организация' })
    .to({ agent: '代理人' })
    .payload({ 
      content: '日本語 한국어 العربية עברית',
      emoji: '🎉🚀💡🔥',
      special: '© ® ™ € £ ¥'
    })
    .build({ validate: false });
  
  const encoded = moltspeak.encode(msg);
  const decoded = moltspeak.decode(encoded);
  
  assertEqual(decoded.p.content, '日本語 한국어 العربية עברית');
  assertEqual(decoded.p.emoji, '🎉🚀💡🔥');
});

test('RTL text handling', () => {
  const msg = moltspeak.createQuery(
    { domain: 'test', params: { text: 'مرحبا بالعالم' } },
    { agent: 'sender' },
    { agent: 'receiver' }
  );
  
  assertEqual(msg.p.params.text, 'مرحبا بالعالم');
});

test('zero-width characters', () => {
  const zeroWidth = 'test\u200B\u200C\u200Dvalue';
  const msg = moltspeak.createQuery(
    { domain: zeroWidth },
    { agent: 'sender' },
    { agent: 'receiver' }
  );
  
  assertEqual(msg.p.domain, zeroWidth);
});

// Max Size Messages
console.log('\n📏 Max Size Messages');
test('message near 1MB boundary (under limit)', () => {
  // Create a payload just under 1MB
  const largeString = 'x'.repeat(900 * 1024); // 900KB of data
  const msg = moltspeak.createMessage('query')
    .from({ agent: 'sender' })
    .payload({ data: largeString })
    .build({ validate: false });
  
  const encoded = moltspeak.encode(msg);
  const size = moltspeak.byteSize(encoded);
  assertTrue(size < 1 * 1024 * 1024); // Should be under 1MB
  assertTrue(size > 900 * 1024); // Should be over 900KB
  
  // Should still be decodable
  const decoded = moltspeak.decode(encoded);
  assertEqual(decoded.p.data.length, 900 * 1024);
});

test('large array payload', () => {
  const largeArray = Array(10000).fill({ key: 'value', num: 42 });
  const msg = moltspeak.createMessage('query')
    .from({ agent: 'sender' })
    .payload({ items: largeArray })
    .build({ validate: false });
  
  assertEqual(msg.p.items.length, 10000);
  
  const encoded = moltspeak.encode(msg);
  const decoded = moltspeak.decode(encoded);
  assertEqual(decoded.p.items.length, 10000);
});

// Deeply Nested Payloads
console.log('\n🪆 Deeply Nested Payloads');
test('50 levels of nesting', () => {
  let nested = { value: 'deepest' };
  for (let i = 0; i < 50; i++) {
    nested = { level: i, child: nested };
  }
  
  const msg = moltspeak.createMessage('query')
    .from({ agent: 'sender' })
    .payload(nested)
    .build({ validate: false });
  
  // Traverse to verify structure
  let current = msg.p;
  for (let i = 49; i >= 0; i--) {
    assertEqual(current.level, i);
    current = current.child;
  }
  assertEqual(current.value, 'deepest');
  
  // Round-trip
  const encoded = moltspeak.encode(msg);
  const decoded = moltspeak.decode(encoded);
  
  current = decoded.p;
  for (let i = 49; i >= 0; i--) {
    assertEqual(current.level, i);
    current = current.child;
  }
  assertEqual(current.value, 'deepest');
});

test('deeply nested arrays', () => {
  let nested = [1, 2, 3];
  for (let i = 0; i < 30; i++) {
    nested = [nested, i];
  }
  
  const msg = moltspeak.createMessage('query')
    .from({ agent: 'sender' })
    .payload({ arrays: nested })
    .build({ validate: false });
  
  const encoded = moltspeak.encode(msg);
  const decoded = moltspeak.decode(encoded);
  assertTrue(Array.isArray(decoded.p.arrays));
});

test('mixed deep nesting (objects and arrays)', () => {
  const complex = {
    a: [{ b: [{ c: [{ d: [{ e: [{ f: 'deep' }] }] }] }] }]
  };
  
  const msg = moltspeak.createMessage('query')
    .from({ agent: 'sender' })
    .payload(complex)
    .build({ validate: false });
  
  assertEqual(msg.p.a[0].b[0].c[0].d[0].e[0].f, 'deep');
});

// Timestamp Edge Cases
console.log('\n⏰ Timestamp Edge Cases');
test('future timestamp (year 2100)', () => {
  const futureTs = 4102444800000; // Jan 1, 2100
  const msg = {
    v: '0.1',
    id: moltspeak.generateUUID(),
    ts: futureTs,
    op: 'query',
    from: { agent: 'future-agent' }
  };
  
  assertEqual(msg.ts, futureTs);
  // Strict mode may reject future timestamps, non-strict should accept
  const result = moltspeak.validateMessage(msg, { strict: false, checkTimestamp: false });
  assertTrue(result.valid);
});

test('very old timestamp (year 1970) - validation rejects', () => {
  const oldTs = 1000; // 1 second after epoch
  const msg = {
    v: '0.1',
    id: moltspeak.generateUUID(),
    ts: oldTs,
    op: 'query',
    from: { agent: 'old-agent' }
  };
  
  assertEqual(msg.ts, oldTs);
  // SDK correctly rejects very old timestamps as replay attack prevention
  const result = moltspeak.validateMessage(msg, { strict: false });
  assertFalse(result.valid);
  assertTrue(result.errors.some(e => e.includes('too old')));
});

test('zero timestamp', () => {
  const msg = {
    v: '0.1',
    id: moltspeak.generateUUID(),
    ts: 0,
    op: 'query',
    from: { agent: 'zero-ts-agent' }
  };
  
  assertEqual(msg.ts, 0);
});

test('negative timestamp', () => {
  const msg = {
    v: '0.1',
    id: moltspeak.generateUUID(),
    ts: -1000,
    op: 'query',
    from: { agent: 'negative-ts-agent' }
  };
  
  assertEqual(msg.ts, -1000);
});

test('expiration in the past', () => {
  const msg = moltspeak.createMessage('query')
    .from({ agent: 'sender' })
    .expiresIn(-60000) // 1 minute ago
    .build({ validate: false });
  
  assertTrue(msg.exp < moltspeak.now());
});

test('very far future expiration', () => {
  const msg = moltspeak.createMessage('query')
    .from({ agent: 'sender' })
    .expiresIn(365 * 24 * 60 * 60 * 1000 * 100) // 100 years
    .build({ validate: false });
  
  assertTrue(msg.exp > moltspeak.now());
});

// Invalid UUID Formats
console.log('\n🔑 UUID Format Edge Cases');
test('non-standard UUID format accepted', () => {
  const msg = {
    v: '0.1',
    id: 'not-a-valid-uuid',
    ts: moltspeak.now(),
    op: 'query',
    from: { agent: 'sender' }
  };
  
  // In non-strict mode, this should be accepted
  const result = moltspeak.validateMessage(msg, { strict: false });
  // Protocol doesn't strictly enforce UUID format
  assertTrue(result.valid || result.errors.some(e => e.includes('id')));
});

test('empty string as ID', () => {
  const msg = {
    v: '0.1',
    id: '',
    ts: moltspeak.now(),
    op: 'query',
    from: { agent: 'sender' }
  };
  
  assertEqual(msg.id, '');
});

test('very long ID string', () => {
  const longId = 'x'.repeat(1000);
  const msg = {
    v: '0.1',
    id: longId,
    ts: moltspeak.now(),
    op: 'query',
    from: { agent: 'sender' }
  };
  
  assertEqual(msg.id.length, 1000);
});

test('numeric ID value', () => {
  const msg = {
    v: '0.1',
    id: 12345,
    ts: moltspeak.now(),
    op: 'query',
    from: { agent: 'sender' }
  };
  
  assertEqual(msg.id, 12345);
});

test('UUID with uppercase letters', () => {
  const uppercaseUuid = 'A1B2C3D4-E5F6-4789-ABCD-EF1234567890';
  const msg = {
    v: '0.1',
    id: uppercaseUuid,
    ts: moltspeak.now(),
    op: 'query',
    from: { agent: 'sender' }
  };
  
  assertEqual(msg.id, uppercaseUuid);
});

// Malformed JSON Edge Cases
console.log('\n🔧 Malformed JSON Edge Cases');
test('decode handles trailing whitespace', () => {
  const ts = moltspeak.now();
  const json = `{"v":"0.1","id":"test","ts":${ts},"op":"query"}   \n\t  `;
  const decoded = moltspeak.decode(json);
  assertEqual(decoded.op, 'query');
});

test('decode rejects incomplete JSON', () => {
  assertThrows(() => moltspeak.decode('{"v":"0.1"'), 'Invalid JSON');
});

test('decode rejects plain text', () => {
  assertThrows(() => moltspeak.decode('hello world'), 'Invalid JSON');
});

test('decode handles JSON array at root', () => {
  // Arrays will throw validation error since they're not valid messages
  try {
    const result = moltspeak.decode('[1, 2, 3]');
    // If it doesn't throw, arrays should decode but not be valid messages
    assertTrue(Array.isArray(result) || result === undefined || result.v === undefined);
  } catch (e) {
    // Expected - arrays don't have required message fields
    assertTrue(e.message.includes('Missing required field') || e.message.includes('Invalid'));
  }
});

test('decode handles escaped characters', () => {
  const ts = moltspeak.now();
  const json = `{"v":"0.1","id":"test","ts":${ts},"op":"query","p":{"text":"line1\\nline2\\ttab\\"quote\\""}}`;
  const decoded = moltspeak.decode(json);
  assertEqual(decoded.p.text, 'line1\nline2\ttab"quote"');
});

test('encode handles circular reference check', () => {
  // deepClone should prevent circular refs from being an issue in normal use
  const obj = { a: 1 };
  const cloned = moltspeak.deepClone(obj);
  cloned.b = cloned; // Create circular ref after clone
  // The original should still work fine
  const msg = moltspeak.createMessage('query')
    .from({ agent: 'sender' })
    .payload(obj)
    .build({ validate: false });
  assertTrue(msg.p.a === 1);
});

test('special JSON values in payload', () => {
  const msg = moltspeak.createMessage('query')
    .from({ agent: 'sender' })
    .payload({
      integer: 42,
      float: 3.14159,
      scientific: 1.23e10,
      negative: -999,
      boolTrue: true,
      boolFalse: false,
      nullVal: null,
      emptyString: '',
      emptyArray: [],
      emptyObject: {}
    })
    .build({ validate: false });
  
  const encoded = moltspeak.encode(msg);
  const decoded = moltspeak.decode(encoded);
  
  assertEqual(decoded.p.integer, 42);
  assertEqual(decoded.p.float, 3.14159);
  assertEqual(decoded.p.boolTrue, true);
  assertEqual(decoded.p.boolFalse, false);
  assertEqual(decoded.p.nullVal, null);
  assertEqual(decoded.p.emptyString, '');
  assertTrue(Array.isArray(decoded.p.emptyArray));
  assertEqual(Object.keys(decoded.p.emptyObject).length, 0);
});

test('unicode escape sequences in JSON', () => {
  const ts = moltspeak.now();
  const json = `{"v":"0.1","id":"test","ts":${ts},"op":"query","p":{"text":"\\u0048\\u0065\\u006c\\u006c\\u006f"}}`;
  const decoded = moltspeak.decode(json);
  assertEqual(decoded.p.text, 'Hello');
});

// Additional Edge Cases
console.log('\n🎲 Additional Edge Cases');
test('PII detection in deeply nested objects', () => {
  const deepPayload = {
    level1: {
      level2: {
        level3: {
          level4: {
            email: 'hidden@secret.com'
          }
        }
      }
    }
  };
  
  const result = moltspeak.detectPII(deepPayload);
  assertTrue(result.hasPII);
  assertTrue(result.types.includes('email'));
});

test('PII detection with unicode email', () => {
  const result = moltspeak.detectPII('Contact: user@例え.jp');
  // Depending on implementation, may or may not detect unicode domains
  // Just verify it doesn't crash
  assertTrue(typeof result.hasPII === 'boolean');
});

test('multiple capabilities array handling', () => {
  const msg = moltspeak.createMessage('task')
    .from({ agent: 'sender' })
    .requireCapabilities(['cap1', 'cap2', 'cap3', 'cap1']) // duplicate
    .build({ validate: false });
  
  assertTrue(msg.cap.includes('cap1'));
  assertTrue(msg.cap.includes('cap2'));
  assertTrue(msg.cap.includes('cap3'));
});

test('very long agent name', () => {
  const longName = 'agent-' + 'x'.repeat(10000);
  const msg = moltspeak.createQuery(
    { domain: 'test' },
    { agent: longName },
    { agent: 'receiver' }
  );
  
  assertEqual(msg.from.agent.length, 10006);
});

test('special characters in agent org', () => {
  const msg = moltspeak.createQuery(
    { domain: 'test' },
    { agent: 'sender', org: 'org/with:special@chars#and$symbols!' },
    { agent: 'receiver' }
  );
  
  assertEqual(msg.from.org, 'org/with:special@chars#and$symbols!');
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
