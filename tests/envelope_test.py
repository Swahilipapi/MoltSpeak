#!/usr/bin/env python3
"""
Comprehensive Envelope Functionality Tests for MoltSpeak SDKs

Tests:
1. Wrap in Envelope
2. Unwrap Envelope
3. Encrypted Envelopes
4. Round Trip
5. Cross-SDK Envelopes
6. Edge Cases
"""

import sys
import json
import subprocess
import tempfile
import os

# Import the standalone moltspeak.py (not the package)
import importlib.util
spec = importlib.util.spec_from_file_location("moltspeak_sdk", "/tmp/MoltSpeak/sdk/python/moltspeak.py")
ms = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ms)

# Test results
results = []

def test(name, passed, details=""):
    status = "✅ PASS" if passed else "❌ FAIL"
    results.append((name, passed, details))
    print(f"{status}: {name}")
    if details and not passed:
        print(f"       {details}")

def run_js(code):
    """Run JavaScript code and return result"""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.js', delete=False) as f:
        full_code = f"""
const moltspeak = require('/tmp/MoltSpeak/sdk/js/moltspeak.js');
{code}
"""
        f.write(full_code)
        f.flush()
        try:
            result = subprocess.run(
                ['node', f.name],
                capture_output=True,
                text=True,
                timeout=10
            )
            os.unlink(f.name)
            return result.stdout.strip(), result.stderr.strip(), result.returncode
        except Exception as e:
            os.unlink(f.name)
            return "", str(e), 1

print("=" * 60)
print("📦 ENVELOPE FUNCTIONALITY TESTS - MoltSpeak SDKs")
print("=" * 60)

# =============================================================================
# 1. WRAP IN ENVELOPE - Python SDK
# =============================================================================
print("\n" + "=" * 60)
print("1️⃣  WRAP IN ENVELOPE")
print("=" * 60)

# Test 1.1: Basic message wrapping - Python
print("\n--- Python SDK ---")
try:
    msg = ms.create_query(
        {"domain": "test", "intent": "envelope_test", "params": {"data": "hello"}},
        {"agent": "alice", "org": "test"},
        {"agent": "bob", "org": "test"}
    )
    envelope = ms.wrap_in_envelope(msg)
    
    # Verify structure
    has_moltspeak = "moltspeak" in envelope
    has_envelope_meta = "envelope" in envelope
    has_message = "message" in envelope
    has_encrypted = "encrypted" in envelope.get("envelope", {})
    
    test("Python: wrap_in_envelope - has 'moltspeak' key", has_moltspeak)
    test("Python: wrap_in_envelope - has 'envelope' metadata", has_envelope_meta)
    test("Python: wrap_in_envelope - has 'message' key", has_message)
    test("Python: wrap_in_envelope - has 'encrypted' field", has_encrypted)
    
    # Verify version
    version_correct = envelope.get("moltspeak") == "0.1"
    test("Python: wrap_in_envelope - version is '0.1'", version_correct, 
         f"Got: {envelope.get('moltspeak')}")
    
    # Verify encrypted=False by default
    encrypted_false = envelope.get("envelope", {}).get("encrypted") == False
    test("Python: wrap_in_envelope - encrypted=False by default", encrypted_false)
    
    # Verify message preserved
    msg_preserved = envelope.get("message", {}).get("op") == "query"
    test("Python: wrap_in_envelope - message content preserved", msg_preserved)
    
except Exception as e:
    test("Python: wrap_in_envelope", False, str(e))

# Test 1.2: Basic message wrapping - JavaScript
print("\n--- JavaScript SDK ---")
stdout, stderr, code = run_js("""
try {
    const msg = moltspeak.createQuery(
        { domain: "test", intent: "envelope_test", params: { data: "hello" } },
        { agent: "alice", org: "test" },
        { agent: "bob", org: "test" }
    );
    const envelope = moltspeak.wrapInEnvelope(msg);
    
    const results = {
        has_moltspeak: "moltspeak" in envelope,
        has_envelope: "envelope" in envelope,
        has_message: "message" in envelope,
        has_encrypted: envelope.envelope && "encrypted" in envelope.envelope,
        version: envelope.moltspeak,
        encrypted: envelope.envelope ? envelope.envelope.encrypted : null,
        op: envelope.message ? envelope.message.op : null
    };
    console.log(JSON.stringify(results));
} catch (e) {
    console.log(JSON.stringify({ error: e.message }));
}
""")

