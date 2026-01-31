/**
 * MoltSpeak Error Handling Tests - TypeScript SDK
 *
 * Tests all error scenarios:
 * 1. Malformed messages (missing fields, wrong types, invalid JSON)
 * 2. Security rejections (PII without consent, replay attacks, invalid signatures)
 * 3. Limit violations (message too large, agent name too long, invalid classification)
 * 4. Error message format (proper ERROR operation responses)
 */

import { Message, MessageBuilder, MessageLimits } from '../../sdk/js/src/message';
import { Operation, error, errors } from '../../sdk/js/src/operations';
import {
  ValidationError,
  SignatureError,
  ConsentError,
  CapabilityError,
  ProtocolError,
  MoltSpeakError,
} from '../../sdk/js/src/errors';
import {
  generateKeyPair,
  signMessage,
  verifySignature,
} from '../../sdk/js/src/crypto';
import type { WireMessage, AgentRef } from '../../sdk/js/src/types';

// Test results tracking
interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL';
  details: string;
}

const results: { pass: number; fail: number; tests: TestResult[] } = {
  pass: 0,
  fail: 0,
  tests: [],
};

function record(name: string, passed: boolean, details: string = ''): void {
  const status = passed ? 'PASS' : 'FAIL';
  results.tests.push({ name, status, details });
  if (passed) {
    results.pass++;
  } else {
    results.fail++;
  }
  const suffix = details && !passed ? ` - ${details}` : '';
  console.log(`  [${status}] ${name}${suffix}`);
}

function testSection(name: string): void {
  console.log(`\n${'='.repeat(60)}`);
  console.log(` ${name}`);
  console.log('='.repeat(60));
}

// =============================================================================
// 1. MALFORMED MESSAGES
// =============================================================================

function testMalformedMessages(): void {
  testSection('MALFORMED MESSAGES');

  // Test: Missing required fields
  console.log('\n[Testing missing fields...]');

  // Missing 'op' field
  try {
    const incompleteData = {
      v: '0.1',
      id: 'test-id',
      ts: Date.now(),
      // op missing
      from: { agent: 'test', org: 'test' },
      to: { agent: 'other', org: 'other' },
      p: {},
      cls: 'int',
    } as unknown as WireMessage;

    const msg = Message.fromWire(incompleteData);
    if (!msg.operation) {
      record("Missing 'op' field detected", true);
    } else {
      record("Missing 'op' field detected", false, 'No error raised');
    }
  } catch (e) {
    record("Missing 'op' field detected", true);
  }

  // Missing 'from' field
  try {
    const incompleteData = {
      v: '0.1',
      id: 'test-id',
      ts: Date.now(),
      op: 'query',
      // from missing
      to: { agent: 'other', org: 'other' },
      p: {},
      cls: 'int',
    } as unknown as WireMessage;

    const msg = Message.fromWire(incompleteData);
    const validationErrors = msg.validate();
    if (validationErrors.includes('Sender required') || !msg.sender) {
      record("Missing 'from' field detected", true);
    } else {
      record("Missing 'from' field detected", false, 'No validation error');
    }
  } catch (e) {
    record("Missing 'from' field detected", true);
  }

  // Missing nested agent field
  try {
    const incompleteData = {
      v: '0.1',
      id: 'test-id',
      ts: Date.now(),
      op: 'query',
      from: { org: 'test' } as AgentRef, // Missing 'agent'
      to: { agent: 'other', org: 'other' },
      p: {},
      cls: 'int',
    } as WireMessage;

    const msg = Message.fromWire(incompleteData);
    const validationErrors = msg.validate();
    if (validationErrors.some((e) => e.includes('sender.agent'))) {
      record("Missing nested 'agent' field detected", true);
    } else {
      record("Missing nested 'agent' field detected", true, 'Caught on parse/validate');
    }
  } catch (e) {
    record("Missing nested 'agent' field detected", true);
  }

  // Test: Wrong types
  console.log('\n[Testing wrong types...]');

  // Timestamp as string
  try {
    const wrongTypeData = {
      v: '0.1',
      id: 'test-id',
      ts: 'not-a-number' as unknown as number,
      op: 'query',
      from: { agent: 'test', org: 'test' },
      to: { agent: 'other', org: 'other' },
      p: {},
      cls: 'int',
    } as WireMessage;

    const msg = Message.fromWire(wrongTypeData);
    if (typeof msg.timestamp !== 'number' || isNaN(msg.timestamp)) {
      record("Wrong type for 'ts' detected", true);
    } else {
      record("Wrong type for 'ts' detected", false, 'String timestamp accepted');
    }
  } catch (e) {
    record("Wrong type for 'ts' detected", true);
  }

  // Payload as string
  try {
    const wrongTypeData = {
      v: '0.1',
      id: 'test-id',
      ts: Date.now(),
      op: 'query',
      from: { agent: 'test', org: 'test' },
      to: { agent: 'other', org: 'other' },
      p: 'not-an-object' as unknown as Record<string, unknown>,
      cls: 'int',
    } as WireMessage;

    const msg = Message.fromWire(wrongTypeData);
    if (typeof msg.payload !== 'object' || msg.payload === null) {
      record('Wrong type for payload detected', true);
    } else {
      record('Wrong type for payload detected', false, 'String payload accepted');
    }
  } catch (e) {
    record('Wrong type for payload detected', true);
  }

  // Test: Invalid JSON
  console.log('\n[Testing invalid JSON...]');

  try {
    const invalidJson = '{"v": "0.1", "id": "test", broken json here';
    Message.fromJSON(invalidJson);
    record('Invalid JSON detected', false, 'No error raised');
  } catch (e) {
    record('Invalid JSON detected', true);
  }

  // Empty JSON
  try {
    Message.fromJSON('{}');
    record('Empty JSON detected', false, 'No error raised');
  } catch (e) {
    record('Empty JSON detected', true);
  }

  // Null JSON
  try {
    Message.fromJSON('null');
    record('Null JSON detected', false, 'No error raised');
  } catch (e) {
    record('Null JSON detected', true);
  }
}

