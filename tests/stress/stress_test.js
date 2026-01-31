#!/usr/bin/env node
/**
 * MoltSpeak SDK - JavaScript Stress Tests
 * Tests: Volume, Concurrency, Large Payloads, Cross-SDK Exchange
 */

'use strict';

const path = require('path');
const fs = require('fs');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

// Import SDK
const moltspeak = require(path.join(__dirname, '..', '..', 'sdk', 'js', 'moltspeak.js'));

const {
  createQuery, createResponse, sign, verify, validateMessage,
  encode, decode, now, SIZE_LIMITS, OPERATIONS
} = moltspeak;


class StressTestResults {
  constructor(name) {
    this.name = name;
    this.passed = false;
    this.duration_ms = 0;
    this.messages_created = 0;
    this.messages_signed = 0;
    this.messages_verified = 0;
    this.errors = [];
    this.metrics = {};
  }
  
  toJSON() {
    return {
      name: this.name,
      passed: this.passed,
      duration_ms: this.duration_ms,
      messages_created: this.messages_created,
      messages_signed: this.messages_signed,
      messages_verified: this.messages_verified,
      errors: this.errors,
      metrics: this.metrics
    };
  }
}


/**
 * Test 1: Message Volume Test
 * - Create 100 messages rapidly
 * - Sign all 100
 * - Verify all 100
 * - Measure time
 */
function testMessageVolume(count = 100) {
  const results = new StressTestResults('Message Volume Test');
  
  const alice = { agent: 'volume-alice', org: 'stress-test' };
  const bob = { agent: 'volume-bob', org: 'stress-test' };
  
  const privateKey = 'test-private-key-volume';
  const publicKey = 'test-public-key-volume';
  
  const messages = [];
  const signedMessages = [];
  
  const start = performance.now();
  
  // Phase 1: Create messages
  const createStart = performance.now();
  try {
    for (let i = 0; i < count; i++) {
      const msg = createQuery(
        {
          domain: 'stress-test',
          intent: 'volume',
          params: { index: i, batch: 'volume-test' }
        },
        alice,
        bob
      );
      messages.push(msg);
    }
    results.messages_created = messages.length;
  } catch (e) {
    results.errors.push(`Create failed: ${e.message}`);
    return results;
  }
  const createDuration = performance.now() - createStart;
  
  // Phase 2: Sign messages
  const signStart = performance.now();
  try {
    for (const msg of messages) {
      const signed = sign(msg, privateKey);
      signedMessages.push(signed);
    }
    results.messages_signed = signedMessages.length;
  } catch (e) {
    results.errors.push(`Sign failed: ${e.message}`);
    return results;
  }
  const signDuration = performance.now() - signStart;
  
  // Phase 3: Verify messages
  const verifyStart = performance.now();
  let verifiedCount = 0;
  try {
    for (const signed of signedMessages) {
      if (verify(signed, publicKey)) {
        verifiedCount++;
      }
    }
    results.messages_verified = verifiedCount;
  } catch (e) {
    results.errors.push(`Verify failed: ${e.message}`);
    return results;
  }
  const verifyDuration = performance.now() - verifyStart;
  
  const totalDuration = performance.now() - start;
  results.duration_ms = totalDuration;
  
  results.metrics = {
    create_time_ms: Math.round(createDuration * 100) / 100,
    sign_time_ms: Math.round(signDuration * 100) / 100,
    verify_time_ms: Math.round(verifyDuration * 100) / 100,
    avg_create_ms: Math.round((createDuration / count) * 10000) / 10000,
    avg_sign_ms: Math.round((signDuration / count) * 10000) / 10000,
    avg_verify_ms: Math.round((verifyDuration / count) * 10000) / 10000,
    messages_per_second: Math.round(count / (totalDuration / 1000) * 100) / 100
  };
  
  results.passed = (
    results.messages_created === count &&
    results.messages_signed === count &&
    results.messages_verified === count &&
    results.errors.length === 0
  );
  
  return results;
}


/**
 * Test 2: Concurrent Agents Test
 * - Simulate 10 agents sending messages simultaneously
 * - Use async/promises (JS single-threaded but async)
 * - Verify no message corruption
 */