if code == 0 and stdout:
    try:
        r = json.loads(stdout)
        if "error" in r:
            test("JS: wrapInEnvelope", False, r["error"])
        else:
            test("JS: wrapInEnvelope - has 'moltspeak' key", r["has_moltspeak"])
            test("JS: wrapInEnvelope - has 'envelope' metadata", r["has_envelope"])
            test("JS: wrapInEnvelope - has 'message' key", r["has_message"])
            test("JS: wrapInEnvelope - has 'encrypted' field", r["has_encrypted"])
            test("JS: wrapInEnvelope - version is '0.1'", r["version"] == "0.1", f"Got: {r['version']}")
            test("JS: wrapInEnvelope - encrypted=False by default", r["encrypted"] == False)
            test("JS: wrapInEnvelope - message content preserved", r["op"] == "query")
    except:
        test("JS: wrapInEnvelope - parse result", False, stdout)
else:
    test("JS: wrapInEnvelope", False, stderr or "No output")

# =============================================================================
# 2. UNWRAP ENVELOPE
# =============================================================================
print("\n" + "=" * 60)
print("2️⃣  UNWRAP ENVELOPE")
print("=" * 60)

# Test 2.1: Unwrap valid envelope - Python
print("\n--- Python SDK ---")
try:
    msg = ms.create_query(
        {"domain": "test", "intent": "unwrap_test", "params": {"value": 42}},
        {"agent": "alice", "org": "test"},
        {"agent": "bob", "org": "test"}
    )
    original_id = msg["id"]
    original_op = msg["op"]
    
    envelope = ms.wrap_in_envelope(msg)
    unwrapped = ms.unwrap_envelope(envelope)
    
    test("Python: unwrap_envelope - returns message", unwrapped is not None)
    test("Python: unwrap_envelope - preserves message ID", unwrapped.get("id") == original_id)
    test("Python: unwrap_envelope - preserves operation", unwrapped.get("op") == original_op)
    test("Python: unwrap_envelope - preserves payload", 
         unwrapped.get("p", {}).get("params", {}).get("value") == 42)
except Exception as e:
    test("Python: unwrap_envelope", False, str(e))

# Test 2.2: Unwrap valid envelope - JavaScript
print("\n--- JavaScript SDK ---")
stdout, stderr, code = run_js("""
try {
    const msg = moltspeak.createQuery(
        { domain: "test", intent: "unwrap_test", params: { value: 42 } },
        { agent: "alice", org: "test" },
        { agent: "bob", org: "test" }
    );
    const originalId = msg.id;
    const originalOp = msg.op;
    
    const envelope = moltspeak.wrapInEnvelope(msg);
    const unwrapped = moltspeak.unwrapEnvelope(envelope);
    
    console.log(JSON.stringify({
        has_message: unwrapped !== null && unwrapped !== undefined,
        id_match: unwrapped.id === originalId,
        op_match: unwrapped.op === originalOp,
        value_match: unwrapped.p && unwrapped.p.params && unwrapped.p.params.value === 42
    }));
} catch (e) {
    console.log(JSON.stringify({ error: e.message }));
}
""")

if code == 0 and stdout:
    try:
        r = json.loads(stdout)
        if "error" in r:
            test("JS: unwrapEnvelope", False, r["error"])
        else:
            test("JS: unwrapEnvelope - returns message", r["has_message"])
            test("JS: unwrapEnvelope - preserves message ID", r["id_match"])
            test("JS: unwrapEnvelope - preserves operation", r["op_match"])
            test("JS: unwrapEnvelope - preserves payload", r["value_match"])
    except:
        test("JS: unwrapEnvelope - parse result", False, stdout)
else:
    test("JS: unwrapEnvelope", False, stderr or "No output")

# =============================================================================
# 3. ENCRYPTED ENVELOPES
# =============================================================================
print("\n" + "=" * 60)
print("3️⃣  ENCRYPTED ENVELOPES")
print("=" * 60)

# Test 3.1: Encrypted envelope fails without key - Python
print("\n--- Python SDK ---")
try:
    encrypted_envelope = {
        "moltspeak": "0.1",
        "envelope": {
            "encrypted": True,
            "algorithm": "x25519-xsalsa20-poly1305"
        },
        "ciphertext": "base64encodedciphertext=="
    }
    
    error_raised = False
    error_msg = ""
    try:
        ms.unwrap_envelope(encrypted_envelope)
    except ValueError as e:
        error_raised = True
        error_msg = str(e)
    
    test("Python: encrypted envelope raises error", error_raised)
    test("Python: error message mentions encryption/key", 
         "decrypt" in error_msg.lower() or "encrypt" in error_msg.lower() or "key" in error_msg.lower(),
         f"Got: {error_msg}")
