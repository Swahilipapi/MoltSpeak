#!/usr/bin/env node
/**
 * MoltSpeak Cross-SDK Integration Tests (JavaScript side)
 * 
 * Tests that verify JavaScript and Python SDKs are compatible:
 * - JS creates + signs → Python verifies
 * - Python creates + signs → JS verifies
 * - Message format compatibility
 */

'use strict';

const { execSync, spawn } = require('child_process');
const path = require('path');

// Load the SDK
const moltspeak = require(path.join(__dirname, '..', '..', 'sdk', 'js', 'moltspeak.js'));

// Test result tracker
class TestResult {
  constructor(name) {
    this.name = name;
    this.passed = false;
    this.error = null;
  }

  toString() {
    const status = this.passed ? '✅ PASS' : '❌ FAIL';
    let result = `${status}: ${this.name}`;
    if (this.error) {
      result += `\n   Error: ${this.error}`;
    }
    return result;
  }
}

/**
 * Run Python code and return the result
 */
function runPython(script, inputJson = null) {
  const pythonPath = path.join(__dirname, '..', '..', 'sdk', 'python');
  const moltspeakFile = path.join(pythonPath, 'moltspeak.py');
  
  // Use a temp file approach to avoid shell escaping issues
  const fs = require('fs');
  const os = require('os');
  const tempFile = path.join(os.tmpdir(), `moltspeak_test_${Date.now()}.py`);
  
  const fullScript = `
import sys
import importlib.util
spec = importlib.util.spec_from_file_location("moltspeak_sdk", "${moltspeakFile.replace(/\\/g, '/')}")
ms = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ms)

create_query = ms.create_query
create_response = ms.create_response
create_hello = ms.create_hello
create_task = ms.create_task
AgentIdentity = ms.AgentIdentity
sign = ms.sign
verify = ms.verify
encode = ms.encode
decode = ms.decode
validate_message = ms.validate_message
wrap_in_envelope = ms.wrap_in_envelope
unwrap_envelope = ms.unwrap_envelope
to_natural_language = ms.to_natural_language
PROTOCOL_VERSION = ms.PROTOCOL_VERSION

${script}
`;
  
  try {
    fs.writeFileSync(tempFile, fullScript);
    const result = execSync(`python3 "${tempFile}"`, {
      encoding: 'utf-8',
      timeout: 10000,
      input: inputJson,
    });
    fs.unlinkSync(tempFile);
    return { stdout: result.trim(), stderr: '', code: 0 };
  } catch (e) {
    try { fs.unlinkSync(tempFile); } catch(x) {}
    return { stdout: e.stdout || '', stderr: e.stderr || e.message, code: e.status || 1 };
  }
}

/**
 * Test: JS creates message → Python can parse it
 */
function testJsToPythonMessageFormat() {
  const result = new TestResult('JS→Python: Message format compatibility');
  
  try {
    // Create message in JS
    const alice = { agent: 'alice-js', org: 'test' };
    const bob = { agent: 'bob-py', org: 'test' };
    
    const query = moltspeak.createQuery(
      { domain: 'test', intent: 'verify', params: { value: 42 } },
      alice,
      bob
    );
    
    const jsonStr = moltspeak.encode(query);
    
    // Verify in Python
    const pyScript = `
import json

msg_json = '''${jsonStr}'''
message = decode(msg_json)
validation = validate_message(message, strict=False, check_pii=False)

result = {
    'valid': validation.valid,
    'errors': validation.errors,
    'op': message.get('op'),
    'from_agent': message.get('from', {}).get('agent'),
    'to_agent': message.get('to', {}).get('agent')
}
print(json.dumps(result))
`;
    
    const { stdout, stderr, code } = runPython(pyScript);
    
    if (code !== 0) {
      result.error = `Python execution failed: ${stderr}`;
      return result;
    }
    
    const pyResult = JSON.parse(stdout);
    
    if (!pyResult.valid) {
      result.error = `Python validation failed: ${pyResult.errors}`;
      return result;
    }
    
    if (pyResult.from_agent !== 'alice-js') {
      result.error = `Agent mismatch: expected alice-js, got ${pyResult.from_agent}`;
      return result;
    }
    
    result.passed = true;
    
  } catch (e) {
    result.error = e.message;
  }
  
  return result;
}

/**
 * Test: JS signs message → Python verifies signature format
 */