async function testConcurrentAgents(agentCount = 10, messagesPerAgent = 20) {
  const results = new StressTestResults('Concurrent Agents Test');
  
  const privateKey = 'test-private-key-concurrent';
  const publicKey = 'test-public-key-concurrent';
  
  const allMessages = [];
  const errors = [];
  
  // Agent worker function
  async function agentWorker(agentId) {
    const agent = { agent: `agent-${agentId}`, org: 'concurrent-test' };
    const target = { agent: 'central-hub', org: 'concurrent-test' };
    
    const localMessages = [];
    const localErrors = [];
    let created = 0;
    let verified = 0;
    
    for (let i = 0; i < messagesPerAgent; i++) {
      try {
        // Create message
        const msg = createQuery(
          {
            domain: 'concurrent-test',
            intent: 'parallel-send',
            params: {
              agent_id: agentId,
              msg_index: i,
              async_id: Math.random().toString(36).slice(2)
            }
          },
          agent,
          target
        );
        
        // Sign
        const signed = sign(msg, privateKey);
        created++;
        
        // Verify immediately
        if (verify(signed, publicKey)) {
          verified++;
          localMessages.push(signed);
        } else {
          localErrors.push(`Agent ${agentId} msg ${i}: verify failed`);
        }
        
        // Yield to event loop occasionally
        if (i % 5 === 0) {
          await new Promise(resolve => setImmediate(resolve));
        }
        
      } catch (e) {
        localErrors.push(`Agent ${agentId} msg ${i}: ${e.message}`);
      }
    }
    
    return { created, verified, messages: localMessages, errors: localErrors };
  }
  
  const start = performance.now();
  
  // Run all agents concurrently
  const agentPromises = [];
  for (let i = 0; i < agentCount; i++) {
    agentPromises.push(agentWorker(i));
  }
  
  const agentResults = await Promise.all(agentPromises);
  
  let totalCreated = 0;
  let totalVerified = 0;
  
  for (const result of agentResults) {
    totalCreated += result.created;
    totalVerified += result.verified;
    allMessages.push(...result.messages);
    errors.push(...result.errors);
  }
  
  results.duration_ms = performance.now() - start;
  results.messages_created = totalCreated;
  results.messages_signed = totalCreated;
  results.messages_verified = totalVerified;
  results.errors = errors;
  
  // Check for corruption
  const expectedTotal = agentCount * messagesPerAgent;
  const uniqueIds = new Set(allMessages.map(m => m.id));
  
  results.metrics = {
    agent_count: agentCount,
    messages_per_agent: messagesPerAgent,
    expected_total: expectedTotal,
    actual_total: allMessages.length,
    unique_message_ids: uniqueIds.size,
    corruption_detected: uniqueIds.size !== allMessages.length,
    throughput_msgs_per_sec: Math.round(totalCreated / (results.duration_ms / 1000) * 100) / 100
  };
  
  results.passed = (
    totalCreated === expectedTotal &&
    totalVerified === expectedTotal &&
    uniqueIds.size === allMessages.length &&
    errors.length === 0
  );
  
  return results;
}


/**
 * Test 3: Large Payload Test
 * - Create messages with 500KB, 800KB, 950KB payloads (should succeed)
 * - Verify 1.1MB fails (exceeds 1MB limit)
 */
function testLargePayloads() {
  const results = new StressTestResults('Large Payload Test');
  
  const alice = { agent: 'large-alice', org: 'stress-test' };
  const bob = { agent: 'large-bob', org: 'stress-test' };
  
  const privateKey = 'test-private-key-large';
  const publicKey = 'test-public-key-large';
  
  const testCases = [
    { targetSize: 500 * 1024, shouldSucceed: true, label: '500KB' },
    { targetSize: 800 * 1024, shouldSucceed: true, label: '800KB' },
    { targetSize: 950 * 1024, shouldSucceed: true, label: '950KB' },
    { targetSize: 1.1 * 1024 * 1024, shouldSucceed: false, label: '1.1MB' }
  ];
  
  const caseResults = [];
  const start = performance.now();
  
  for (const { targetSize, shouldSucceed, label } of testCases) {
    const caseStart = performance.now();
    
    // Generate payload of approximate target size
    const dataSize = Math.max(0, Math.floor(targetSize) - 500);
    const payloadData = 'x'.repeat(dataSize);
    
    try {
      const msg = createQuery(
        {
          domain: 'large-payload-test',
          intent: 'size-test',
          params: { data: payloadData, target_size: label }
        },
        alice,
        bob
      );
      
      // Sign and verify
      const signed = sign(msg, privateKey);
      const verified = verify(signed, publicKey);
      
      const actualSize = Buffer.byteLength(encode(signed), 'utf8');
      const succeeded = true;
      
      caseResults.push({
        label,
        target_bytes: Math.floor(targetSize),
        actual_bytes: actualSize,
        should_succeed: shouldSucceed,
        succeeded,
        verified,
        passed: shouldSucceed === succeeded && verified,
        time_ms: Math.round((performance.now() - caseStart) * 100) / 100
      });
      
      if (shouldSucceed) {
        results.messages_created++;
        results.messages_signed++;
        if (verified) {
          results.messages_verified++;
        }
      }
      
    } catch (e) {
      const succeeded = false;
      
      caseResults.push({
        label,
        target_bytes: Math.floor(targetSize),
        should_succeed: shouldSucceed,
        succeeded,
        error: e.message,
        passed: shouldSucceed === succeeded,
        time_ms: Math.round((performance.now() - caseStart) * 100) / 100
      });
      
      if (shouldSucceed) {
        results.errors.push(`${label}: ${e.message}`);
      }
    }
  }
  
  results.duration_ms = performance.now() - start;
  results.metrics = {
    test_cases: caseResults,
    size_limit_bytes: SIZE_LIMITS.SINGLE_MESSAGE
  };
  
  results.passed = caseResults.every(c => c.passed);
  
  return results;
}