except Exception as e:
    test("Python: encrypted envelope handling", False, str(e))

# Test 3.2: Encrypted envelope fails without key - JavaScript
print("\n--- JavaScript SDK ---")
stdout, stderr, code = run_js("""
try {
    const encryptedEnvelope = {
        moltspeak: "0.1",
        envelope: {
            encrypted: true,
            algorithm: "x25519-xsalsa20-poly1305"
        },
        ciphertext: "base64encodedciphertext=="
    };
    
    let errorRaised = false;
    let errorMsg = "";
    try {
        moltspeak.unwrapEnvelope(encryptedEnvelope);
    } catch (e) {
        errorRaised = true;
        errorMsg = e.message;
    }
    
    console.log(JSON.stringify({
        error_raised: errorRaised,
        error_msg: errorMsg
    }));
} catch (e) {
    console.log(JSON.stringify({ error: e.message }));
}
""")

if code == 0 and stdout:
    try:
        r = json.loads(stdout)
        if "error" in r:
            test("JS: encrypted envelope handling", False, r["error"])
        else:
            test("JS: encrypted envelope raises error", r["error_raised"])
            msg = r["error_msg"].lower()
            test("JS: error message mentions encryption/key",
                 "decrypt" in msg or "encrypt" in msg or "key" in msg,
                 f"Got: {r['error_msg']}")
    except:
        test("JS: encrypted envelope - parse result", False, stdout)
else:
    test("JS: encrypted envelope", False, stderr or "No output")

# =============================================================================
# 4. ROUND TRIP
# =============================================================================
print("\n" + "=" * 60)
print("4️⃣  ROUND TRIP")
print("=" * 60)

# Test 4.1: Round trip - Python
print("\n--- Python SDK ---")
try:
    original = ms.create_query(
        {"domain": "roundtrip", "intent": "test", "params": {"nested": {"deep": "value"}}},
        {"agent": "alice", "org": "test"},
        {"agent": "bob", "org": "test"}
    )
    original_json = json.dumps(original, sort_keys=True)
    
    # Wrap
    envelope = ms.wrap_in_envelope(original)
    
    # Unwrap
    recovered = ms.unwrap_envelope(envelope)
    recovered_json = json.dumps(recovered, sort_keys=True)
    
    test("Python: round trip - message identical after wrap/unwrap", 
         original_json == recovered_json,
         f"Original keys: {list(original.keys())}, Recovered keys: {list(recovered.keys())}")
except Exception as e:
    test("Python: round trip", False, str(e))

# Test 4.2: Round trip - JavaScript
print("\n--- JavaScript SDK ---")
stdout, stderr, code = run_js("""
try {
    const original = moltspeak.createQuery(
        { domain: "roundtrip", intent: "test", params: { nested: { deep: "value" } } },
        { agent: "alice", org: "test" },
        { agent: "bob", org: "test" }
    );
    const originalJson = JSON.stringify(original, Object.keys(original).sort());
    
    const envelope = moltspeak.wrapInEnvelope(original);
    const recovered = moltspeak.unwrapEnvelope(envelope);
    const recoveredJson = JSON.stringify(recovered, Object.keys(recovered).sort());
    
    console.log(JSON.stringify({
        identical: originalJson === recoveredJson,
        original_id: original.id,
        recovered_id: recovered.id
    }));
} catch (e) {
    console.log(JSON.stringify({ error: e.message }));
}
""")

if code == 0 and stdout:
    try:
        r = json.loads(stdout)
        if "error" in r:
            test("JS: round trip", False, r["error"])
        else:
            test("JS: round trip - message identical after wrap/unwrap", r["identical"],
                 f"IDs: {r.get('original_id')} vs {r.get('recovered_id')}")
    except:
        test("JS: round trip - parse result", False, stdout)
else:
    test("JS: round trip", False, stderr or "No output")

# =============================================================================
# 5. CROSS-SDK ENVELOPES
# =============================================================================
print("\n" + "=" * 60)
print("5️⃣  CROSS-SDK ENVELOPES")
print("=" * 60)

