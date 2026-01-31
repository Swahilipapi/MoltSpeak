#!/usr/bin/env node
/**
 * MoltSpeak CLI Test Suite
 * 
 * Run with: node test.js
 */

'use strict';

const { execSync, exec } = require('child_process');
const path = require('path');

const CLI = path.join(__dirname, 'moltspeak');

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

function run(args, options = {}) {
  try {
    const result = execSync(`node ${CLI} ${args}`, {
      encoding: 'utf8',
      ...options
    });
    return { stdout: result, exitCode: 0 };
  } catch (e) {
    return { stdout: e.stdout || '', stderr: e.stderr || '', exitCode: e.status || 1 };
  }
}

console.log('\n🧪 MoltSpeak CLI Tests\n');
console.log('─'.repeat(50));

// Help command
console.log('\n📌 Help & Info');
test('help shows usage', () => {
  const result = run('help');
  if (!result.stdout.includes('USAGE:')) throw new Error('Missing usage section');
  if (!result.stdout.includes('COMMANDS:')) throw new Error('Missing commands section');
});

test('--version shows version', () => {
  const result = run('--version');
  if (!result.stdout.includes('0.1')) throw new Error('Missing version');
});

test('schema shows message structure', () => {
  const result = run('schema');
  if (!result.stdout.includes('Protocol version')) throw new Error('Missing schema info');
  if (!result.stdout.includes('Operations:')) throw new Error('Missing operations');
});

// Encode command
console.log('\n🔄 Encode Command');
test('encode produces valid JSON', () => {
  const result = run('encode "query weather in Tokyo" --quiet');
  const msg = JSON.parse(result.stdout);
  if (msg.op !== 'query') throw new Error('Wrong operation');
});

test('encode with --pretty formats nicely', () => {
  const result = run('encode "hello world" --pretty --quiet');
  if (!result.stdout.includes('\n')) throw new Error('Not pretty printed');
});

test('encode with --envelope wraps message', () => {
  const result = run('encode "test" --envelope --quiet');
  const env = JSON.parse(result.stdout);
  if (!env.moltspeak) throw new Error('Missing envelope wrapper');
  if (!env.message) throw new Error('Missing message in envelope');
});

test('encode with --from sets sender', () => {
  const result = run('encode "test" --from myagent --quiet');
  const msg = JSON.parse(result.stdout);
  if (msg.from.agent !== 'myagent') throw new Error('From not set correctly');
});

// Decode command
console.log('\n🔓 Decode Command');
test('decode parses JSON message', () => {
  const msg = JSON.stringify({v:'0.1',id:'test',ts:123,op:'query',p:{domain:'test'}});
  const result = run(`decode '${msg}' --quiet`);
  const decoded = JSON.parse(result.stdout);
  if (decoded.op !== 'query') throw new Error('Decode failed');
});

// Validate command
console.log('\n✅ Validate Command');
test('validate accepts valid message', () => {
  const msg = JSON.stringify({
    v:'0.1',
    id:'550e8400-e29b-41d4-a716-446655440000',
    ts:Date.now(),
    op:'query',
    from:{agent:'test'},
    cls:'int',
    p:{}
  });
  const result = run(`validate '${msg}'`);
  if (result.exitCode !== 0) throw new Error('Valid message rejected');
  if (!result.stdout.includes('valid')) throw new Error('Missing valid confirmation');
});

test('validate rejects invalid message', () => {
  const msg = JSON.stringify({v:'0.1'});
  const result = run(`validate '${msg}'`);
  if (result.exitCode === 0) throw new Error('Invalid message accepted');
});

// Create command
console.log('\n🏭 Create Command');
test('create query generates message', () => {
  const result = run('create query --quiet');
  const msg = JSON.parse(result.stdout);
  if (msg.op !== 'query') throw new Error('Wrong operation');
});

test('create task generates message', () => {
  const result = run('create task --quiet');
  const msg = JSON.parse(result.stdout);
  if (msg.op !== 'task') throw new Error('Wrong operation');
});

test('create hello generates message', () => {
  const result = run('create hello --quiet');
  const msg = JSON.parse(result.stdout);
  if (msg.op !== 'hello') throw new Error('Wrong operation');
});

// PII detection
console.log('\n🔒 PII Detection');
test('pii detects email addresses', () => {
  const result = run('pii "Contact me at test@example.com"');
  if (result.exitCode === 0) throw new Error('PII not detected');
  if (!result.stdout.includes('email')) throw new Error('Email not identified');
});

test('pii passes clean text', () => {
  const result = run('pii "The weather is nice"');
  if (result.exitCode !== 0) throw new Error('False positive PII detection');
});

// Summary
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