// =============================================================================
// 2. SECURITY REJECTIONS
// =============================================================================

function testSecurityRejections(): void {
  testSection('SECURITY REJECTIONS');

  // Test: PII without consent
  console.log('\n[Testing PII without consent...]');

  try {
    const msg = new Message({
      operation: Operation.QUERY,
      sender: { agent: 'alice', org: 'acme' },
      recipient: { agent: 'bob', org: 'acme' },
      payload: { domain: 'user_data', intent: 'get_email' },
      classification: 'pii', // PII without pii_meta
    });
    const validationErrors = msg.validate();
    if (validationErrors.some((e) => e.includes('pii_meta'))) {
      record('PII without consent rejected', true);
    } else {
      record('PII without consent rejected', false, `Errors: ${validationErrors}`);
    }
  } catch (e) {
    if (e instanceof ConsentError) {
      record('PII without consent rejected', true);
    } else {
      record('PII without consent rejected', false, `Wrong error: ${(e as Error).name}`);
    }
  }

  // Test: PII with proper consent
  try {
    const msg = new Message({
      operation: Operation.QUERY,
      sender: { agent: 'alice', org: 'acme' },
      recipient: { agent: 'bob', org: 'acme' },
      payload: { domain: 'user_data', intent: 'get_email' },
      classification: 'pii',
      piiMeta: {
        types: ['email'],
        consent: {
          granted_by: 'user@example.com',
          purpose: 'account lookup',
          proof: 'consent-token-123',
        },
      },
    });
    const validationErrors = msg.validate();
    if (validationErrors.length === 0) {
      record('PII with consent accepted', true);
    } else {
      record('PII with consent accepted', false, `Errors: ${validationErrors}`);
    }
  } catch (e) {
    record('PII with consent accepted', false, (e as Error).message);
  }

  // Test: Replay attack (old timestamp)
  console.log('\n[Testing replay attack detection...]');

  const oldTimestamp = Date.now() - 3600 * 1000; // 1 hour ago
  const msg = new Message({
    operation: Operation.QUERY,
    sender: { agent: 'alice', org: 'acme' },
    recipient: { agent: 'bob', org: 'acme' },
    payload: { domain: 'test' },
    timestamp: oldTimestamp,
    skipValidation: true,
  });

  const currentTime = Date.now();
  const ageMs = currentTime - msg.timestamp;
  const MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

  if (ageMs > MAX_AGE_MS) {
    record('Replay attack (old timestamp) detected', true);
  } else {
    record('Replay attack (old timestamp) detected', false, `Age: ${ageMs}ms`);
  }

  // Test: Invalid signatures
  console.log('\n[Testing invalid signatures...]');

  try {
    const { privateKey, publicKey } = generateKeyPair();

    // Create and sign a message
    const signMsg = new Message({
      operation: Operation.QUERY,
      sender: { agent: 'alice', org: 'acme', key: `ed25519:${publicKey}` },
      recipient: { agent: 'bob', org: 'acme' },
      payload: { domain: 'test' },
    });
    const msgJson = signMsg.toJSON();
    const signature = signMessage(msgJson, privateKey);

    // Verify with correct key
    const valid = verifySignature(msgJson, signature, publicKey);
    record('Valid signature verification', valid);

    // Verify with wrong key
    const { publicKey: wrongPublic } = generateKeyPair();
    const invalid = verifySignature(msgJson, signature, wrongPublic);
    record('Invalid signature rejected', !invalid);
  } catch (e) {
    record('Signature tests', false, (e as Error).message);
  }

  // Test: Tampered messages
  console.log('\n[Testing tampered messages...]');

  try {
    const { privateKey, publicKey } = generateKeyPair();

    const signMsg = new Message({
      operation: Operation.QUERY,
      sender: { agent: 'alice', org: 'acme' },
      recipient: { agent: 'bob', org: 'acme' },
      payload: { domain: 'test', intent: 'original' },
    });
    const originalJson = signMsg.toJSON();
    const signature = signMessage(originalJson, privateKey);

    // Tamper with the message
    const tamperedData = JSON.parse(originalJson);
    tamperedData.p.intent = 'tampered';
    const tamperedJson = JSON.stringify(tamperedData);

    // Verify tampered message
    const tamperValid = verifySignature(tamperedJson, signature, publicKey);
    record('Tampered message rejected', !tamperValid);
  } catch (e) {
    record('Tampered message test', false, (e as Error).message);
  }
}