function testJsSignPythonVerify() {
  const result = new TestResult('JS→Python: Sign and verify');
  
  try {
    const alice = { agent: 'alice-js', org: 'test', key: 'js-pub-key-123' };
    const bob = { agent: 'bob-py', org: 'test' };
    
    const message = moltspeak.createQuery(
      { domain: 'crypto', intent: 'test', params: { data: 'secret' } },
      alice,
      bob
    );
    
    // Sign in JS
    const signed = moltspeak.sign(message, 'mock-private-key-js');
    const jsonStr = moltspeak.encode(signed);
    
    // Verify in Python
    const pyScript = `
import json

msg_json = '''${jsonStr}'''
message = decode(msg_json)

has_sig = 'sig' in message
sig_format = message.get('sig', '').startswith('ed25519:')
verified = verify(message, 'js-pub-key-123')

print(json.dumps({
    'hasSig': has_sig,
    'sigFormat': sig_format,
    'verified': verified,
    'sig': message.get('sig', '')
}))
`;
    
    const { stdout, stderr, code } = runPython(pyScript);
    
    if (code !== 0) {
      result.error = `Python execution failed: ${stderr}`;
      return result;
    }
    
    const pyResult = JSON.parse(stdout);
    
    if (!pyResult.hasSig) {
      result.error = 'Signature not present in message';
      return result;
    }
    
    if (!pyResult.sigFormat) {
      result.error = `Signature format wrong: ${pyResult.sig}`;
      return result;
    }
    
    if (!pyResult.verified) {
      result.error = 'Python verification failed';
      return result;
    }
    
    result.passed = true;
    
  } catch (e) {
    result.error = e.message;
  }
  
  return result;
}

/**
 * Test: Python creates message → JS can parse it
 */
function testPythonToJsMessageFormat() {
  const result = new TestResult('Python→JS: Message format compatibility');
  
  try {
    const pyScript = `
import json

alice = AgentIdentity(agent='alice-py', org='test')
bob = AgentIdentity(agent='bob-js', org='test')

query = create_query(
    {'domain': 'test', 'intent': 'verify', 'params': {'value': 123}},
    alice,
    bob
)

print(encode(query))
`;
    
    const { stdout, stderr, code } = runPython(pyScript);
    
    if (code !== 0) {
      result.error = `Python execution failed: ${stderr}`;
      return result;
    }
    
    // Parse in JS
    const message = moltspeak.decode(stdout);
    
    // Validate
    const validation = moltspeak.validateMessage(message, { strict: false, checkPII: false });
    
    if (!validation.valid) {
      result.error = `JS validation failed: ${validation.errors.join(', ')}`;
      return result;
    }
    
    if (message.from?.agent !== 'alice-py') {
      result.error = `Agent mismatch: expected alice-py, got ${message.from?.agent}`;
      return result;
    }
    
    if (message.p?.params?.value !== 123) {
      result.error = 'Payload value mismatch';
      return result;
    }
    
    result.passed = true;
    
  } catch (e) {
    result.error = e.message;
  }
  
  return result;
}

/**
 * Test: Python signs message → JS verifies signature format
 */
function testPythonSignJsVerify() {
  const result = new TestResult('Python→JS: Sign and verify');
  
  try {
    const pyScript = `
import json

alice = AgentIdentity(agent='alice-py', org='test', key='py-pub-key-456')
bob = AgentIdentity(agent='bob-js', org='test')

message = create_query(
    {'domain': 'crypto', 'intent': 'test', 'params': {'data': 'secret'}},
    alice,
    bob
)

signed = sign(message, 'mock-private-key-py')
print(encode(signed))
`;
    
    const { stdout, stderr, code } = runPython(pyScript);
    
    if (code !== 0) {
      result.error = `Python execution failed: ${stderr}`;
      return result;
    }
    
    // Parse and verify in JS
    const message = moltspeak.decode(stdout);
    
    // Check signature exists
    if (!message.sig) {
      result.error = 'Signature not present in message';
      return result;
    }
    
    // Check signature format
    if (!message.sig.startsWith('ed25519:')) {
      result.error = `Signature format wrong: ${message.sig}`;
      return result;
    }
    
    // Verify using JS SDK
    const verified = moltspeak.verify(message, 'py-pub-key-456');
    
    if (!verified) {
      result.error = 'JS verification failed';
      return result;
    }
    
    result.passed = true;
    
  } catch (e) {
    result.error = e.message;
  }
  
  return result;
}

/**
 * Test: Envelope roundtrip JS→Python→JS
 */
function testEnvelopeRoundtrip() {
  const result = new TestResult('Envelope: Roundtrip JS→Python→JS');
  
  try {
    const alice = { agent: 'alice-js', org: 'test' };
    
    const hello = moltspeak.createHello(alice, { operations: ['query', 'respond', 'task'] });
    const envelope = moltspeak.wrapInEnvelope(hello);
    const envelopeJson = JSON.stringify(envelope);
    
    // Python unwraps and returns
    const pyScript = `
import json

envelope = json.loads('''${envelopeJson}''')
message = unwrap_envelope(envelope)

print(json.dumps({
    'success': True,
    'op': message.get('op'),
    'version': envelope.get('moltspeak'),
    'from_agent': message.get('from', {}).get('agent')
}))
`;
    
    const { stdout, stderr, code } = runPython(pyScript);
    
    if (code !== 0) {
      result.error = `Python execution failed: ${stderr}`;
      return result;
    }
    
    const pyResult = JSON.parse(stdout);
    
    if (pyResult.op !== 'hello') {
      result.error = `Operation mismatch: expected hello, got ${pyResult.op}`;
      return result;
    }
    
    if (pyResult.version !== moltspeak.PROTOCOL_VERSION) {
      result.error = `Version mismatch: expected ${moltspeak.PROTOCOL_VERSION}, got ${pyResult.version}`;
      return result;
    }
    
    result.passed = true;
    
  } catch (e) {
    result.error = e.message;
  }
  
  return result;
}

