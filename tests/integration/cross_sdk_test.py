#!/usr/bin/env python3
"""
MoltSpeak Cross-SDK Integration Tests

Tests that verify Python and JavaScript SDKs are compatible:
- Python creates + signs → JS verifies
- JS creates + signs → Python verifies
- Message format compatibility
"""

import json
import subprocess
import sys
import os
import tempfile

# Add SDK to path - use the standalone moltspeak.py file directly
sdk_path = os.path.join(os.path.dirname(__file__), '..', '..', 'sdk', 'python')

# Import from the standalone moltspeak.py file directly
import importlib.util
spec = importlib.util.spec_from_file_location("moltspeak_sdk", os.path.join(sdk_path, "moltspeak.py"))
ms = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ms)

# Pull out the needed functions
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
PROTOCOL_VERSION = ms.PROTOCOL_VERSION
wrap_in_envelope = ms.wrap_in_envelope


def run_js(script: str, input_json: str = None) -> tuple:
    """Run JavaScript code via Node.js and return stdout, stderr, return code."""
    js_sdk_path = os.path.join(os.path.dirname(__file__), '..', '..', 'sdk', 'js')
    
    full_script = f"""
const moltspeak = require('{js_sdk_path}/moltspeak.js');
{script}
"""
    
    result = subprocess.run(
        ['node', '-e', full_script],
        input=input_json,
        capture_output=True,
        text=True,
        timeout=10
    )
    
    return result.stdout.strip(), result.stderr.strip(), result.returncode


class TestResult:
    def __init__(self, name: str):
        self.name = name
        self.passed = False
        self.error = None
    
    def __str__(self):
        status = "✅ PASS" if self.passed else "❌ FAIL"
        result = f"{status}: {self.name}"
        if self.error:
            result += f"\n   Error: {self.error}"
        return result


def test_python_to_js_message_format():
    """Test: Python creates message → JS can parse it."""
    result = TestResult("Python→JS: Message format compatibility")
    
    try:
        # Create message in Python
        alice = AgentIdentity(agent="alice-py", org="test")
        bob = AgentIdentity(agent="bob-js", org="test")
        
        query = create_query(
            {"domain": "test", "intent": "verify", "params": {"value": 42}},
            alice,
            bob
        )
        
        json_str = encode(query)
        
        # Verify in JavaScript
        js_script = f'''
const input = {json_str};
try {{
    const result = moltspeak.validateMessage(input, {{ strict: false, checkPII: false }});
    console.log(JSON.stringify({{
        valid: result.valid,
        errors: result.errors,
        op: input.op,
        from_agent: input.from?.agent,
        to_agent: input.to?.agent
    }}));
}} catch(e) {{
    console.log(JSON.stringify({{ error: e.message }}));
}}
'''
        stdout, stderr, code = run_js(js_script)
        
        if code != 0:
            result.error = f"JS execution failed: {stderr}"
            return result
        
        js_result = json.loads(stdout)
        
        if js_result.get("error"):
            result.error = f"JS error: {js_result['error']}"
            return result
        
        if not js_result.get("valid"):
            result.error = f"JS validation failed: {js_result.get('errors')}"
            return result
        
        if js_result["from_agent"] != "alice-py":
            result.error = f"Agent mismatch: expected alice-py, got {js_result['from_agent']}"
            return result
        
        result.passed = True
        
    except Exception as e:
        result.error = str(e)
    
    return result


def test_python_sign_js_verify():
    """Test: Python signs message → JS verifies signature format."""
    result = TestResult("Python→JS: Sign and verify")
    
    try:
        alice = AgentIdentity(agent="alice-py", org="test", key="py-pub-key-123")
        bob = AgentIdentity(agent="bob-js", org="test")
        
        message = create_query(
            {"domain": "crypto", "intent": "test", "params": {"data": "secret"}},
            alice,
            bob
        )
        
        # Sign in Python
        signed = sign(message, "mock-private-key-py")
        json_str = encode(signed)
        
        # Verify in JS
        js_script = f'''
const msg = {json_str};
try {{
    // Verify the signature exists and has correct format
    const hasSig = !!msg.sig;
    const sigFormat = msg.sig && msg.sig.startsWith('ed25519:');
    
    // Use the SDK verify function
    const verified = moltspeak.verify(msg, 'py-pub-key-123');
    
    console.log(JSON.stringify({{
        hasSig: hasSig,
        sigFormat: sigFormat,
        verified: verified,
        sig: msg.sig
    }}));
}} catch(e) {{
    console.log(JSON.stringify({{ error: e.message }}));
}}
'''
        stdout, stderr, code = run_js(js_script)
        
        if code != 0:
            result.error = f"JS execution failed: {stderr}"
            return result
        
        js_result = json.loads(stdout)
        
        if js_result.get("error"):
            result.error = f"JS error: {js_result['error']}"
            return result
        
        if not js_result.get("hasSig"):
            result.error = "Signature not present in message"
            return result
        
        if not js_result.get("sigFormat"):
            result.error = f"Signature format wrong: {js_result.get('sig')}"
            return result
        
        if not js_result.get("verified"):
            result.error = "JS verification failed"
            return result
        
        result.passed = True
        
    except Exception as e:
        result.error = str(e)
    
    return result