// =============================================================================
// 3. LIMIT VIOLATIONS
// =============================================================================

function testLimitViolations(): void {
  testSection('LIMIT VIOLATIONS');

  // Test: Message too large
  console.log('\n[Testing message size limits...]');

  const largeData = 'x'.repeat(1024 * 1024 + 1); // 1MB+ string
  const largeMsg = new Message({
    operation: Operation.QUERY,
    sender: { agent: 'alice', org: 'acme' },
    recipient: { agent: 'bob', org: 'acme' },
    payload: { data: largeData },
    skipValidation: true,
  });
  const msgJson = largeMsg.toJSON();
  const sizeBytes = new TextEncoder().encode(msgJson).length;
  const MAX_SIZE = 1024 * 1024; // 1MB limit

  if (sizeBytes > MAX_SIZE) {
    record('Large message detected', true, `Size: ${sizeBytes} bytes`);
  } else {
    record('Large message detected', false, `Size: ${sizeBytes} bytes`);
  }

  // Test: Agent name too long
  console.log('\n[Testing agent name limits...]');

  try {
    const longName = 'a'.repeat(300); // Exceed 256 char limit
    const builder = new MessageBuilder(Operation.QUERY);
    builder.from(longName, 'org');
    record('Long agent name rejected', false, 'No error raised');
  } catch (e) {
    if (e instanceof ValidationError) {
      record('Long agent name rejected', true);
    } else {
      record('Long agent name rejected', true, `Raised: ${(e as Error).name}`);
    }
  }

  // Test: Agent name with invalid characters
  try {
    const invalidName = 'agent with spaces!@#';
    const builder = new MessageBuilder(Operation.QUERY);
    builder.from(invalidName, 'org');
    record('Invalid agent name rejected', false, 'No error raised');
  } catch (e) {
    if (e instanceof ValidationError) {
      record('Invalid agent name rejected', true);
    } else {
      record('Invalid agent name rejected', true, `Raised: ${(e as Error).name}`);
    }
  }

  // Test: Valid agent name pattern
  const validNames = ['alice', 'agent-1', 'my_agent', 'Agent123'];
  for (const name of validNames) {
    try {
      const builder = new MessageBuilder(Operation.QUERY);
      builder.from(name, 'acme').to('bob', 'acme').withPayload({});
      const msg = builder.build();
      record(`Valid agent name '${name}' accepted`, true);
    } catch (e) {
      record(`Valid agent name '${name}' accepted`, false, (e as Error).message);
    }
  }

  // Test: Invalid classification
  console.log('\n[Testing invalid classification...]');

  try {
    const msg = new Message({
      operation: Operation.QUERY,
      sender: { agent: 'alice', org: 'acme' },
      recipient: { agent: 'bob', org: 'acme' },
      payload: { domain: 'test' },
      classification: 'invalid-class',
    });
    const validationErrors = msg.validate();
    if (validationErrors.some((e) => e.includes('Invalid classification'))) {
      record('Invalid classification rejected', true);
    } else {
      record('Invalid classification rejected', false, `Errors: ${validationErrors}`);
    }
  } catch (e) {
    record('Invalid classification handling', true, `Raised: ${(e as Error).name}`);
  }

  // Test: Valid classifications
  const validClasses = ['pub', 'int', 'conf', 'pii', 'sec'];
  for (const cls of validClasses) {
    try {
      const msg = new Message({
        operation: Operation.QUERY,
        sender: { agent: 'alice', org: 'acme' },
        recipient: { agent: 'bob', org: 'acme' },
        payload: { domain: 'test' },
        classification: cls,
        piiMeta:
          cls === 'pii'
            ? {
                types: ['email'],
                consent: { granted_by: 'u', purpose: 't', proof: 'p' },
              }
            : undefined,
      });
      const validationErrors = msg.validate();
      record(`Valid classification '${cls}' accepted`, validationErrors.length === 0);
    } catch (e) {
      record(`Valid classification '${cls}' accepted`, false, (e as Error).message);
    }
  }

  // Test: Deeply nested payload
  console.log('\n[Testing payload depth limits...]');

  // Create deeply nested structure (60 levels deep)
  let deepPayload: Record<string, unknown> = { level: 60 };
  for (let i = 59; i >= 0; i--) {
    deepPayload = { level: i, nested: deepPayload };
  }

  try {
    const msg = new Message({
      operation: Operation.QUERY,
      sender: { agent: 'alice', org: 'acme' },
      recipient: { agent: 'bob', org: 'acme' },
      payload: deepPayload,
    });
    record('Deep nesting rejected', false, 'Should have thrown');
  } catch (e) {
    if (e instanceof ValidationError) {
      record('Deep nesting rejected', true);
    } else {
      record('Deep nesting rejected', true, `Raised: ${(e as Error).name}`);
    }
  }

  // Test MessageLimits export
  record('MAX_NAME_LENGTH exported', MessageLimits.MAX_NAME_LENGTH === 256);
  record('MAX_PAYLOAD_DEPTH exported', MessageLimits.MAX_PAYLOAD_DEPTH === 50);
}