# Test 5.1: Python wraps, JS unwraps
print("\n--- Python → JavaScript ---")
try:
    py_msg = ms.create_query(
        {"domain": "crosssdk", "intent": "py2js", "params": {"from": "python"}},
        {"agent": "py-agent", "org": "test"},
        {"agent": "js-agent", "org": "test"}
    )
    py_envelope = ms.wrap_in_envelope(py_msg)
    py_envelope_json = json.dumps(py_envelope)
    
    stdout, stderr, code = run_js(f"""
try {{
    const envelope = {py_envelope_json};
    const message = moltspeak.unwrapEnvelope(envelope);
    console.log(JSON.stringify({{
        success: true,
        op: message.op,
        domain: message.p ? message.p.domain : null,
        from_param: message.p && message.p.params ? message.p.params.from : null
    }}));
}} catch (e) {{
    console.log(JSON.stringify({{ error: e.message }}));
}}
""")
    
    if code == 0 and stdout:
        r = json.loads(stdout)
        if "error" in r:
            test("Cross-SDK: Python envelope → JS unwrap", False, r["error"])
        else:
            test("Cross-SDK: Python envelope → JS unwrap succeeds", r["success"])
            test("Cross-SDK: Python→JS - operation preserved", r["op"] == "query")
            test("Cross-SDK: Python→JS - domain preserved", r["domain"] == "crosssdk")
            test("Cross-SDK: Python→JS - params preserved", r["from_param"] == "python")
    else:
        test("Cross-SDK: Python envelope → JS unwrap", False, stderr)
except Exception as e:
    test("Cross-SDK: Python → JS", False, str(e))

# Test 5.2: JS wraps, Python unwraps
print("\n--- JavaScript → Python ---")
stdout, stderr, code = run_js("""
try {
    const msg = moltspeak.createQuery(
        { domain: "crosssdk", intent: "js2py", params: { from: "javascript" } },
        { agent: "js-agent", org: "test" },
        { agent: "py-agent", org: "test" }
    );
    const envelope = moltspeak.wrapInEnvelope(msg);
    console.log(JSON.stringify(envelope));
} catch (e) {
    console.error(e.message);
    process.exit(1);
}
""")

if code == 0 and stdout:
    try:
        js_envelope = json.loads(stdout)
        
        # Unwrap in Python
        py_unwrapped = ms.unwrap_envelope(js_envelope)
        
        test("Cross-SDK: JS envelope → Python unwrap succeeds", py_unwrapped is not None)
        test("Cross-SDK: JS→Python - operation preserved", py_unwrapped.get("op") == "query")
        test("Cross-SDK: JS→Python - domain preserved", 
             py_unwrapped.get("p", {}).get("domain") == "crosssdk")
        test("Cross-SDK: JS→Python - params preserved",
             py_unwrapped.get("p", {}).get("params", {}).get("from") == "javascript")
    except Exception as e:
        test("Cross-SDK: JS → Python", False, str(e))
else:
    test("Cross-SDK: JS → Python", False, stderr)

# =============================================================================
# 6. EDGE CASES
# =============================================================================
print("\n" + "=" * 60)
print("6️⃣  EDGE CASES")
print("=" * 60)

# Test 6.1: Empty message in envelope - Python
print("\n--- Empty Message ---")
try:
    # Minimal valid message (empty payload)
    empty_msg = {
        "v": "0.1",
        "id": ms.generate_uuid(),
        "ts": ms.now(),
        "op": "query",
        "from": {"agent": "test", "org": "test"},
        "cls": "int",
        "p": {}
    }
    
    envelope = ms.wrap_in_envelope(empty_msg)
    unwrapped = ms.unwrap_envelope(envelope)
    
    test("Python: empty payload message wraps/unwraps", 
         unwrapped.get("p") == {})
except Exception as e:
    test("Python: empty payload message", False, str(e))

# Test 6.2: Large message in envelope - Python
print("\n--- Large Message ---")
try:
    # Large payload (100KB)
    large_data = "x" * 100000
    large_msg = ms.create_query(
        {"domain": "test", "intent": "large", "params": {"data": large_data}},
        {"agent": "alice", "org": "test"},
        {"agent": "bob", "org": "test"}
    )
    
    envelope = ms.wrap_in_envelope(large_msg)
    unwrapped = ms.unwrap_envelope(envelope)
    
    data_preserved = unwrapped.get("p", {}).get("params", {}).get("data") == large_data
    test("Python: large message (100KB) wraps/unwraps correctly", data_preserved)
except Exception as e:
    test("Python: large message handling", False, str(e))

# Test 6.3: Large message - JavaScript
stdout, stderr, code = run_js("""
try {
    const largeData = "x".repeat(100000);
    const msg = moltspeak.createQuery(
        { domain: "test", intent: "large", params: { data: largeData } },
        { agent: "alice", org: "test" },
        { agent: "bob", org: "test" }
    );
    
    const envelope = moltspeak.wrapInEnvelope(msg);
    const unwrapped = moltspeak.unwrapEnvelope(envelope);
    
    console.log(JSON.stringify({
        preserved: unwrapped.p.params.data === largeData,
        length: unwrapped.p.params.data.length
    }));
} catch (e) {
    console.log(JSON.stringify({ error: e.message }));
}
""")