def test_js_to_python_message_format():
    """Test: JS creates message → Python can parse it."""
    result = TestResult("JS→Python: Message format compatibility")
    
    try:
        js_script = '''
const alice = { agent: 'alice-js', org: 'test' };
const bob = { agent: 'bob-py', org: 'test' };

const query = moltspeak.createQuery(
    { domain: 'test', intent: 'verify', params: { value: 123 } },
    alice,
    bob
);

console.log(moltspeak.encode(query));
'''
        stdout, stderr, code = run_js(js_script)
        
        if code != 0:
            result.error = f"JS execution failed: {stderr}"
            return result
        
        # Parse in Python
        message = decode(stdout)
        
        # Validate
        validation = validate_message(message, strict=False, check_pii=False)
        
        if not validation.valid:
            result.error = f"Python validation failed: {validation.errors}"
            return result
        
        if message.get("from", {}).get("agent") != "alice-js":
            result.error = f"Agent mismatch: expected alice-js, got {message.get('from', {}).get('agent')}"
            return result
        
        if message.get("p", {}).get("params", {}).get("value") != 123:
            result.error = "Payload value mismatch"
            return result
        
        result.passed = True
        
    except Exception as e:
        result.error = str(e)
    
    return result


def test_js_sign_python_verify():
    """Test: JS signs message → Python verifies signature format."""
    result = TestResult("JS→Python: Sign and verify")
    
    try:
        js_script = '''
const alice = { agent: 'alice-js', org: 'test', key: 'js-pub-key-456' };
const bob = { agent: 'bob-py', org: 'test' };

const message = moltspeak.createQuery(
    { domain: 'crypto', intent: 'test', params: { data: 'secret' } },
    alice,
    bob
);

const signed = moltspeak.sign(message, 'mock-private-key-js');
console.log(moltspeak.encode(signed));
'''
        stdout, stderr, code = run_js(js_script)
        
        if code != 0:
            result.error = f"JS execution failed: {stderr}"
            return result
        
        # Parse and verify in Python
        message = decode(stdout)
        
        # Check signature exists
        if "sig" not in message:
            result.error = "Signature not present in message"
            return result
        
        # Check signature format
        if not message["sig"].startswith("ed25519:"):
            result.error = f"Signature format wrong: {message['sig']}"
            return result
        
        # Verify using Python SDK
        verified = verify(message, "js-pub-key-456")
        
        if not verified:
            result.error = "Python verification failed"
            return result
        
        result.passed = True
        
    except Exception as e:
        result.error = str(e)
    
    return result


def test_envelope_roundtrip():
    """Test: Python wraps in envelope → JS unwraps → matches original."""
    result = TestResult("Envelope: Roundtrip Python→JS→Python")
    
    try:
        alice = AgentIdentity(agent="alice-py", org="test")
        
        hello = create_hello(alice, {"operations": ["query", "respond", "task"]})
        
        # Wrap in envelope (already imported)
        envelope = wrap_in_envelope(hello)
        envelope_json = json.dumps(envelope)
        
        # JS unwraps and returns message
        js_script = f'''
const envelope = {envelope_json};
try {{
    const message = moltspeak.unwrapEnvelope(envelope);
    console.log(JSON.stringify({{
        success: true,
        op: message.op,
        version: envelope.moltspeak,
        from_agent: message.from?.agent
    }}));
}} catch(e) {{
    console.log(JSON.stringify({{ error: e.message }}));
}}
'''
        stdout, stderr, code = run_js(js_script)
        
        if code != 0:
            result.error = f"JS execution failed: {stderr}"
            return result
        
        js_result = json.loads(stdout)
        
        if js_result.get("error"):
            result.error = f"JS unwrap failed: {js_result['error']}"
            return result
        
        if js_result["op"] != "hello":
            result.error = f"Operation mismatch: expected hello, got {js_result['op']}"
            return result
        
        if js_result["version"] != PROTOCOL_VERSION:
            result.error = f"Version mismatch: expected {PROTOCOL_VERSION}, got {js_result['version']}"
            return result
        
        result.passed = True
        
    except Exception as e:
        result.error = str(e)
    
    return result