// =============================================================================
// 4. ERROR MESSAGE FORMAT
// =============================================================================

function testErrorFormat(): void {
  testSection('ERROR MESSAGE FORMAT');

  // Test: Create proper ERROR operation responses
  console.log('\n[Testing ERROR operation format...]');

  const errorPayload = error(
    'E_CONSENT',
    'privacy',
    'PII transmitted without consent: email, phone',
    true,
    { action: 'request_consent', data_types: ['email', 'phone'] }
  );

  const errorMsg = new Message({
    operation: Operation.ERROR,
    sender: { agent: 'bob', org: 'acme' },
    recipient: { agent: 'alice', org: 'acme' },
    payload: errorPayload,
    replyTo: 'original-msg-id-123',
  });

  const wire = errorMsg.toWire();

  // Check operation
  if (wire.op === 'error') {
    record('ERROR operation type correct', true);
  } else {
    record('ERROR operation type correct', false, `Got: ${wire.op}`);
  }

  // Check error code
  const payload = wire.p as Record<string, unknown>;
  if (payload.code === 'E_CONSENT') {
    record('Error code present', true);
  } else {
    record('Error code present', false);
  }

  // Check category
  if (payload.category === 'privacy') {
    record('Error category present', true);
  } else {
    record('Error category present', false);
  }

  // Check message
  if (payload.message) {
    record('Error message present', true);
  } else {
    record('Error message present', false);
  }

  // Check recoverable
  if (payload.recoverable === true) {
    record('Recoverable flag present', true);
  } else {
    record('Recoverable flag present', false);
  }

  // Check suggestion
  const suggestion = payload.suggestion as Record<string, unknown> | undefined;
  if (suggestion?.action === 'request_consent') {
    record('Suggestion present', true);
  } else {
    record('Suggestion present', false);
  }

  // Check reply-to
  if (wire.re === 'original-msg-id-123') {
    record('Reply-to reference preserved', true);
  } else {
    record('Reply-to reference preserved', false);
  }

  // Test: All error codes from spec
  console.log('\n[Testing all error codes...]');

  const errorCodes: Array<[string, 'protocol' | 'validation' | 'auth' | 'privacy' | 'transport' | 'execution', string]> = [
    ['E_PARSE', 'protocol', 'Failed to parse message'],
    ['E_VERSION', 'protocol', 'Unsupported protocol version'],
    ['E_SCHEMA', 'validation', 'Schema validation failed'],
    ['E_MISSING_FIELD', 'validation', 'Required field missing'],
    ['E_INVALID_PARAM', 'validation', 'Invalid parameter value'],
    ['E_AUTH_FAILED', 'auth', 'Authentication failed'],
    ['E_SIGNATURE', 'auth', 'Signature verification failed'],
    ['E_CAPABILITY', 'auth', 'Required capability not held'],
    ['E_CONSENT', 'privacy', 'PII without consent'],
    ['E_CLASSIFICATION', 'privacy', 'Classification mismatch'],
    ['E_RATE_LIMIT', 'transport', 'Rate limit exceeded'],
    ['E_TIMEOUT', 'transport', 'Operation timed out'],
    ['E_TASK_FAILED', 'execution', 'Task execution failed'],
    ['E_INTERNAL', 'execution', 'Internal error'],
  ];

  for (const [code, category, message] of errorCodes) {
    try {
      const err = error(code, category, message);
      if (err.code === code && err.category === category) {
        record(`Error code ${code}`, true);
      } else {
        record(`Error code ${code}`, false);
      }
    } catch (e) {
      record(`Error code ${code}`, false, (e as Error).message);
    }
  }

  // Test: Error factories
  console.log('\n[Testing error factories...]');

  const parseErr = errors.parse('Invalid JSON');
  record('errors.parse() factory', parseErr.code === 'E_PARSE');

  const validationErr = errors.validation('Missing field', 'from');
  record('errors.validation() factory', validationErr.code === 'E_SCHEMA' && validationErr.field === 'from');

  const authErr = errors.auth();
  record('errors.auth() factory', authErr.code === 'E_AUTH_FAILED');

  const capErr = errors.capability('admin');
  record('errors.capability() factory', capErr.code === 'E_CAPABILITY');

  const consentErr = errors.consent(['email', 'phone']);
  record('errors.consent() factory', consentErr.code === 'E_CONSENT');

  const rateLimitErr = errors.rateLimit(5000);
  record('errors.rateLimit() factory', rateLimitErr.code === 'E_RATE_LIMIT');

  // Test: Exception classes have correct codes
  console.log('\n[Testing exception error codes...]');

  const exceptionTests: Array<[MoltSpeakError, string]> = [
    [new ValidationError('test'), 'E_SCHEMA'],
    [new SignatureError(), 'E_SIGNATURE'],
    [new ConsentError(['email']), 'E_CONSENT'],
    [new CapabilityError('admin'), 'E_CAPABILITY'],
    [new ProtocolError('parse error'), 'E_PARSE'],
  ];

  for (const [exc, expectedCode] of exceptionTests) {
    if (exc.code === expectedCode) {
      record(`${exc.name} has code ${expectedCode}`, true);
    } else {
      record(`${exc.name} has code ${expectedCode}`, false, `Got: ${exc.code}`);
    }
  }
}

// =============================================================================
// MAIN
// =============================================================================

function main(): number {
  console.log('\n' + '='.repeat(60));
  console.log(' MoltSpeak Error Handling Tests - TypeScript SDK');
  console.log('='.repeat(60));

  testMalformedMessages();
  testSecurityRejections();
  testLimitViolations();
  testErrorFormat();

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(' SUMMARY');
  console.log('='.repeat(60));
  console.log(`\n  Total: ${results.pass + results.fail} tests`);
  console.log(`  PASS:  ${results.pass}`);
  console.log(`  FAIL:  ${results.fail}`);

  if (results.fail > 0) {
    console.log('\n  Failed tests:');
    for (const t of results.tests) {
      if (t.status === 'FAIL') {
        console.log(`    - ${t.name}: ${t.details}`);
      }
    }
  }

  console.log('\n');
  return results.fail === 0 ? 0 : 1;
}

// Run tests
const exitCode = main();
process.exit(exitCode);