/**
 * Test 4a: Verify Python's messages and respond
 */
function verifyCrossSdkMessages() {
  const results = new StressTestResults('Cross-SDK Message Verification (JS)');
  
  const inputFile = path.join(__dirname, 'cross_sdk_python_messages.json');
  
  if (!fs.existsSync(inputFile)) {
    results.errors.push('Python messages file not found - run Python stress test first');
    results.passed = false;
    return results;
  }
  
  const start = performance.now();
  
  try {
    const data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
    const messages = data.messages || [];
    const publicKey = data.public_key || '';
    
    let verified = 0;
    const responses = [];
    
    const jsAgent = { agent: 'js-responder', org: 'cross-sdk' };
    const pyAgent = { agent: 'python-sender', org: 'cross-sdk' };
    const jsPrivateKey = 'js-cross-sdk-private-key';
    const jsPublicKey = 'js-cross-sdk-public-key';
    
    for (const msg of messages) {
      // Verify Python's signature
      if (verify(msg, publicKey)) {
        verified++;
        
        // Create response
        const response = createResponse(
          msg.id,
          {
            received_index: msg.p?.params?.index,
            processed_by: 'javascript',
            original_source: msg.p?.params?.source
          },
          jsAgent,
          pyAgent
        );
        
        const signedResponse = sign(response, jsPrivateKey);
        responses.push(signedResponse);
      } else {
        results.errors.push(`Failed to verify message ${msg.id || 'unknown'}`);
      }
    }
    
    // Write responses for Python to verify
    const outputFile = path.join(__dirname, 'cross_sdk_js_responses.json');
    fs.writeFileSync(outputFile, JSON.stringify({
      messages: responses,
      public_key: jsPublicKey,
      count: responses.length
    }, null, 2));
    
    results.messages_verified = verified;
    results.messages_created = responses.length;
    results.messages_signed = responses.length;
    
    results.metrics = {
      python_messages: messages.length,
      verified_count: verified,
      responses_generated: responses.length,
      output_file: outputFile
    };
    
    results.passed = verified === messages.length && responses.length === messages.length;
    
  } catch (e) {
    results.errors.push(`Verification failed: ${e.message}`);
    results.passed = false;
  }
  
  results.duration_ms = performance.now() - start;
  return results;
}


/**
 * Test 4b: Generate messages for Python to verify
 */
function generateCrossSdkMessages(count = 50) {
  const results = new StressTestResults('Cross-SDK Message Generation (JS)');
  
  const jsAgent = { agent: 'js-sender', org: 'cross-sdk' };
  const pyAgent = { agent: 'python-receiver', org: 'cross-sdk' };
  
  const privateKey = 'js-to-python-private-key';
  const publicKey = 'js-to-python-public-key';
  
  const messages = [];
  const start = performance.now();
  
  try {
    for (let i = 0; i < count; i++) {
      const msg = createQuery(
        {
          domain: 'cross-sdk',
          intent: 'js-to-python',
          params: {
            index: i,
            source: 'javascript',
            timestamp: now()
          }
        },
        jsAgent,
        pyAgent
      );
      
      const signed = sign(msg, privateKey);
      messages.push(signed);
      results.messages_created++;
      results.messages_signed++;
    }
    
    // Write to file for Python
    const outputFile = path.join(__dirname, 'cross_sdk_js_messages.json');
    fs.writeFileSync(outputFile, JSON.stringify({
      messages,
      public_key: publicKey,
      count
    }, null, 2));
    
    results.metrics = {
      messages_generated: count,
      output_file: outputFile,
      public_key: publicKey
    };
    results.passed = true;
    
  } catch (e) {
    results.errors.push(`Generation failed: ${e.message}`);
    results.passed = false;
  }
  
  results.duration_ms = performance.now() - start;
  return results;
}