if code == 0 and stdout:
    try:
        r = json.loads(stdout)
        if "error" in r:
            test("JS: large message handling", False, r["error"])
        else:
            test("JS: large message (100KB) wraps/unwraps correctly", r["preserved"],
                 f"Length: {r.get('length')}")
    except:
        test("JS: large message - parse result", False, stdout[:200])
else:
    test("JS: large message handling", False, stderr)

# Test 6.4: Invalid envelope handling - Python
print("\n--- Invalid Envelopes ---")
try:
    # Missing moltspeak version
    invalid1 = {"envelope": {"encrypted": False}, "message": {}}
    error1 = False
    try:
        ms.unwrap_envelope(invalid1)
    except ValueError:
        error1 = True
    test("Python: rejects envelope without 'moltspeak' field", error1)
    
    # Missing message
    invalid2 = {"moltspeak": "0.1", "envelope": {"encrypted": False}}
    error2 = False
    try:
        ms.unwrap_envelope(invalid2)
    except ValueError:
        error2 = True
    test("Python: rejects envelope without 'message' field", error2)
    
except Exception as e:
    test("Python: invalid envelope handling", False, str(e))

# Test 6.5: Invalid envelope handling - JavaScript
stdout, stderr, code = run_js("""
try {
    let error1 = false;
    try {
        moltspeak.unwrapEnvelope({ envelope: { encrypted: false }, message: {} });
    } catch (e) {
        error1 = true;
    }
    
    let error2 = false;
    try {
        moltspeak.unwrapEnvelope({ moltspeak: "0.1", envelope: { encrypted: false } });
    } catch (e) {
        error2 = true;
    }
    
    console.log(JSON.stringify({ error1, error2 }));
} catch (e) {
    console.log(JSON.stringify({ error: e.message }));
}
""")

if code == 0 and stdout:
    try:
        r = json.loads(stdout)
        if "error" in r:
            test("JS: invalid envelope handling", False, r["error"])
        else:
            test("JS: rejects envelope without 'moltspeak' field", r["error1"])
            test("JS: rejects envelope without 'message' field", r["error2"])
    except:
        test("JS: invalid envelope - parse result", False, stdout)
else:
    test("JS: invalid envelope handling", False, stderr)

# Test 6.6: Nested envelope behavior
print("\n--- Nested Envelopes ---")
try:
    msg = ms.create_query(
        {"domain": "test", "intent": "nested"},
        {"agent": "alice", "org": "test"},
        {"agent": "bob", "org": "test"}
    )
    
    # Wrap twice
    inner_envelope = ms.wrap_in_envelope(msg)
    outer_envelope = ms.wrap_in_envelope(inner_envelope)
    
    # First unwrap
    first_unwrap = ms.unwrap_envelope(outer_envelope)
    
    # Check if we get the inner envelope
    is_inner_envelope = "moltspeak" in first_unwrap and "envelope" in first_unwrap
    test("Python: nested envelope - first unwrap returns inner envelope", is_inner_envelope)
    
    if is_inner_envelope:
        # Second unwrap
        second_unwrap = ms.unwrap_envelope(first_unwrap)
        test("Python: nested envelope - second unwrap returns message",
             second_unwrap.get("op") == "query")
except Exception as e:
    test("Python: nested envelope handling", False, str(e))

# =============================================================================
# SUMMARY
# =============================================================================
print("\n" + "=" * 60)
print("📊 TEST SUMMARY")
print("=" * 60)

passed = sum(1 for _, p, _ in results if p)
failed = sum(1 for _, p, _ in results if not p)
total = len(results)

print(f"\n✅ Passed: {passed}/{total}")
print(f"❌ Failed: {failed}/{total}")
print(f"📈 Pass Rate: {passed/total*100:.1f}%")

if failed > 0:
    print("\n❌ Failed Tests:")
    for name, p, details in results:
        if not p:
            print(f"   - {name}")
            if details:
                print(f"     {details}")

print("\n" + "=" * 60)
if failed == 0:
    print("🎉 ALL TESTS PASSED!")
else:
    print(f"⚠️  {failed} TEST(S) FAILED")
print("=" * 60)

sys.exit(0 if failed == 0 else 1)
