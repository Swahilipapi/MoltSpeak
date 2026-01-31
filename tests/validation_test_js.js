#!/usr/bin/env node
/**
 * MoltSpeak Validation Test Suite - JavaScript SDK
 * Tests ALL validation scenarios
 */

'use strict';

const path = require('path');
const moltspeak = require(path.join(__dirname, '..', 'sdk', 'js', 'moltspeak.js'));

const {
  validateMessage,
  CLASSIFICATIONS,
  SIZE_LIMITS,
  now,
  generateUUID,
  detectPII,
  MessageBuilder,
  OPERATIONS
} = moltspeak;

function printSection(title) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('='.repeat(60));
}

function printTest(name, passed, details = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`  ${status}: ${name}`);
  if (details) {
    details.split('\n').forEach(line => {
      console.log(`         ${line}`);
    });
  }
}

function byteSize(str) {
  return Buffer.byteLength(str, 'utf8');
}

function runTests() {
  console.log('\n' + '='.repeat(60));
  console.log('  MOLTSPEAK JS SDK - VALIDATION TEST SUITE');
  console.log('='.repeat(60));
  
  const results = { passed: 0, failed: 0, tests: [] };
  
  // =========================================================================
  // 1. REQUIRED FIELDS VALIDATION
  // =========================================================================
  printSection('1. REQUIRED FIELDS VALIDATION');
  
  const baseMsg = {
    v: '0.1',
    id: generateUUID(),
    ts: now(),
    op: 'query',
    from: { agent: 'alice', org: 'test-org' },
    to: { agent: 'bob', org: 'test-org' },
    cls: 'int',
    p: {}
  };
  
  const requiredFields = ['v', 'id', 'ts', 'op', 'from', 'cls'];
  
  for (const field of requiredFields) {
    const msg = { ...baseMsg };
    delete msg[field];
    const result = validateMessage(msg, { strict: true, checkPII: false });
    const passed = !result.valid && result.errors.some(e => e.toLowerCase().includes(field.toLowerCase()));
    const errorMsg = result.errors.length ? result.errors.join('; ') : 'No errors';
    printTest(`Missing '${field}' field`, passed, `Errors: ${errorMsg}`);
    results.tests.push({ name: `missing_${field}`, passed, errors: result.errors });
    results[passed ? 'passed' : 'failed']++;
  }
  
  // Test with null/undefined values
  console.log('\n  Testing null values:');
  for (const field of requiredFields) {
    const msg = { ...baseMsg };
    msg[field] = null;
    const result = validateMessage(msg, { strict: true, checkPII: false });
    const passed = !result.valid;
    printTest(`'${field}' = null`, passed, `Errors: ${result.errors.join('; ')}`);
    results[passed ? 'passed' : 'failed']++;
  }
  
  // =========================================================================
  // 2. CLASSIFICATION LEVELS
  // =========================================================================
  printSection('2. CLASSIFICATION LEVELS');
  
  const validClassifications = ['pub', 'int', 'conf', 'pii', 'sec'];
  const invalidClassifications = ['public', 'private', 'secret', 'INTERNAL', 'PII', '', 'xyz123', null, undefined];
  
  console.log('\n  Valid classifications:');
  for (const cls of validClassifications) {
    const msg = { ...baseMsg };
    msg.cls = cls;
    if (cls === 'pii') {
      msg.pii_meta = { types: [], consent: { proof: 'test', granted_by: 'user', purpose: 'test' } };
    }
    const result = validateMessage(msg, { strict: true, checkPII: false });
    const passed = result.valid || !result.errors.some(e => e.includes('Invalid classification'));
    printTest(`cls='${cls}'`, passed, `Valid: ${result.valid}`);
    results[passed ? 'passed' : 'failed']++;
  }
  
  console.log('\n  Invalid classifications:');
  for (const cls of invalidClassifications) {
    const msg = { ...baseMsg };
    msg.cls = cls;
    const result = validateMessage(msg, { strict: true, checkPII: false });
    const passed = !result.valid && result.errors.some(e => e.toLowerCase().includes('classification'));
    const errorMsg = result.errors.join('; ');
    printTest(`cls='${cls}'`, passed, `Errors: ${errorMsg}`);
    results[passed ? 'passed' : 'failed']++;
  }
  
  // =========================================================================
  // 3. TIMESTAMP VALIDATION
  // =========================================================================
  printSection('3. TIMESTAMP VALIDATION');
  
  // Fresh timestamp (now)
  let msg = { ...baseMsg, ts: now() };
  let result = validateMessage(msg, { strict: true, checkPII: false });
  let passed = result.valid;
  printTest('Fresh timestamp (now)', passed, `Valid: ${result.valid}`);
  results[passed ? 'passed' : 'failed']++;
  
  // 4 minutes old (should pass - within 5 min window)
  msg = { ...baseMsg, ts: now() - (4 * 60 * 1000) };
  result = validateMessage(msg, { strict: true, checkPII: false });
  passed = result.valid;
  printTest('4 minutes old timestamp', passed, `Valid: ${result.valid}`);
  results[passed ? 'passed' : 'failed']++;
  
  // 6 minutes old (should fail - replay attack)
  msg = { ...baseMsg, ts: now() - (6 * 60 * 1000) };
  result = validateMessage(msg, { strict: true, checkPII: false });
  passed = !result.valid && result.errors.some(e => e.toLowerCase().includes('old') || e.toLowerCase().includes('replay'));
  const errorMsg6 = result.errors.join('; ');
  printTest('6 minutes old timestamp (replay attack)', passed, `Errors: ${errorMsg6}`);
  results[passed ? 'passed' : 'failed']++;
  
  // Future timestamp (1 minute ahead)
  msg = { ...baseMsg, ts: now() + (1 * 60 * 1000) };
  result = validateMessage(msg, { strict: true, checkPII: false });
  printTest('Future timestamp (+1 min)', true, `Valid: ${result.valid}, Warns: ${JSON.stringify(result.warnings)}`);
  
  // Negative timestamp
  msg = { ...baseMsg, ts: -1 };
  result = validateMessage(msg, { strict: true, checkPII: false });
  passed = !result.valid && result.errors.some(e => e.toLowerCase().includes('positive') || e.toLowerCase().includes('negative'));
  const errMsgNeg = result.errors.join('; ');
  printTest('Negative timestamp', passed, `Errors: ${errMsgNeg}`);
  results[passed ? 'passed' : 'failed']++;
  
  // Non-numeric timestamp
  msg = { ...baseMsg, ts: 'invalid' };
  result = validateMessage(msg, { strict: true, checkPII: false });
  passed = !result.valid;
  printTest('Non-numeric timestamp', passed, `Errors: ${result.errors.join('; ')}`);
  results[passed ? 'passed' : 'failed']++;
  
  // Zero timestamp
  msg = { ...baseMsg, ts: 0 };
  result = validateMessage(msg, { strict: true, checkPII: false });
  printTest('Zero timestamp', true, `Valid: ${result.valid}, Errors: ${result.errors.join('; ')}`);
  
  // =========================================================================
  // 4. SIZE LIMITS
  // =========================================================================
  printSection('4. SIZE LIMITS');
  
  // Under 1MB (valid)
  msg = { ...baseMsg, p: { data: 'x'.repeat(1000) } };
  result = validateMessage(msg, { strict: true, checkPII: false });
  passed = result.valid;
  printTest('Under 1MB message', passed, `Valid: ${result.valid}`);
  results[passed ? 'passed' : 'failed']++;
  
  // Exactly at limit (1MB)
  const baseSize = byteSize(JSON.stringify(baseMsg));
  const targetSize = SIZE_LIMITS.SINGLE_MESSAGE;
  const paddingNeeded = targetSize - baseSize - 50;
  msg = { ...baseMsg, p: { data: 'x'.repeat(paddingNeeded) } };
  let msgSize = byteSize(JSON.stringify(msg));
  result = validateMessage(msg, { strict: true, checkPII: false });
  printTest(`At ~1MB limit (${msgSize} bytes)`, result.valid, 
            `Valid: ${result.valid}, Limit: ${SIZE_LIMITS.SINGLE_MESSAGE}`);
  
  // Over 1MB (should fail)
  msg = { ...baseMsg, p: { data: 'x'.repeat(SIZE_LIMITS.SINGLE_MESSAGE + 1000) } };
  msgSize = byteSize(JSON.stringify(msg));
  result = validateMessage(msg, { strict: true, checkPII: false });
  passed = !result.valid && result.errors.some(e => e.toLowerCase().includes('size') || e.toLowerCase().includes('exceed'));
  const sizeError = result.errors.join('; ');
  printTest(`Over 1MB message (${msgSize} bytes)`, passed, `Errors: ${sizeError}`);
  results[passed ? 'passed' : 'failed']++;
  
  // =========================================================================
  // 5. PII + CLASSIFICATION
  // =========================================================================
  printSection('5. PII + CLASSIFICATION');
  
  const piiPayload = {
    user: {
      email: 'john.doe@example.com',
      phone: '555-123-4567',
      ssn: '123-45-6789'
    }
  };
  
  const cleanPayload = {
    data: 'This is clean data with no PII'
  };
  
  // PII data + cls="pub" (should FAIL)
  msg = { ...baseMsg, cls: 'pub', p: piiPayload };
  result = validateMessage(msg, { strict: true, checkPII: true });
  passed = !result.valid && result.errors.some(e => e.toLowerCase().includes('pii'));
  const piiError = result.errors.join('; ');
  printTest("PII data + cls='pub'", passed, `Errors: ${piiError}`);
  results[passed ? 'passed' : 'failed']++;
  
  // PII data + cls="pii" (should PASS)
  msg = { 
    ...baseMsg, 
    cls: 'pii', 
    p: piiPayload,
    pii_meta: {
      types: ['email', 'phone', 'ssn'],
      consent: { granted_by: 'user', purpose: 'test', proof: 'consent-token-123' }
    }
  };
  result = validateMessage(msg, { strict: true, checkPII: true });
  passed = result.valid;
  printTest("PII data + cls='pii' (with consent)", passed, 
            `Valid: ${result.valid}, Errors: ${result.errors}`);
  results[passed ? 'passed' : 'failed']++;
  
  // Clean data + cls="pub" (should PASS)
  msg = { ...baseMsg, cls: 'pub', p: cleanPayload };
  result = validateMessage(msg, { strict: true, checkPII: true });
  passed = result.valid;
  printTest("Clean data + cls='pub'", passed, `Valid: ${result.valid}`);
  results[passed ? 'passed' : 'failed']++;
  
  // Test PII detection function directly
  console.log('\n  PII Detection Tests:');
  let piiResult = detectPII(piiPayload);
  printTest('Detect email', piiResult.hasPII && piiResult.types.includes('email'), 
            `Found: ${JSON.stringify(piiResult.types)}`);
  
  piiResult = detectPII('SSN: 123-45-6789');
  printTest('Detect SSN', piiResult.hasPII && piiResult.types.includes('ssn'),
            `Found: ${JSON.stringify(piiResult.types)}`);
  
  piiResult = detectPII('Credit card: 4532-1234-5678-9012');
  printTest('Detect credit card', piiResult.hasPII && piiResult.types.includes('creditCard'),
            `Found: ${JSON.stringify(piiResult.types)}`);
  
  // =========================================================================
  // 6. AGENT NAME VALIDATION (JS SDK is stricter)
  // =========================================================================
  printSection('6. AGENT NAME VALIDATION');
  
  // Valid names
  const validNames = ['alice', 'bob-agent', 'agent_123', 'Agent-01', 'a1b2c3'];
  for (const name of validNames) {
    try {
      const builder = new MessageBuilder(OPERATIONS.QUERY)
        .from(name, 'test-org')
        .to('bob', 'other-org')
        .payload({ test: true });
      const builtMsg = builder.build();
      printTest(`Valid name: '${name}'`, true, 'Built successfully');
      results.passed++;
    } catch (err) {
      printTest(`Valid name: '${name}'`, false, `Error: ${err.message}`);
      results.failed++;
    }
  }
  
  // Invalid names (spaces, special chars)
  console.log('\n  Invalid agent names (should fail):');
  const invalidNames = ['alice agent', 'bob@agent', 'test!agent', 'hello world', 'agent<script>'];
  for (const name of invalidNames) {
    try {
      const builder = new MessageBuilder(OPERATIONS.QUERY)
        .from(name, 'test-org')
        .to('bob', 'other-org')
        .payload({ test: true });
      const builtMsg = builder.build();
      // Should NOT reach here
      printTest(`Invalid name: '${name}'`, false, 'Should have thrown but built successfully');
      results.failed++;
    } catch (err) {
      printTest(`Invalid name: '${name}'`, true, `Error: ${err.message}`);
      results.passed++;
    }
  }
  
  // Too long name (>256 chars)
  console.log('\n  Length validation:');
  const longName = 'a'.repeat(300);
  try {
    const builder = new MessageBuilder(OPERATIONS.QUERY)
      .from(longName, 'test-org')
      .to('bob', 'other-org')
      .payload({ test: true });
    const builtMsg = builder.build();
    printTest(`Long name (300 chars)`, false, 'Should have thrown');
    results.failed++;
  } catch (err) {
    printTest(`Long name (300 chars)`, true, `Error: ${err.message}`);
    results.passed++;
  }
  
  // Exactly 256 chars (should pass)
  const exact256 = 'a'.repeat(256);
  try {
    const builder = new MessageBuilder(OPERATIONS.QUERY)
      .from(exact256, 'test-org')
      .to('bob', 'other-org')
      .payload({ test: true });
    const builtMsg = builder.build();
    printTest(`Exactly 256 chars`, true, 'Built successfully');
    results.passed++;
  } catch (err) {
    printTest(`Exactly 256 chars`, false, `Error: ${err.message}`);
    results.failed++;
  }
  
  // Empty name
  try {
    const builder = new MessageBuilder(OPERATIONS.QUERY)
      .from('', 'test-org')
      .to('bob', 'other-org')
      .payload({ test: true });
    const builtMsg = builder.build();
    printTest(`Empty name`, false, 'Should have thrown');
    results.failed++;
  } catch (err) {
    printTest(`Empty name`, true, `Error: ${err.message}`);
    results.passed++;
  }
  
  // =========================================================================
  // SUMMARY
  // =========================================================================
  printSection('SUMMARY');
  console.log(`  Passed: ${results.passed}`);
  console.log(`  Failed: ${results.failed}`);
  console.log(`  Total:  ${results.passed + results.failed}`);
  
  return results;
}

runTests();