async function runAllTests() {
  console.log('='.repeat(60));
  console.log('MoltSpeak JavaScript SDK - Stress Tests');
  console.log('='.repeat(60));
  
  const allResults = [];
  
  // Test 1: Message Volume
  console.log('\n[1/4] Running Message Volume Test (100 messages)...');
  const volResults = testMessageVolume(100);
  allResults.push(volResults);
  console.log(`  ${volResults.passed ? '✓' : '✗'} ${volResults.name}`);
  console.log(`    Created: ${volResults.messages_created}, Signed: ${volResults.messages_signed}, Verified: ${volResults.messages_verified}`);
  console.log(`    Time: ${volResults.duration_ms.toFixed(2)}ms (${volResults.metrics.messages_per_second} msg/s)`);
  
  // Test 2: Concurrent Agents
  console.log('\n[2/4] Running Concurrent Agents Test (10 agents × 20 messages)...');
  const concResults = await testConcurrentAgents(10, 20);
  allResults.push(concResults);
  console.log(`  ${concResults.passed ? '✓' : '✗'} ${concResults.name}`);
  console.log(`    Created: ${concResults.messages_created}, Verified: ${concResults.messages_verified}`);
  console.log(`    Unique IDs: ${concResults.metrics.unique_message_ids}`);
  console.log(`    Corruption: ${concResults.metrics.corruption_detected ? 'Yes ⚠️' : 'None ✓'}`);
  console.log(`    Time: ${concResults.duration_ms.toFixed(2)}ms (${concResults.metrics.throughput_msgs_per_sec} msg/s)`);
  
  // Test 3: Large Payloads
  console.log('\n[3/4] Running Large Payload Test...');
  const largeResults = testLargePayloads();
  allResults.push(largeResults);
  console.log(`  ${largeResults.passed ? '✓' : '✗'} ${largeResults.name}`);
  for (const c of largeResults.metrics.test_cases || []) {
    const status = c.passed ? '✓' : '✗';
    if (c.error) {
      console.log(`    ${status} ${c.label}: ${c.should_succeed ? c.error : 'rejected (expected)'}`);
    } else {
      console.log(`    ${status} ${c.label}: ${c.actual_bytes} bytes, verified=${c.verified}`);
    }
  }
  
  // Test 4a: Verify Python messages and respond
  console.log('\n[4/4] Running Cross-SDK Message Verification...');
  const crossVerify = verifyCrossSdkMessages();
  if (crossVerify.errors.some(e => e.includes('not found'))) {
    console.log('  ⏭ Skipped (run Python stress test first to generate messages)');
  } else {
    allResults.push(crossVerify);
    console.log(`  ${crossVerify.passed ? '✓' : '✗'} ${crossVerify.name}`);
    console.log(`    Verified: ${crossVerify.messages_verified}/${crossVerify.metrics.python_messages}`);
    console.log(`    Responses: ${crossVerify.messages_created}`);
  }
  
  // Also generate JS messages for Python
  console.log('\n[Bonus] Generating JS messages for Python verification...');
  const jsGen = generateCrossSdkMessages(50);
  allResults.push(jsGen);
  console.log(`  ${jsGen.passed ? '✓' : '✗'} ${jsGen.name}`);
  console.log(`    Generated: ${jsGen.messages_created} messages`);
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  
  const passed = allResults.filter(r => r.passed).length;
  const total = allResults.length;
  
  console.log(`Tests Passed: ${passed}/${total}`);
  
  const totalMsgs = allResults.reduce((sum, r) => sum + r.messages_created, 0);
  const totalTime = allResults.reduce((sum, r) => sum + r.duration_ms, 0);
  console.log(`Total Messages: ${totalMsgs}`);
  console.log(`Total Time: ${totalTime.toFixed(2)}ms`);
  console.log(`Overall Throughput: ${(totalMsgs / (totalTime / 1000)).toFixed(2)} msg/s`);
  
  // Write full results to file
  const outputFile = path.join(__dirname, 'stress_results_js.json');
  fs.writeFileSync(outputFile, JSON.stringify({
    sdk: 'javascript',
    timestamp: now(),
    summary: {
      passed,
      total,
      total_messages: totalMsgs,
      total_time_ms: totalTime
    },
    tests: allResults.map(r => r.toJSON())
  }, null, 2));
  
  console.log(`\nFull results written to: ${outputFile}`);
  
  return passed === total;
}


// Run tests
runAllTests()
  .then(success => process.exit(success ? 0 : 1))
  .catch(err => {
    console.error('Test runner error:', err);
    process.exit(1);
  });