/**
 * Test: All message types work across SDKs
 */
function testAllMessageTypes() {
  const result = new TestResult('Message Types: All types compatible');
  
  try {
    const alice = { agent: 'alice', org: 'test' };
    const bob = { agent: 'bob', org: 'test' };
    
    // Create each message type in JS
    const messages = {
      'query': moltspeak.createQuery({ domain: 'd', intent: 'i' }, alice, bob),
      'task': moltspeak.createTask({ description: 'do something', type: 'test' }, alice, bob),
      'hello': moltspeak.createHello(alice),
    };
    
    // Validate each in Python
    for (const [msgType, msg] of Object.entries(messages)) {
      const msgJson = moltspeak.encode(msg);
      
      const pyScript = `
import json

msg = decode('''${msgJson}''')
result = validate_message(msg, strict=False, check_pii=False)
print(json.dumps({
    'type': '${msgType}',
    'valid': result.valid,
    'op': msg.get('op')
}))
`;
      
      const { stdout, stderr, code } = runPython(pyScript);
      
      if (code !== 0) {
        result.error = `Python failed for ${msgType}: ${stderr}`;
        return result;
      }
      
      const pyResult = JSON.parse(stdout);
      
      if (!pyResult.valid) {
        result.error = `Python validation failed for ${msgType}`;
        return result;
      }
    }
    
    result.passed = true;
    
  } catch (e) {
    result.error = e.message;
  }
  
  return result;
}

/**
 * Test: Natural language encoding/decoding works across SDKs
 */
function testNaturalLanguage() {
  const result = new TestResult('Natural Language: Cross-SDK compatibility');
  
  try {
    // Create message in JS, send to Python for NL conversion
    const alice = { agent: 'alice', org: 'test' };
    const bob = { agent: 'bob', org: 'test' };
    
    const query = moltspeak.createQuery(
      { domain: 'weather', intent: 'check', params: { text: 'What is the weather?' } },
      alice,
      bob
    );
    
    const queryJson = moltspeak.encode(query);
    
    // Python converts to natural language
    const pyScript = `
import json

msg = decode('''${queryJson}''')
nl = to_natural_language(msg)
print(json.dumps({'nl': nl}))
`;
    
    const { stdout, stderr, code } = runPython(pyScript);
    
    if (code !== 0) {
      result.error = `Python execution failed: ${stderr}`;
      return result;
    }
    
    const pyResult = JSON.parse(stdout);
    const nl = pyResult.nl || '';
    
    // Check that NL contains key elements
    if (!nl.includes('alice') || !nl.includes('bob')) {
      result.error = `Natural language missing agent names: ${nl}`;
      return result;
    }
    
    result.passed = true;
    
  } catch (e) {
    result.error = e.message;
  }
  
  return result;
}

/**
 * Main test runner
 */
function main() {
  console.log('='.repeat(60));
  console.log('MoltSpeak Cross-SDK Integration Tests');
  console.log('JavaScript SDK ↔ Python SDK Compatibility');
  console.log('='.repeat(60));
  console.log();
  
  // Check Python is available
  try {
    const pyVersion = execSync('python3 --version', { encoding: 'utf-8' }).trim();
    console.log(`Python version: ${pyVersion.replace('Python ', '')}`);
  } catch (e) {
    console.log(`❌ Python3 not available: ${e.message}`);
    process.exit(1);
  }
  
  console.log(`Node.js version: ${process.version}`);
  console.log(`MoltSpeak Protocol: v${moltspeak.PROTOCOL_VERSION}`);
  console.log();
  console.log('-'.repeat(60));
  console.log();
  
  const tests = [
    testJsToPythonMessageFormat,
    testJsSignPythonVerify,
    testPythonToJsMessageFormat,
    testPythonSignJsVerify,
    testEnvelopeRoundtrip,
    testAllMessageTypes,
    testNaturalLanguage,
  ];
  
  const results = [];
  for (const testFn of tests) {
    const result = testFn();
    results.push(result);
    console.log(result.toString());
  }
  
  console.log();
  console.log('-'.repeat(60));
  
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  
  console.log();
  console.log(`Results: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('\n🎉 All integration tests passed! SDKs are compatible.');
    return 0;
  } else {
    console.log(`\n⚠️  ${total - passed} test(s) failed.`);
    return 1;
  }
}

process.exit(main());