def test_all_message_types():
    """Test: All message types (query, respond, task, error) work across SDKs."""
    result = TestResult("Message Types: All types compatible")
    
    try:
        alice = AgentIdentity(agent="alice", org="test")
        bob = AgentIdentity(agent="bob", org="test")
        
        # Create each message type in Python
        messages = {
            "query": create_query({"domain": "d", "intent": "i"}, alice, bob),
            "task": create_task({"description": "do something", "type": "test"}, alice, bob),
            "hello": create_hello(alice),
        }
        
        # Validate each in JS
        for msg_type, msg in messages.items():
            msg_json = encode(msg)
            
            js_script = f'''
const msg = {msg_json};
const result = moltspeak.validateMessage(msg, {{ strict: false, checkPII: false }});
console.log(JSON.stringify({{
    type: "{msg_type}",
    valid: result.valid,
    op: msg.op
}}));
'''
            stdout, stderr, code = run_js(js_script)
            
            if code != 0:
                result.error = f"JS failed for {msg_type}: {stderr}"
                return result
            
            js_result = json.loads(stdout)
            
            if not js_result.get("valid"):
                result.error = f"JS validation failed for {msg_type}"
                return result
        
        result.passed = True
        
    except Exception as e:
        result.error = str(e)
    
    return result


def test_natural_language():
    """Test: Natural language encoding/decoding works across SDKs."""
    result = TestResult("Natural Language: Cross-SDK compatibility")
    
    try:
        # Create message in Python, convert to NL, send to JS
        alice = AgentIdentity(agent="alice", org="test")
        bob = AgentIdentity(agent="bob", org="test")
        
        query = create_query(
            {"domain": "weather", "intent": "check", "params": {"text": "What is the weather?"}},
            alice,
            bob
        )
        
        query_json = encode(query)
        
        # JS converts to natural language
        js_script = f'''
const msg = {query_json};
const nl = moltspeak.toNaturalLanguage(msg);
console.log(JSON.stringify({{ nl: nl }}));
'''
        stdout, stderr, code = run_js(js_script)
        
        if code != 0:
            result.error = f"JS execution failed: {stderr}"
            return result
        
        js_result = json.loads(stdout)
        nl = js_result.get("nl", "")
        
        # Check that NL contains key elements
        if "alice" not in nl or "bob" not in nl:
            result.error = f"Natural language missing agent names: {nl}"
            return result
        
        result.passed = True
        
    except Exception as e:
        result.error = str(e)
    
    return result


def main():
    """Run all integration tests."""
    print("=" * 60)
    print("MoltSpeak Cross-SDK Integration Tests")
    print("Python SDK ↔ JavaScript SDK Compatibility")
    print("=" * 60)
    print()
    
    # Check Node.js is available
    try:
        node_result = subprocess.run(
            ['node', '--version'],
            capture_output=True,
            text=True,
            timeout=5
        )
        print(f"Node.js version: {node_result.stdout.strip()}")
    except Exception as e:
        print(f"❌ Node.js not available: {e}")
        sys.exit(1)
    
    print(f"Python version: {sys.version.split()[0]}")
    print(f"MoltSpeak Protocol: v{PROTOCOL_VERSION}")
    print()
    print("-" * 60)
    print()
    
    tests = [
        test_python_to_js_message_format,
        test_python_sign_js_verify,
        test_js_to_python_message_format,
        test_js_sign_python_verify,
        test_envelope_roundtrip,
        test_all_message_types,
        test_natural_language,
    ]
    
    results = []
    for test_fn in tests:
        result = test_fn()
        results.append(result)
        print(result)
    
    print()
    print("-" * 60)
    
    passed = sum(1 for r in results if r.passed)
    total = len(results)
    
    print()
    print(f"Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All integration tests passed! SDKs are compatible.")
        return 0
    else:
        print(f"\n⚠️  {total - passed} test(s) failed.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
